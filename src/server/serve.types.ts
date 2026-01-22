
export const status_codes = {
	'ok': 200,
	'created': 201,
	'accepted': 202,
	'moved_permanently': 301,
	'found': 302,
	'see_other': 303,
	'not_modified': 304,
	'temporary_redirect': 307,
	'permanent_redirect': 308,
	'bad_request': 400,
	'unauthorized': 401,
	'forbidden': 403,
	'not_found': 404,
	'timeout': 408,
	'teapot': 418,
	'internal_error': 500,
	'not_implemented': 501,
	'bad_gateway': 502,
	'service_unavailable': 503,
} as const;

export const content_type_codes = {
	'txt': 'text/plain',
	'css': 'text/css',
	'html': 'text/html',
	'js': 'text/javascript',
	'json': 'application/json',
	'png': 'image/png',
	'jpg': 'image/jpeg',
	'gif': 'image/gif',
	'webp': 'image/webp',
} as const;

export const content_type_codes_inv =
	Object.fromEntries(
		Object.entries(content_type_codes)
			.map(([k, v]) => [v, k]),
	) as {
		[key in keyof typeof content_type_codes as typeof content_type_codes[key]]: key
	};

export type Method =
	| 'GET'
	| 'HEAD'
	| 'POST'
	| 'PUT'
	| 'DELETE'
	| 'CONNECT'
	| 'OPTIONS'
	| 'TRACE';

export type Context<
	Data,
	Mthd extends Method,
	Extract extends string,
	Import extends {} = {},
	Export extends {} = {},
> = {
	readonly build_response: (
		content: ConstructorParameters<typeof Response>[0],
		status: keyof typeof status_codes,
		content_type: keyof typeof content_type_codes,
	) => Response;
	readonly build_redirect: (
		url: URL | string,
		status?: keyof typeof status_codes,
		headers?: Headers,
	) => Response;

	readonly next: () => Promise<Response | undefined>;
	
	readonly url_parts: readonly string[];
	readonly url: URL;
	readonly query_url: (name: string) => string | undefined;
	
	readonly method: Mthd;
	readonly request: Request;

	readonly data: Readonly<Data>;
	readonly extract: {
		readonly [key in Extract]: string;
	};
	readonly ware: Import & Partial<Export>;
};

export type Middleware<
	Data,
	Mthd extends Method,
	Extract extends string,
	Import extends {} = {},
	Export extends {} = {},
> = (ctx: Readonly<Context<Data, Mthd, Extract, Import, Export>>) =>
	Promise<Response | undefined>;

