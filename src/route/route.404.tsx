
import * as template from "../template/template.tsx";
import { jsx } from "../template/jsx.ts";
import { Method, Middleware } from "../server/serve.types.ts";
import { render } from "../template/html.ts";

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

