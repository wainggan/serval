
import { Router } from "../server/serve.ts";
import { DB } from "../db.ts";

import post from "./route.post.tsx";
import tag from "./route.tag.tsx";
import user from "./route.user.tsx";
import index from "./route.index.tsx";
import { flash_middleware } from "./route.util.flash.ts";
import url_list from "./url_list.ts";
import not_found from "./route.404.tsx";
import { session_middleware } from "./route.util.session.ts";

export type Data = {
	db: DB;
};

export const router = new Router<Data>();

router.set_404(not_found);

router.get(
	'/ping',
	async ctx => {
		return ctx.build_response(`ping`, 'ok', 'txt');
	},
);

router.get(
	'/content/:file',
	async ctx => {
		const dir = `./db/content/${ctx.extract.file}`;
		
		let file;
		try {
			file = await Deno.readFile(dir);
		}
		catch (_e: unknown) {
			return ctx.build_response('not found', 'not_found', 'txt');
		}

		const ext = ctx.extract.file.split('.').at(-1);
		if (ext === undefined) {
			throw new Error('unknown');
		}

		return ctx.build_response(file, 'ok', ext as Parameters<typeof ctx.build_response>[2]);
	},
);

router.get(url_list.index(), session_middleware, index.index);

router.get(url_list.post_list(), flash_middleware, session_middleware, post.post_list);
router.post(url_list.post_list(), flash_middleware, session_middleware, post.post_list_api);

router.get(url_list.post_display(':post_id'), flash_middleware, session_middleware, post.post_display);

router.get(url_list.post_edit(':post_id'), flash_middleware, session_middleware, post.post_edit);
router.post(url_list.post_edit(':post_id'), flash_middleware, post.post_edit_api);

router.get(url_list.tag_list(), flash_middleware, session_middleware, tag.tag_list);
router.post(url_list.tag_list(), flash_middleware, tag.tag_list_api);

router.get(url_list.tag_display(':tag_id'), flash_middleware, session_middleware, tag.tag_display);

router.get(url_list.tag_edit(':tag_id'), flash_middleware, session_middleware, tag.tag_edit);
router.post(url_list.tag_edit(':tag_id'), flash_middleware, tag.tag_edit_api);

router.get(url_list.user_list(), session_middleware, user.user_list);

router.get(url_list.user_login(), session_middleware, user.user_login);
router.post(url_list.user_login(), flash_middleware, session_middleware, user.user_login_api);
router.get(url_list.user_logout(), flash_middleware, session_middleware, user.user_logout);

router.get(url_list.user_display(':username'), session_middleware, user.user_display);

