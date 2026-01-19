
import * as html from "./html.ts";
import { jsx, fragment } from "./jsx.ts";

export const Html = (
	{
		title,
	}: {
		title: string;
	},
	children: html.Element[],
) => {
	return (
		<>
			{ `<!doctype html>` }
			<html lang="en">
			<head>
				<meta charset="utf-8"/>
				<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
				<title>{ title }</title>
			</head>
			<body>
				<div class="wrapped">
					{ ...children }
				</div>
			</body>
			</html>
		</>
	);
};

export const Navigation = () => {
	return (
		<nav id="navigation">
			<ul>
				<li><a href="/">index</a></li>
				<li><a href="/post">posts</a></li>
				<li><a href="/tag">tags</a></li>
			</ul>
		</nav>
	);
};

export const Base = (
	{
		title,
	}: {
		title: string;
	},
	children: html.Element[],
) => {
	return (
		<Html title={ title }>
			<Navigation></Navigation>
			{ ...children }
		</Html>
	);
};

export const PageIndex = () => {
	return (
		<Base title="index">
			<h1>index</h1>
			<p>
				welcome
			</p>
		</Base>
	);
};

