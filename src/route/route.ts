
import { Router } from "./serve.ts";
import { DB } from "../db.ts";

import post from "./route.post.tsx";
import { flash_middleware } from "./route.util.flash.ts";

export type Data = {
	db: DB;
};

export const router = new Router<Data>();

router.get(
	'/ping',
	async (ctx) => {
		return ctx.build_response(`ping`, 'ok', 'txt');
	},
);

router.get(
	'/content/:file',
	async (ctx) => {
		const url = `./db/content/${ctx.extract.file}`;
		
		let file;
		try {
			file = await Deno.readFile(url);
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


router.get('/post', flash_middleware, post.post_list);
router.post('/post/__api', flash_middleware, post.post_list_api);

router.get('/post/:post_id', flash_middleware, post.post_display);

router.get('/post/:post_id/edit', flash_middleware, post.post_edit);
router.post('/post/:post_id/edit/__api/upload', flash_middleware, post.post_edit_api_file_upload);
router.post('/post/:post_id/edit/__api/meta', flash_middleware, post.post_edit_api_meta);
router.post('/post/:post_id/edit/__api/action', flash_middleware, post.post_edit_api_action);
router.post('/post/:post_id/edit/__api/delete/:file_id', flash_middleware, post.post_edit_api_file_delete);

router.get('/tag', flash_middleware, post.tag_list);
router.post('/tag/__api/new', flash_middleware, post.tag_list_api_new);

router.get('/tag/:tag_id', flash_middleware, post.tag_display);

router.get('/tag/:tag_id/edit', flash_middleware, post.tag_edit);
router.post('/tag/:tag_id/edit/__api/edit', flash_middleware, post.tag_edit_api_edit);

