
import { Data } from "./route.ts";
import { content_type_codes_inv, Middleware } from "./serve.types.ts";

import { jsx } from "../template/jsx.ts";
import { render } from "../template/html.ts";
import * as template from "../template/template.tsx";
import { FlashExport } from "./route.util.flash.ts";
import { Err } from "../db.ts";

const post_list: Middleware<Data, 'GET', never> = async (ctx) => {
	const limit = 10;

	const offset = Number(ctx.query_url('offset') ?? '0');
	const tags_str = ctx.query_url('q') ?? '';

	const tags = tags_str.trim() === '' ? [] : tags_str.split(' ');

	const posts = await ctx.data.db.post_list(tags, limit, offset);

	const url_back = new URL(ctx.url);
	url_back.searchParams.set('offset', Math.max(0, offset - limit).toString());

	const url_forward = new URL(ctx.url);
	url_forward.searchParams.set('offset', (offset + limit).toString());

	const dom = (
		<template.Base title="posts">
			<h1>post listing</h1>

			<form action={ `${ctx.url.href}/__api` } target="_self" method="post" enctype="application/x-www-form-urlencoded" id="form">
				<button type="submit">new</button>
			</form>

			<ul>
				{
					...posts
					.map(x =>
						<li><a href={ `/post/${x.id}` }>{ x.id } - { x.subject }</a></li>
					)
				}
			</ul>

			<a href={ url_back.href }>back</a>
			<a href={ url_forward.href }>next</a>

		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const post_list_api: Middleware<Data, 'POST', never, FlashExport> = async (ctx) => {
	const post_id = await ctx.data.db.post_new();
	return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
};

const post_display: Middleware<Data, 'GET', 'post_id', FlashExport> = async (ctx) => {
	const id = Number(ctx.extract.post_id);

	const post = await ctx.data.db.post_get(id);
	if (post instanceof Err) {
		return ctx.build_response(`post does not exist`, 'not_found', 'txt');
	}

	const files = await ctx.data.db.post_files(id);
	
	const files_element = await Promise.all(files.values().map(async x => {
		const url = await ctx.data.db.file_url(x);
		if (url instanceof Err) {
			throw url.toError();
		}
		return (
			<img src={ url[0] }/>
		);
	}));

	const tags = await ctx.data.db.tagged_from_post(id);
	const tags_element = tags.map(x => {
		return (
			<li><a href={ `${ctx.url.origin}/tag/${x.id}` }>{ x.name }</a></li>
		);
	})

	const dom = (
		<template.Base title="post">
			<h1>post: { post.subject }</h1>
			{
				...files_element
			}
			<p>
				{ post.content }
			</p>
			<ul>
				{
					...tags_element
				}
			</ul>
			<a href={ `/post/${ctx.extract.post_id}/edit` }>edit</a>
		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const post_edit: Middleware<Data, 'GET', 'post_id', FlashExport> = async (ctx) => {
	const flash = ctx.ware.flash.get();

	const id = Number(ctx.extract.post_id);

	const post = await ctx.data.db.post_get(id);
	if (post instanceof Err) {
		return ctx.build_response(`post does not exist`, 'not_found', 'txt');
	}

	const files = await ctx.data.db.post_files(id);

	const files_element = await Promise.all(files.values().map(async (x, i) => {
		const url = await ctx.data.db.file_url(x);
		if (url instanceof Err) {
			throw url.toError();
		}
		return (
			<li>
				<a href={ url[0] }>file { i }</a>
				<form action={ `${ctx.url.origin}/post/${id}/edit/__api/delete/${x}` } method="post" target="_self" enctype="application/x-www-form-urlencoded">
					<button type="submit" name="mode" value="delete">delete</button>
				</form>
			</li>
		);
	}));

	const tags = await ctx.data.db.tagged_from_post(id);

	const dom = (
		<template.Base title="post">
			{ flash ?? undefined }

			<h1>edit: '{ post.subject }'</h1>

			<a href={ `/post/${ctx.extract.post_id}` }>back</a>

			<h2>add file</h2>

			<form action={ `${ctx.url.origin}/post/${id}/edit/__api/upload` } method="post" target="_self" enctype="multipart/form-data" id="form-upload">
				<input type="file" name="file"/>
				<button type="submit">submit</button>
			</form>

			<h2>edit file</h2>

			<ul>
			{
				...files_element
			}
			</ul>

			<h2>edit metadata</h2>

			<form action={ `${ctx.url.origin}/post/${id}/edit/__api/meta` } method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form-meta">
				<input type="text" name="subject" value={ post.subject }></input>
				<textarea name="content">{ post.content }</textarea>
				<textarea name="tags">{ ...tags.values().map(x => x.name).toArray() }</textarea>
				<button type="submit">submit</button>
			</form>

			<form action={ `${ctx.url.origin}/post/${id}/edit/__api/action` } method="post" target="_self" enctype="application/x-www-form-urlencoded">
				<button type="submit" name="mode" value="delete">delete</button>
			</form>

		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const post_edit_api_file_upload: Middleware<Data, 'POST', 'post_id', FlashExport> = async (ctx) => {
	const id = Number(ctx.extract.post_id);

	const form = await ctx.request.formData();

	const file = form.get('file');
	if (file === null || typeof file === 'string') {
		ctx.ware.flash.set(`malformed upload`);
		return ctx.build_redirect(`${ctx.url.origin}/post/${id}/edit`, 'see_other');
	}

	if (!(file.type in content_type_codes_inv)) {
		ctx.ware.flash.set(`unknown mime type: ${file.type}`);
		return ctx.build_redirect(`${ctx.url.origin}/post/${id}/edit`, 'see_other');
	}

	const type = content_type_codes_inv[file.type as keyof typeof content_type_codes_inv];
	
	const buffer = await file.bytes();

	const result = await ctx.data.db.file_add(id, type, buffer);
	if (result instanceof Err) {
		ctx.ware.flash.set(result.message);
		return ctx.build_redirect(`${ctx.url.origin}/post/${id}/edit`, 'see_other');
	}

	return ctx.build_redirect(`${ctx.url.origin}/post/${id}/edit`, 'see_other');
};

const post_edit_api_file_delete: Middleware<Data, 'POST', 'post_id' | 'file_id', FlashExport> = async (ctx) => {
	const post_id = Number(ctx.extract.post_id);
	const file_id = Number(ctx.extract.file_id);

	const form = await ctx.request.formData();

	const mode = form.get('mode');
	if (mode === null || typeof mode !== 'string') {
		ctx.ware.flash.set(`malformed form`);
		return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
	}
	
	if (mode === 'delete') {
		const result = await ctx.data.db.file_del(file_id);
		if (result instanceof Err) {
			ctx.ware.flash.set(result.message);
		}
		return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
	}
	
	ctx.ware.flash.set(`malformed form`);
	return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
};

const post_edit_api_meta: Middleware<Data, 'POST', 'post_id'> = async (ctx) => {
	const post_id = Number(ctx.extract.post_id);

	const form = await ctx.request.formData();

	const form_tags = form.get('tags');
	const form_subject = form.get('subject');
	const form_content = form.get('content');
	
	if (
		form_tags === null || typeof form_tags !== 'string' ||
		form_subject === null || typeof form_subject !== 'string' ||
		form_content === null || typeof form_content !== 'string'
	) {
		return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
	}

	const tags_list = form_tags.trim().split(/\s+/).map(x => x.toLowerCase());

	const resolved_tags = await ctx.data.db.tag_resolve(tags_list);
	const resolved_ids = resolved_tags.map(x => x.id);

	const _result_tags = await ctx.data.db.tagged_into_post(post_id, resolved_ids);
	_result_tags;

	const post = await ctx.data.db.post_get(post_id);
	if (post instanceof Err) {
		return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
	}

	post.subject = form_subject;
	post.content = form_content;

	const result_post = await ctx.data.db.post_set(post);
	if (result_post instanceof Err) {
		return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
	}

	return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
};

const post_edit_api_action: Middleware<Data, 'POST', 'post_id', FlashExport> = async (ctx) => {
	const post_id = Number(ctx.extract.post_id);

	const form = await ctx.request.formData();

	const mode = form.get('mode');
	if (mode === null || typeof mode !== 'string') {
		ctx.ware.flash.set(`malformed form`);
		return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
	}

	if (mode === 'delete') {
		const files = await ctx.data.db.post_files(post_id);
		if (files instanceof Err) {
			ctx.ware.flash.set(files.message);
			return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
		}

		for (const file_id of files) {
			const result = await ctx.data.db.file_del(file_id);
			if (result instanceof Err) {
				ctx.ware.flash.set(result.message);
				return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
			}
		}

		const result = ctx.data.db.post_del(post_id);
		if (result instanceof Err) {
			ctx.ware.flash.set(result.message);
			return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
		}

		ctx.ware.flash.set(`post successfully deleted`);
		return ctx.build_redirect(`${ctx.url.origin}/post`, 'see_other');
	}
	
	ctx.ware.flash.set(`malformed form`);
	return ctx.build_redirect(`${ctx.url.origin}/post/${post_id}/edit`, 'see_other');
};

const tag_list: Middleware<Data, 'GET', never> = async (ctx) => {
	const limit = 10;

	const offset = Number(ctx.query_url('offset') ?? '0');
	const like_str = ctx.query_url('q') ?? '';

	const tags = await ctx.data.db.tag_list(like_str, limit, offset);

	const url_back = new URL(ctx.url);
	url_back.searchParams.set('offset', Math.max(0, offset - limit).toString());

	const url_forward = new URL(ctx.url);
	url_forward.searchParams.set('offset', (offset + limit).toString());

	const dom = (
		<template.Base title="tags">
			<h1>tag listing</h1>

			<form action={ `${ctx.url.origin}/tag/__api/new` } method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form">
				<input type="text" name="name"></input>
				<button type="submit">new</button>
			</form>

			<ul>
				{
					...tags
					.map(x =>
						<li><a href={ `/tag/${x.id}` }>{ x.name }</a></li>
					)
				}
			</ul>

			<a href={ url_back.href }>back</a>
			<a href={ url_forward.href }>next</a>
			
		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const tag_list_api_new: Middleware<Data, 'POST', never, FlashExport> = async (ctx) => {
	const form = await ctx.request.formData();

	const name = form.get('name');
	if (name === null || typeof name !== 'string') {
		ctx.ware.flash.set(`malformed form`);
		return ctx.build_redirect(`${ctx.url.origin}/tag`, 'see_other');
	}

	const tag_id = await ctx.data.db.tag_new(name);
	if (tag_id instanceof Err) {
		ctx.ware.flash.set(`tag '${name}' exists`);
		return ctx.build_redirect(`${ctx.url.origin}/tag`, 'see_other');
	}

	return ctx.build_redirect(`${ctx.url.origin}/tag/${tag_id}/edit`, 'see_other');
};

const tag_display: Middleware<Data, 'GET', 'tag_id'> = async (ctx) => {
	const tag_id = Number(ctx.extract.tag_id);

	const tag = await ctx.data.db.tag_get(tag_id);
	if (tag instanceof Err) {
		return ctx.build_response('not found', 'not_found', 'txt');
	}
	
	const dom = (
		<template.Base title={ tag.name }>
			<h1>{ tag.name }</h1>

			<p>
				{ tag.description }
			</p>

			<a href={ `${ctx.url.origin}/tag/${tag_id}/edit` }>edit</a>
		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const tag_edit: Middleware<Data, 'GET', 'tag_id', FlashExport> = async (ctx) => {
	const flash = ctx.ware.flash.get();

	const tag_id = Number(ctx.extract.tag_id);

	const tag = await ctx.data.db.tag_get(tag_id);
	if (tag instanceof Err) {
		return ctx.build_response('not found', 'not_found', 'txt');
	}
	
	const dom = (
		<template.Base title={ tag.name }>
			<h1>editing '{ tag.name }'</h1>

			<p>
			{ flash ?? undefined }
			</p>

			<a href={ `${ctx.url.origin}/tag/${tag_id}` }>back</a>

			<form action={ `${ctx.url.origin}/tag/${tag_id}/edit/__api/edit` } method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form">
				<input type="text" name="name" value={ tag.name }></input>
				<textarea type="text" name="description">{ tag.description }</textarea>
				<button type="submit">submit</button>
			</form>

		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const tag_edit_api_edit: Middleware<Data, 'POST', 'tag_id', FlashExport> = async (ctx) => {
	const tag_id = Number(ctx.extract.tag_id);

	const tag = await ctx.data.db.tag_get(tag_id);
	if (tag instanceof Err) {
		ctx.ware.flash.set(`not found`);
		return ctx.build_redirect(`${ctx.url.origin}/tag/${tag_id}/edit`, 'see_other');
	}

	const form = await ctx.request.formData();
	
	const form_name = form.get('name');
	const form_description = form.get('description');

	if (
		form_name === null || typeof form_name !== 'string' ||
		form_description === null || typeof form_description !== 'string'
	) {
		ctx.ware.flash.set(`malformed form`);
		return ctx.build_redirect(`${ctx.url.origin}/tag/${tag_id}/edit`, 'see_other');
	}

	tag.name = form_name;
	tag.description = form_description;

	const result = await ctx.data.db.tag_set(tag);
	if (result instanceof Err) {
		ctx.ware.flash.set(result.message);
		return ctx.build_redirect(`${ctx.url.origin}/tag/${tag_id}/edit`, 'see_other');
	}
	
	ctx.ware.flash.set(`success`);
	return ctx.build_redirect(`${ctx.url.origin}/tag/${tag_id}/edit`, 'see_other');
};

const post = {
	post_list,
	post_list_api,

	post_display,
	
	post_edit,
	post_edit_api_file_upload,
	post_edit_api_file_delete,
	post_edit_api_meta,
	post_edit_api_action,
	
	tag_list,
	tag_list_api_new,

	tag_display,

	tag_edit,
	tag_edit_api_edit,
};

export default post;

