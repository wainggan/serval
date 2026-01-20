
import { Data } from "./route.ts";
import { Method, Middleware } from "../server/serve.types.ts";
import { User } from "../db.ts";
import { Err } from "../common.ts";

import * as std_cookie from "@std/http/cookie";

export type SessionExport = {
	session: {
		readonly user: () => User | null;
		readonly set: (session_id: string) => void;
	};
};

export const session_middleware: Middleware<Data, Method, never, {}, SessionExport> = async ctx => {
	const state: {
		session_id: null | string;
		session_id_new: null | string;
		session_id_logout: boolean;
		user: null | User;
	} = {
		session_id: null,
		session_id_new: null,
		session_id_logout: false,
		user: null,
	};

	const cookies = std_cookie.getCookies(ctx.request.headers);
	if ('session' in cookies) {
		const base64 = cookies['session'];
		const buffer = Uint8Array.fromBase64(base64);
		state.session_id = new TextDecoder().decode(buffer);
		console.log(state.session_id)
	}

	if (state.session_id !== null) {
		const user = await ctx.data.db.session_user(state.session_id);
		console.log(user)
		if (user instanceof Err) {
			state.session_id_logout = true;
		}
		else {
			state.user = user;
		}
	}

	ctx.ware.session = {
		user() {
			return state.user;
		},
		set(session_id) {
			state.session_id_new = session_id;
		},
	};

	const response = await ctx.next();
	if (response === undefined) {
		return undefined;
	}

	if (state.session_id_new !== null) {
		const buffer = new TextEncoder().encode(state.session_id_new);
		console.log(state.session_id_new)
		std_cookie.setCookie(response.headers, {
			name: 'session',
			value: buffer.toBase64(),
			path: '/',
			httpOnly: true,
			sameSite: 'Lax',
			// 14 days
			maxAge: 60 * 60 * 60 * 24 * 14,
			secure: true,
		});
	}
	else if (state.session_id_logout) {
		console.log('oops')
		std_cookie.deleteCookie(response.headers, 'session', {
			path: '/',
			httpOnly: true,
			secure: true,
		});
	}

	return response;
};




