
import * as html from "./html.ts";

declare global {
	namespace JSX {
		type Element = html.Element;
		type IntrinsicElements = {
			[key in keyof html.ElementMap]: html.ElementMap[key]['attributes'];
		};
	}
}

type Construct = {
	<T extends keyof html.ElementMap>(
		tag: T,
		attributes: html.ElementMap[T]['attributes'],
		...children: (html.Element | string)[]
	): html.ElementMap[T];
	<F extends (args: P, children: html.Element[]) => html.Element, const P>(
		tag: F,
		attributes: P,
		...children: (html.Element | string)[]
	): html.Element;
	(
		tag: typeof html.Fragment,
		attributes: null,
		...children: (html.Element | string)[]
	): html.Element;
};

export const jsx: Construct = (type: unknown, properties: unknown, ...children: unknown[]): html.Element => {
	// @ts-ignore: we need a little faith here
	return html.element(type, properties ?? {}, children);
};

export const fragment: typeof html.Fragment = html.Fragment;

