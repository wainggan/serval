
import { User } from "../db/db.types.ts";
import link from "./link.ts";
import * as html from "../html/html.ts";
import { jsx, fragment } from "../html/jsx.ts";

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
				<li><a href={ link.index() }>index</a></li>
				<li><a href={ link.post_list() }>posts</a></li>
				<li><a href={ link.tag_list() }>tags</a></li>
				<li><a href={ link.user_list() }>users</a></li>
				{
					user === null
						? <>
							<li><a href={ link.user_login() }>login</a></li>
						</>
						: <>
							<li><a href={ link.user_logout() }>logout</a></li>
						</>
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

export const Flash = (
	{
		message,
	}: {
		message: string | null
	},
) => {
	return message === null
		? <> </>
		: <>
			<div class="flash">
				{ message }
			</div>
		</>;
};

