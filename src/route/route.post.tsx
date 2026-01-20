
import { Data } from "./route.ts";
import { content_type_codes_inv, Middleware } from "../server/serve.types.ts";
import { jsx, fragment } from "../template/jsx.ts";
import { render } from "../template/html.ts";
import * as template from "../template/template.tsx";
import { FlashExport } from "./route.util.flash.ts";
import { Err } from "../common.ts";
import url_list from "./url_list.ts";
import { SessionExport } from "./route.util.session.ts";

const post_list: Middleware<Data, 'GET', never, FlashExport & SessionExport> = async ctx => {
	const limit = 10;

	const offset = Number(ctx.query_url('offset') ?? '0');
	const tags_str = ctx.query_url('q') ?? '';

	const tags = tags_str.trim() === '' ? [] : tags_str.split(' ');

	let post_element;

	const posts = await ctx.data.db.post_search(tags, limit, offset);
	if (posts instanceof Err) {
		post_element = (
			<li>{ posts.message }</li>
		);
	}
	else {
		post_element = (
			<>
			{
				...posts
				.map(x =>
					<li><a href={ `/post/${x.id}` }>{ x.id } - { x.subject }</a></li>
				)
			}
			</>
		);
	}

	const url_back = new URL(ctx.url);
	url_back.searchParams.set('offset', Math.max(0, offset - limit).toString());

	const url_forward = new URL(ctx.url);
	url_forward.searchParams.set('offset', (offset + limit).toString());

	const dom = (
		<template.Base title="posts" user={ ctx.ware.session.user() }>
			<h1>post listing</h1>

			<template.Flash message={ ctx.ware.flash.get() }/>

			<form action="" target="_self" method="post" enctype="application/x-www-form-urlencoded" id="form">
				<input type="hidden" name="type" value="new"></input>
				<button type="submit">new</button>
			</form>

			<ul>
				{ post_element }
			</ul>

			<a href={ url_back.href }>back</a>
			<a href={ url_forward.href }>next</a>

		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const post_list_api: Middleware<Data, 'POST', never, FlashExport> = async ctx => {
	const form = await ctx.request.formData();

	const form_type = form.get('type');
	switch (form_type) {
		case 'new': {
			const post_id = await ctx.data.db.post_new();
			if (post_id instanceof Err) {
				// todo:
				throw post_id.toError();
			}
			return ctx.build_redirect(url_list.post_edit(post_id));
		}
	}

	ctx.ware.flash.set(`malformed form`);
	return ctx.build_redirect(url_list.post_list());
};

const post_display: Middleware<Data, 'GET', 'post_id', FlashExport & SessionExport> = async ctx => {
	const id = Number(ctx.extract.post_id);

	const post = await ctx.data.db.post_get(id);
	if (post instanceof Err) {
		return undefined
	}

	const files = await ctx.data.db.post_files(id);
	if (files instanceof Err) {
		// todo:
		throw files.toError();
	}
	
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
	if (tags instanceof Err) {
		// todo:
		throw tags.toError();
	}

	const tags_element = tags.map(x => {
		return (
			<li><a href={ url_list.tag_display(x.id) }>{ x.name }</a></li>
		);
	})

	const dom = (
		<template.Base title="post" user={ ctx.ware.session.user() }>
			<h1>post: { post.subject }</h1>
			<template.Flash message={ ctx.ware.flash.get() }/>
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
			<a href={ url_list.post_edit(ctx.extract.post_id) }>edit</a>
		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const post_edit: Middleware<Data, 'GET', 'post_id', FlashExport & SessionExport> = async ctx => {
	const id = Number(ctx.extract.post_id);

	const post = await ctx.data.db.post_get(id);
	if (post instanceof Err) {
		return ctx.build_response(`post does not exist`, 'not_found', 'txt');
	}

	const files = await ctx.data.db.post_files(id);
	if (files instanceof Err) {
		// todo:
		throw files.toError();
	}

	const files_element = await Promise.all(files.values().map(async (x, i) => {
		const url = await ctx.data.db.file_url(x);
		if (url instanceof Err) {
			throw url.toError();
		}
		return (
			<li>
				<a href={ url[0] }>file { i }</a>
				<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded">
					<input type="hidden" name="type" value="file-action"/>
					<input type="hidden" name="file_id" value={ x.toString() }/>

					<button type="submit" name="mode" value="delete">delete</button>
				</form>
			</li>
		);
	}));

	const tags = await ctx.data.db.tagged_from_post(id);
	if (tags instanceof Err) {
		// todo:
		throw tags.toError();
	}

	const dom = (
		<template.Base title="post" user={ ctx.ware.session.user() }>
			<h1>edit: '{ post.subject }'</h1>

			<template.Flash message={ ctx.ware.flash.get() }/>

			<a href={ `/post/${ctx.extract.post_id}` }>back</a>

			<h2>add file</h2>

			<form action="" method="post" target="_self" enctype="multipart/form-data" id="form-upload">
				<input type="hidden" name="type" value="upload"/>
				
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

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form-meta">
				<input type="hidden" name="type" value="meta"/>

				<input type="text" name="subject" value={ post.subject }></input>
				<textarea name="content">{ post.content }</textarea>
				<textarea name="tags">{ ...tags.values().map(x => x.name + ' ').toArray() }</textarea>
				<button type="submit">submit</button>
			</form>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded">
				<input type="hidden" name="type" value="action"/>

				<button type="submit" name="mode" value="delete">delete</button>
			</form>

		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const post_edit_api: Middleware<Data, 'POST', 'post_id', FlashExport> = async ctx => {
	const post_id = Number(ctx.extract.post_id);
	const form = await ctx.request.formData();

	const form_type = form.get('type');
	switch (form_type) {
		case 'meta': {
			const form_tags = form.get('tags');
			const form_subject = form.get('subject');
			const form_content = form.get('content');

			if (
				form_tags === null || typeof form_tags !== 'string' ||
				form_subject === null || typeof form_subject !== 'string' ||
				form_content === null || typeof form_content !== 'string'
			) {
				ctx.ware.flash.set(`malformed form`);
				break;
			}

			const tags_list = form_tags.trim().split(/\s+/).map(x => x.toLowerCase());

			const resolved_tags = await ctx.data.db.tag_get_name_list(tags_list);
			if (resolved_tags instanceof Err) {
				ctx.ware.flash.set(resolved_tags.message);
				break;
			}

			const resolved_ids = resolved_tags.map(x => x.id);

			const _result_tags = await ctx.data.db.tagged_into_post(post_id, resolved_ids);
			_result_tags;

			const post = await ctx.data.db.post_get(post_id);
			if (post instanceof Err) {
				break;
			}

			post.subject = form_subject.trim();
			post.content = form_content.trim();

			const result_post = await ctx.data.db.post_update(post);
			if (result_post instanceof Err) {
				break;
			}

			break;
		}

		case 'upload': {
			const file = form.get('file');
			if (file === null || typeof file === 'string') {
				ctx.ware.flash.set(`malformed upload`);
				break;
			}

			if (!(file.type in content_type_codes_inv)) {
				ctx.ware.flash.set(`unknown mime type: ${file.type}`);
				break;
			}

			const type = content_type_codes_inv[file.type as keyof typeof content_type_codes_inv];
			
			const buffer = await file.bytes();

			const result = await ctx.data.db.file_add(post_id, type, buffer);
			if (result instanceof Err) {
				ctx.ware.flash.set(result.message);
				break;
			}

			break;
		}

		case 'action': {
			const form_mode = form.get('mode');
			if (form_mode === null || typeof form_mode !== 'string') {
				ctx.ware.flash.set(`malformed form`);
				break;
			}

			if (form_mode === 'delete') {
				const files = await ctx.data.db.post_files(post_id);
				if (files instanceof Err) {
					ctx.ware.flash.set(files.message);
					break;
				}

				for (const file_id of files) {
					const result = await ctx.data.db.file_delete(file_id);
					if (result instanceof Err) {
						ctx.ware.flash.set(result.message);
						break;
					}
				}

				const result = ctx.data.db.post_delete(post_id);
				if (result instanceof Err) {
					ctx.ware.flash.set(result.message);
					break;
				}

				ctx.ware.flash.set(`post successfully deleted`);
				return ctx.build_redirect(url_list.post_list());
			}

			ctx.ware.flash.set(`malformed form`);
			break;
		}

		case 'file-action': {
			const form_mode = form.get('mode');
			const form_file_id = form.get('file_id');
			if (
				form_mode === null || typeof form_mode !== 'string' ||
				form_file_id === null || typeof form_file_id !== 'string'
			) {
				ctx.ware.flash.set(`malformed form`);
				break;
			}

			const file_id = Number(form_file_id);

			if (form_mode === 'delete') {
				const result = await ctx.data.db.file_delete(file_id);
				if (result instanceof Err) {
					ctx.ware.flash.set(result.message);
				}
				break;
			}
			
			ctx.ware.flash.set(`malformed form`);
			return ctx.build_redirect(url_list.post_edit(post_id));
		}

		default: {
			ctx.ware.flash.set(`malformed form`);
		}
	}

	return ctx.build_redirect(url_list.post_edit(post_id));
};

export default {
	post_list,
	post_list_api,

	post_display,
	
	post_edit,
	post_edit_api,
} as const;

