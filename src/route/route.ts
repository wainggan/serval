
import { Router } from "../server/serve.ts";

import post from "./route.post.tsx";
import tag from "./route.tag.tsx";
import user from "./route.user.tsx";
import index from "./route.index.tsx";
import { flash_middleware } from "./route.util.flash.ts";
import link from "./link.ts";
import not_found from "./route.404.tsx";
import { session_middleware } from "./route.util.session.ts";
import { Err } from "../common.ts";
import { content_type_codes } from "../server/serve.types.ts";
import { Data } from "./route.types.ts";

export const router = new Router<Data>();

router.set_404(not_found);

router.set_static(
	async ctx => {
		const parts = ctx.url_parts.slice(1);
		const path = parts.values()
			.filter(x => x !== '..' && x !== '.')
			.reduce((acc, x) => acc + '/' + x, '.');
		
		let file;
		try {
			file = await Deno.readFile(path);
		}
		catch (_e: unknown) {
			return undefined;
		}

		const ext = path.split('.').at(-1);
		if (ext === undefined || !(ext in content_type_codes)) {
			throw new Error(`invalid file type: ${ext}`);
		}

		return ctx.build_response(file, 'ok', ext as keyof typeof content_type_codes);
	},
);

router.get(
	'/ping',
	async ctx => {
		return ctx.build_response(`ping`, 'ok', 'txt');
	},
);

router.get(
	link.content(':file'),
	async ctx => {
		const file_db = await ctx.data.db.file_get_name(ctx.extract.file);
		if (file_db instanceof Err) {
			return ctx.build_response('not found', 'not_found', 'txt');
		}

		const dir = `./db/content/${file_db.file_name}.${file_db.file_type}`;
		
		let file;
		try {
			file = await Deno.readFile(dir);
		}
		catch (_e: unknown) {
			return ctx.build_response('not found', 'not_found', 'txt');
		}

		if (!(file_db.file_type in content_type_codes)) {
			throw new Error('unknown');
		}

		return ctx.build_response(file, 'ok', file_db.file_type as keyof typeof content_type_codes);
	},
);

router.get(link.index(), session_middleware, index.index);

router.get(link.post_list(), flash_middleware, session_middleware, post.post_list);
router.post(link.post_list(), flash_middleware, session_middleware, post.post_list_api);

router.get(link.post_display(':post_id'), flash_middleware, session_middleware, post.post_display);

router.get(link.post_edit(':post_id'), flash_middleware, session_middleware, post.post_edit);
router.post(link.post_edit(':post_id'), flash_middleware, post.post_edit_api);

router.get(link.tag_list(), flash_middleware, session_middleware, tag.tag_list);
router.post(link.tag_list(), flash_middleware, tag.tag_list_api);

router.get(link.tag_display(':tag_id'), flash_middleware, session_middleware, tag.tag_display);

router.get(link.tag_edit(':tag_id'), flash_middleware, session_middleware, tag.tag_edit);
router.post(link.tag_edit(':tag_id'), flash_middleware, tag.tag_edit_api);

router.get(link.user_list(), session_middleware, user.user_list);

router.get(link.user_login(), flash_middleware, session_middleware, user.user_login);
router.post(link.user_login(), flash_middleware, session_middleware, user.user_login_api);
router.get(link.user_logout(), flash_middleware, session_middleware, user.user_logout);

router.get(link.user_display(':username'), session_middleware, user.user_display);
router.get(link.user_edit(':username'), flash_middleware, session_middleware, user.user_edit);

