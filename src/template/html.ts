
type Attribute = {
	class?: string;
	id?: string;
	// deno-lint-ignore no-explicit-any
	[key: string]: any;
};

export type Element<A extends Attribute = Attribute> = {
	tag:
		| string
		| typeof Fragment
		| ((args: A, children: (Element | string)[]) => Element);
	attributes: A;
	children: (Element | string)[];
};

type AttributeHtml = Attribute & {
	lang: string;
};
export type ElementHtml = Element<AttributeHtml>;

type AttributeHead = Attribute;
export type ElementHead = Element<AttributeHead>;

type AttributeBody = Attribute;
export type ElementBody = Element<AttributeBody>;

type AttributeMeta = Attribute & (
	| {
		charset: "utf-8";
	}
	| {
		name: "viewport";
		content: "width=device-width,initial-scale=1.0";
	}
);
export type ElementMeta = Element<AttributeMeta>;

export type ElementTitle = Element;

export type ElementDiv = Element;
export type ElementSpan = Element;

export type ElementH1 = Element;
export type ElementH2 = Element;
export type ElementH3 = Element;
export type ElementH4 = Element;
export type ElementH5 = Element;
export type ElementH6 = Element;

export type ElementP = Element;

export type ElementUl = Element;
export type ElementOl = Element;
export type ElementLi = Element;

export type ElementButton = Element;
export type ElementNav = Element;

type AttributeA = Attribute & {
	href: string;
};
export type ElementA = Element<AttributeA>;

type AttributeImg = Attribute & {
	src: string;
};
export type ElementImg = Element<AttributeImg>;

type AttributeForm = Attribute & {
	action: string;
	method: 'get' | 'post' | 'dialog';
	enctype:
		| 'application/x-www-form-urlencoded'
		| 'multipart/form-data'
		| 'text/plain'
};
export type ElementForm = Element<AttributeForm>;

type AttributeInput = Attribute & {
	form?: string;
	disabled?: boolean;
	value?: string;
	name?: string;
} & (
	| {
		type: 'hidden';
		name: string;
		value: string;
	}
	| {
		type: 'button';
		value: string;
	}
	| {
		type: 'checkbox';
		checked: boolean;
		value: string;
	}
	| {
		type: 'file';
		accept?: string;
		multiple?: boolean;
	}
	| {
		type: 'text';
		maxlength?: string;
		minlength?: string;
	}
);
export type ElementInput = Element<AttributeInput>;

type AttributeTextarea = Attribute & {
	autocapitalize?:
		| 'none'
		| 'off'
		| 'sentences'
		| 'on'
		| 'words'
		| 'characters';
	autocomplete?:
		| 'off'
		| 'on';
	autocorrect?:
		| 'off'
		| 'on';
	spellcheck?:
		| 'true'
		| 'default'
		| 'false';
	autofocus?: boolean;
	cols?: string;
	rows?: string;
	disabled?: boolean;
	form?: string;
	maxlength?: string;
	minlength?: string;
	name?: string;
	placeholder?: string;
	readonly?: boolean;
	required?: boolean;
	wrap?:
		| 'hard'
		| 'soft';
};
export type ElementTextarea = Element<AttributeTextarea>;

export interface ElementMap {
	html: ElementHtml;
	head: ElementHead;
	body: ElementBody;
	meta: ElementMeta;
	title: ElementTitle;
	div: ElementDiv;
	span: ElementSpan;
	h1: ElementH1;
	h2: ElementH2;
	h3: ElementH3;
	h4: ElementH4;
	h5: ElementH5;
	h6: ElementH6;
	ul: ElementUl;
	ol: ElementOl;
	li: ElementLi;
	p: ElementP;
	img: ElementImg;
	a: ElementA;
	button: ElementButton;
	nav: ElementNav;
	form: ElementForm;
	input: ElementInput;
	textarea: ElementTextarea;
}

type Construct = {
	<T extends keyof ElementMap>(
		tag: T,
		attributes: ElementMap[T]['attributes'],
		children: (Element | string)[],
	): ElementMap[T];
	<F extends (args: P, children: Element[]) => Element, const P>(
		tag: F,
		attributes: P,
		children: (Element | string)[],
	): Element;
	(
		tag: typeof Fragment,
		attributes: null,
		children: (Element | string)[],
	): Element;
};

export const element: Construct = (
	tag: unknown,
	attributes: null | Record<string, string>,
	children: (Element | string)[],
): Element => {
	// console.log('element:', tag, attributes, children);
	return {
		tag,
		attributes: attributes ?? {},
		children,
	} as unknown as ReturnType<typeof element>;
};

export const Fragment = Symbol('fragment');

export const render = (element: Element): string => {
	// console.log('render:', element);
	if (typeof element.tag == 'function') {
		return render(element.tag(element.attributes, element.children));
	}
	else {
		let str = ``;

		if (element.tag !== Fragment) {
			str += `<`;
			str += element.tag;

			for (const attr in element.attributes) {
				str += ` `;
				str += attr;
				
				const value = element.attributes[attr as keyof typeof element.attributes];
				
				if (typeof value === 'boolean') {
					// do nothing
				}
				else {
					str += `="`;
					str += value;
					str += `"`;
				}
			}

			str += `>`;
		}

		for (const child of element.children) {
			if (child === undefined || child === null) {
				continue;
			}
			else if (typeof child == 'object') {
				str += render(child);
			}
			else {
				str += child;
			}
			str += ` `;
		}

		if (element.tag !== Fragment) {
			str += `</`;
			str += element.tag;
			str += `>`;
		}

		return str;
	}
};

