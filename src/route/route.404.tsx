
import * as template from "./template.tsx";
import { Method, Middleware } from "../server/serve.types.ts";
import { jsx } from "../html/jsx.ts";
import { render } from "../html/html.ts";

const not_found: Middleware<{}, Method, never> = async ctx => {
	const dom = (
		<template.Base title="404" user={ null }>
			<h1>404 : not found</h1>
		</template.Base>
	);

	const str = render(dom);

	return ctx.build_response(str, 'not_found', 'html');
};

export default not_found;

