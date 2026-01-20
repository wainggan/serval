
import { User } from "../db.ts";
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

export const Navigation = (
	{
		user,
	}: {
		user: User | null,
	}
) => {
	return (
		<nav id="navigation">
			<ul>
				<li><a href="/">index</a></li>
				<li><a href="/post">posts</a></li>
				<li><a href="/tag">tags</a></li>
				<li><a href="/user">users</a></li>
				{
					user === null
						? <>
							<li><a href="/user/login">login</a></li>
						</>
						: null
				}
			</ul>
		</nav>
	);
};

export const Base = (
	{
		title,
		user,
	}: {
		title: string;
		user: User | null;
	},
	children: html.Element[],
) => {
	return (
		<Html title={ title }>
			<Navigation user={ user }></Navigation>
			{ ...children }
		</Html>
	);
};

