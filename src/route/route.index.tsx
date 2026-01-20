import { Middleware } from "../server/serve.types.ts";
import { Data } from "./route.ts";
import { jsx } from "../template/jsx.ts";
import * as template from "../template/template.tsx";
import { SessionExport } from "./route.util.session.ts";
import { render } from "../template/html.ts";

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
