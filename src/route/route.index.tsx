
import { Middleware } from "../server/serve.types.ts";
import { render } from "../html/html.ts";
import { jsx } from "../html/jsx.ts";
import * as template from "./template.tsx";
import { SessionExport } from "./route.util.session.ts";
import { Data } from "./route.types.ts";

const index: Middleware<Data, 'GET', never, SessionExport> = async ctx => {
	const dom = (
		<template.Base title="index" user={ ctx.ware.session.user() }>
			<h1>index</h1>
		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'ok', 'html');
};

export default {
	index,
} as const;
