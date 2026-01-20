
import { jsx, fragment } from "../template/jsx.ts";
import { Data } from "./route.ts";
import { Middleware } from "../server/serve.types.ts";
import * as template from "../template/template.tsx";
import { FlashExport } from "./route.util.flash.ts";
import { render } from "../template/html.ts";
import url_list from "./url_list.ts";
import { Err } from "../common.ts";
import { SessionExport } from "./route.util.session.ts";

const tag_list: Middleware<Data, 'GET', never, SessionExport> = async ctx => {
	const limit = 10;

	const offset = Number(ctx.query_url('offset') ?? '0');
	const like_str = ctx.query_url('q') ?? '';

	let tags_element;

	const tags = await ctx.data.db.tag_search(like_str, limit, offset);
	if (tags instanceof Err) {
		tags_element = (
			<li>{ tags.message }</li>
		);
	}
	else {
		tags_element = (
			<>
			{
				...tags
				.map(x =>
					<li><a href={ `/tag/${x.id}` }>{ x.name }</a></li>
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
		<template.Base title="tags" user={ ctx.ware.session.user() }>
			<h1>tag listing</h1>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form">
				<input type="hidden" name="type" value="new"/>
				<input type="text" name="name"></input>
				<button type="submit">new</button>
			</form>

			<ul>
				{ tags_element }
			</ul>

			<a href={ url_back.href }>back</a>
			<a href={ url_forward.href }>next</a>
			
		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const tag_list_api: Middleware<Data, 'POST', never, FlashExport> = async ctx => {
	const form = await ctx.request.formData();

	const form_type = form.get('type');
	switch (form_type) {
		case 'new': {
			const name = form.get('name');
			if (name === null || typeof name !== 'string') {
				ctx.ware.flash.set(`malformed form`);
				return ctx.build_redirect(url_list.tag_list());
			}

			const tag_id = await ctx.data.db.tag_new(name);
			if (tag_id instanceof Err) {
				ctx.ware.flash.set(`tag '${name}' exists`);
				return ctx.build_redirect(url_list.tag_list());
			}

			return ctx.build_redirect(url_list.tag_edit(tag_id));
		}
	}
	
	ctx.ware.flash.set(`malformed form`);
	return ctx.build_redirect(url_list.tag_list(), 'see_other');
};

const tag_display: Middleware<Data, 'GET', 'tag_id', SessionExport> = async ctx => {
	const tag_id = Number(ctx.extract.tag_id);

	const tag = await ctx.data.db.tag_get(tag_id);
	if (tag instanceof Err) {
		return undefined;
	}
	
	const dom = (
		<template.Base title={ tag.name } user={ ctx.ware.session.user() }>
			<h1>{ tag.name }</h1>

			<p>
				{ tag.description }
			</p>

			<a href={ url_list.tag_edit(tag_id) }>edit</a>
		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const tag_edit: Middleware<Data, 'GET', 'tag_id', FlashExport & SessionExport> = async ctx => {
	const flash = ctx.ware.flash.get();
	const flash_element = flash === null
		? null
		: <div>
			{ flash }
		</div>

	const tag_id = Number(ctx.extract.tag_id);

	const tag = await ctx.data.db.tag_get(tag_id);
	if (tag instanceof Err) {
		return ctx.build_response('not found', 'not_found', 'txt');
	}
	
	const dom = (
		<template.Base title={ tag.name } user={ ctx.ware.session.user() }>
			<h1>editing '{ tag.name }'</h1>

			{ flash_element }

			<a href={ `${ctx.url.origin}/tag/${tag_id}` }>back</a>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded">
				<input type="text" name="type" value="edit"></input>

				<input type="text" name="name" value={ tag.name }></input>
				<textarea type="text" name="description">{ tag.description }</textarea>
				<button type="submit">submit</button>
			</form>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded">
				<input type="hidden" name="type" value="action"></input>

				<button type="submit" name="action" value="delete">delete</button>
			</form>

		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const tag_edit_api: Middleware<Data, 'POST', 'tag_id', FlashExport> = async ctx => {
	const tag_id = Number(ctx.extract.tag_id);

	const form = await ctx.request.formData();
	
	const form_type = form.get('type');
	switch (form_type) {
		case 'edit': {
			const form_name = form.get('name');
			const form_description = form.get('description');

			if (
				form_name === null || typeof form_name !== 'string' ||
				form_description === null || typeof form_description !== 'string'
			) {
				ctx.ware.flash.set(`malformed form`);
				break;
			}

			const tag = await ctx.data.db.tag_get(tag_id);
			if (tag instanceof Err) {
				ctx.ware.flash.set(`not found`);
				break;
			}

			tag.name = form_name;
			tag.description = form_description.trim();

			const result = await ctx.data.db.tag_update(tag);
			if (result instanceof Err) {
				ctx.ware.flash.set(result.message);
				break;
			}
			
			ctx.ware.flash.set(`success`);
			break;
		}

		case 'action': {
			const form_action = form.get('action');

			if (form_action === null || typeof form_action !== 'string') {
				ctx.ware.flash.set(`malformed form`);
				break;
			}
			
			const tag = await ctx.data.db.tag_get(tag_id);
			if (tag instanceof Err) {
				ctx.ware.flash.set(`not found`);
				break;
			}

			if (form_action === 'delete') {
				const result = await ctx.data.db.tag_delete(tag.id);
				if (result instanceof Err) {
					ctx.ware.flash.set(result.message);
					break;
				}

				ctx.ware.flash.set(`success`);
				return ctx.build_redirect(url_list.tag_list());
			}

			ctx.ware.flash.set(`malformed form`);
			break;
		}

		default: {
			ctx.ware.flash.set(`malformed form`);
		}
	}

	return ctx.build_redirect(url_list.tag_edit(tag_id));
};

const tag = {
	tag_list,
	tag_list_api,

	tag_display,
	
	tag_edit,
	tag_edit_api,
};

export default tag;

