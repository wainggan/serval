
import { jsx, fragment } from "../html/jsx.ts";
import { Middleware } from "../server/serve.types.ts";
import * as template from "./template.tsx";
import { FlashExport } from "./route.util.flash.ts";
import { render } from "../html/html.ts";
import link from "./link.ts";
import { Err } from "../common.ts";
import { SessionExport } from "./route.util.session.ts";
import { Data } from "./route.types.ts";

const user_login: Middleware<Data, 'GET', never, FlashExport & SessionExport> = async ctx => {
	const dom = (
		<template.Base title="login" user={ ctx.ware.session.user() }>
			<h1>login</h1>

			<template.Flash message={ ctx.ware.flash.get() }/>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form">
				<input type="hidden" name="type" value="login"/>

				<input type="text" name="username"></input>
				<input type="password" name="password"></input>
				<button type="submit">login</button>
			</form>

			<h2>register</h2>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form">
				<input type="hidden" name="type" value="register"/>
				
				<input type="text" name="username"></input>
				<input type="password" name="password"></input>
				<input type="password" name="password-retype"></input>
				<button type="submit">register</button>
			</form>
		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const user_login_api: Middleware<Data, 'POST', never, FlashExport & SessionExport> = async ctx => {
	const form = await ctx.request.formData();

	const form_type = form.get('type');
	switch (form_type) {
		case 'login': {
			const form_username = form.get('username');
			const form_password = form.get('password');

			if (
				form_username === null || typeof form_username !== 'string' ||
				form_password === null || typeof form_password !== 'string'
			) {
				break;
			}

			const password_buffer = new TextEncoder().encode(form_password);
			const password_hash = new Uint8Array(await crypto.subtle.digest('sha-256', password_buffer));

			const user = await ctx.data.db.user_get_username(form_username);
			if (user instanceof Err) {
				throw user.toError();
			}

			let equal = true;
			for (let i = 0, len = password_hash.length; i < len; i++) {
				if (password_hash[i] !== user.password[i]) {
					equal = false;
					break;
				}
			}

			if (equal) {
				const session = await ctx.data.db.session_new(user.id);
				if (session instanceof Err) {
					throw session.toError();
				}

				ctx.ware.session.set(session);

				ctx.ware.flash.set(`successfully logged in!`);
				return ctx.build_redirect(link.user_display(user.username));
			} else {
				ctx.ware.flash.set(`incorrect password.`);
				break;
			}
		}

		case 'register': {
			const form_username = form.get('username');
			const form_password = form.get('password');
			const form_password_retype = form.get('password-retype');

			if (
				form_username === null || typeof form_username !== 'string' ||
				form_password === null || typeof form_password !== 'string' ||
				form_password_retype === null || typeof form_password_retype !== 'string'
			) {
				ctx.ware.flash.set(`malformed form`);
				break;
			}

			if (form_password !== form_password_retype) {
				ctx.ware.flash.set(`register: passwords don't match`);
				break;
			}

			const password_buffer = new TextEncoder().encode(form_password);
			const password_hash = await crypto.subtle.digest('sha-256', password_buffer);

			const user_id = await ctx.data.db.user_new(form_username, new Uint8Array(password_hash));
			if (user_id instanceof Err) {
				ctx.ware.flash.set(`register: username taken`);
				break;
			}

			const user = await ctx.data.db.user_get(user_id);
			if (user instanceof Err) {
				throw user.toError();
			}

			const user_count = await ctx.data.db.user_count();
			if (user_count instanceof Err) {
				throw user_count.toError();
			}
			if (user_count === 1) {
				user.permission = 0b11111111;
				const result = await ctx.data.db.user_update(user);
				if (result instanceof Err) {
					throw result.toError();
				}
			}

			break;
		}

		default: {
			ctx.ware.flash.set(`malformed form`);
		}
	}

	return ctx.build_redirect(link.user_login());
};

const user_logout: Middleware<Data, 'GET', never, FlashExport & SessionExport> = async ctx => {
	ctx.ware.session.logout();
	ctx.ware.flash.set(`successfully logged out!`);
	return ctx.build_redirect(link.index());
};

const user_list: Middleware<Data, 'GET', never, SessionExport> = async ctx => {
	const limit = 10;

	const offset = Number(ctx.query_url('offset') ?? '0');
	const like_str = ctx.query_url('q') ?? '';

	let users_element;

	const users = await ctx.data.db.user_search(like_str, limit, offset);
	if (users instanceof Err) {
		users_element = (
			<li>{ users.message }</li>
		);
	}
	else {
		users_element = (
			<>
			{
				...users
				.map(x =>
					<li><a href={ `/user/${x.username}` }>{ x.username }</a></li>
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
			<h1>user listing</h1>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form">
				<input type="hidden" name="type" value="new"/>
				<input type="text" name="name"></input>
				<button type="submit">new</button>
			</form>

			<ul>
				{ users_element }
			</ul>

			<a href={ url_back.href }>back</a>
			<a href={ url_forward.href }>next</a>
			
		</template.Base>
	);
	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const user_list_api: Middleware<Data, 'POST', never, FlashExport> = async ctx => {
	const form = await ctx.request.formData();

	const form_type = form.get('type');
	switch (form_type) {
		case 'new': {
			const name = form.get('name');
			if (name === null || typeof name !== 'string') {
				ctx.ware.flash.set(`malformed form`);
				return ctx.build_redirect(link.tag_list());
			}

			const tag_id = await ctx.data.db.tag_new(name);
			if (tag_id instanceof Err) {
				ctx.ware.flash.set(`tag '${name}' exists`);
				return ctx.build_redirect(link.tag_list());
			}

			return ctx.build_redirect(link.tag_edit(tag_id));
		}
	}
	
	ctx.ware.flash.set(`malformed form`);
	return ctx.build_redirect(link.tag_list(), 'see_other');
};

const user_display: Middleware<Data, 'GET', 'username', SessionExport> = async ctx => {
	const username = ctx.extract.username;

	const user = await ctx.data.db.user_get_username(username);
	if (user instanceof Err) {
		return undefined;
	}
	
	const dom = (
		<template.Base title={ user.username } user={ ctx.ware.session.user() }>
			<h1>{ user.username }</h1>

			<a href={ link.user_edit(username) }>edit</a>
		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const user_edit: Middleware<Data, 'GET', 'username', FlashExport & SessionExport> = async ctx => {
	const flash = ctx.ware.flash.get();
	const flash_element = flash === null
		? null
		: <div>
			{ flash }
		</div>

	const username = ctx.extract.username;

	const user = await ctx.data.db.user_get_username(username);
	if (user instanceof Err) {
		return ctx.build_response('not found', 'not_found', 'txt');
	}
	
	const dom = (
		<template.Base title={ user.username } user={ ctx.ware.session.user() }>
			<h1>editing '{ user.username }'</h1>

			{ flash_element }

			<a href={ `${ctx.url.origin}/tag/${username}` }>back</a>

			<form action="" method="post" target="_self" enctype="application/x-www-form-urlencoded" id="form">
				<input type="text" name="type" value="edit"></input>

				<input type="text" name="name" value={ user.username }></input>
				<input type="password" name="password"></input>
				<input type="password" name="password-retype"></input>
				<button type="submit">submit</button>
			</form>

		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

const user_edit_api: Middleware<Data, 'POST', 'tag_id', FlashExport> = async ctx => {
	const tag_id = Number(ctx.extract.tag_id);

	const form = await ctx.request.formData();
	
	const form_type = form.get('type');
	switch (form_type) {
		case 'edit': {
			const tag = await ctx.data.db.tag_get(tag_id);
			if (tag instanceof Err) {
				ctx.ware.flash.set(`not found`);
				return ctx.build_redirect(link.tag_edit(tag_id));
			}

			const form_name = form.get('name');
			const form_description = form.get('description');

			if (
				form_name === null || typeof form_name !== 'string' ||
				form_description === null || typeof form_description !== 'string'
			) {
				ctx.ware.flash.set(`malformed form`);
				return ctx.build_redirect(link.tag_edit(tag_id));
			}

			tag.name = form_name;
			tag.description = form_description.trim();

			const result = await ctx.data.db.tag_update(tag);
			if (result instanceof Err) {
				ctx.ware.flash.set(result.message);
				return ctx.build_redirect(link.tag_edit(tag_id));
			}
			
			ctx.ware.flash.set(`success`);
			return ctx.build_redirect(link.tag_edit(tag_id));
		}
	}

	ctx.ware.flash.set(`malformed form`);
	return ctx.build_redirect(link.tag_edit(tag_id));
};

export default {
	user_list,
	user_list_api,
	user_logout,

	user_login,
	user_login_api,

	user_display,

	user_edit,
	user_edit_api,
} as const;

