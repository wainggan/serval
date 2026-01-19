
import * as types from "./serve.types.ts";
import * as types_util from "./types.util.ts";

type Template =
	| {
		self: 'string';
		inner: string;
	}
	| {
		self: 'query';
		inner: string;
	};

const util_path_to_template = (path: string): Template[] => {
	const template: Template[] = [];
	
	const parts = path.split('/');
	
	for (const p of parts) {
		if (p.startsWith(':')) {
			template.push({
				self: 'query',
				inner: p.substring(1),
			});
		}
		else {
			template.push({
				self: 'string',
				inner: p,
			});
		}
	}

	return template;
};

const util_template_validate = (base: Template[], to: string[]):
	{ [key: string]: string; } | null =>
{
	if (base.length != to.length) {
		return null;
	}

	const obj: Record<string, string> = {};

	for (let i = 0; i < base.length; i++) {
		const x = base[i];
		const y = to[i];
		if (x.self == 'string' && x.inner != y) {
			return null;
		}
		if (x.self == 'query') {
			obj[x.inner] = y;
		}
	}

	return obj;
};

export class Router<Data> {
	private inner: {
		[key in types.Method]: {
			template: Template[];
			middleware: types.Middleware<Data, key, string, {}, {}>[];
		}[];
	} = {
		'GET': [],
		'HEAD': [],
		'POST': [],
		'PUT': [],
		'DELETE': [],
		'CONNECT': [],
		'OPTIONS': [],
		'TRACE': [],
	};
	
	add<
		M extends types.Method,
		T extends `/${string}`,
		// deno-lint-ignore no-explicit-any
		const U extends types.Middleware<Data, M, types_util.ExtractUrl<T>, any, any>[],
	>(
		method: M,
		match: T,
		middleware: types_util.CheckFlow<types_util.MiddlewareToFlow<U>, U>,
	): this {
		const template = util_path_to_template(match);

		this.inner[method].push({
			template,
			middleware,
		});

		return this;
	}

	get<
		T extends `/${string}`,
		// deno-lint-ignore no-explicit-any
		const U extends types.Middleware<Data, 'GET', types_util.ExtractUrl<T>, any, any>[],
	>(
		match: T,
		...middleware: types_util.CheckFlow<types_util.MiddlewareToFlow<U>, U>
	) {
		this.add('GET', match, middleware);
	}

	post<
		T extends `/${string}`,
		// deno-lint-ignore no-explicit-any
		const U extends types.Middleware<Data, 'POST', types_util.ExtractUrl<T>, any, any>[],
	>(
		match: T,
		...middleware: types_util.CheckFlow<types_util.MiddlewareToFlow<U>, U>
	) {
		this.add('POST', match, middleware);
	}

	put<
		T extends `/${string}`,
		// deno-lint-ignore no-explicit-any
		const U extends types.Middleware<Data, 'PUT', types_util.ExtractUrl<T>, any, any>[],
	>(
		match: T,
		...middleware: types_util.CheckFlow<types_util.MiddlewareToFlow<U>, U>
	) {
		this.add('PUT', match, middleware);
	}

	delete<
		T extends `/${string}`,
		// deno-lint-ignore no-explicit-any
		const U extends types.Middleware<Data, 'DELETE', types_util.ExtractUrl<T>, any, any>[],
	>(
		match: T,
		...middleware: types_util.CheckFlow<types_util.MiddlewareToFlow<U>, U>
	) {
		this.add('DELETE', match, middleware);
	}

	async resolve(request: Request, data: Data): Promise<Response> {
		const url = new URL(request.url);

		const parts = url.pathname.split('/');
		
		const method = request.method as types.Method;

		const method_select = this.inner[method];
		if (method_select === undefined) {
			return new Response(`error: ${types.status_codes.not_implemented}`);
		}

		for (const select of method_select) {
			const extract = util_template_validate(select.template, parts);
			if (extract === null) {
				continue;
			}

			const middleware_iter = select.middleware.values();

			// deno-lint-ignore no-explicit-any
			const context: types.Context<Data, typeof method, string, any, any> = {
				build_response(content, status, content_type, headers = new Headers()) {
					headers.set('Content-Type', `${types.content_type_codes[content_type]};charset=utf-8`);
					const response = new Response(
						content,
						{
							status: types.status_codes[status],
							headers,
						},
					);
					return response;
				},
				build_redirect(url, status = 'see_other', headers = new Headers()) {
					const str = typeof url === 'string' ? url : url.href;
					headers.set('Location', str);
					return new Response(
						null,
						{
							status: types.status_codes[status],
							headers,
						},
					);
				},

				async next() {
					const value = middleware_iter.next();
					if (value.done !== undefined && !value.done) {
						// deno-lint-ignore no-explicit-any
						return (value.value as types.Middleware<Data, typeof method, string, any, any>)(this);
					}
					else {
						return undefined;
					}
				},

				url,
				query_url(name) {
					return url.searchParams.get(name) ?? undefined;
				},

				method,
				request,

				extract,
				data,
				ware: {},
			};

			const response = await context.next();

			if (response !== undefined) {
				return response;
			}

			throw new Error(`no response given`);
		}

		return new Response(`error: ${types.status_codes.not_found}`);
	}
}

export const response_handler = <Data>(config: {
	data: Data;
	route: Router<Data>;
	stdio: boolean;
}) => async (request: Request): Promise<Response> => {
	if (config.stdio) {
		console.log(request.url);
	}
	return await config.route.resolve(request, config.data);
};

