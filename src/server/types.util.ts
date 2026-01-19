
// deno-lint-ignore-file no-explicit-any ban-types

import { Middleware } from "./serve.types.ts";

type SplitUrl<T extends `/${string}`> =
	T extends `/${infer Part}/${infer Rest}`
		? [Part, ...SplitUrl<`/${Rest}`>]
		: T extends `/${infer Part}`
			? [Part]
			: never;
type UrlParameters<T> =
	T extends `:${infer Inner}` ? Inner : never;

export type ExtractUrl<T extends `/${string}`> = UrlParameters<SplitUrl<T>[number]>;

type Modify<T, U> = Omit<T, keyof U> & U;

type CheckFlowIter<T extends readonly [{}, {}][], Return> =
	T extends readonly [infer Left, infer Right, ...infer Rest]
		? Left extends [infer _LeftFrom, infer LeftInto]
			? Right extends [infer RightFrom, infer RightInto]
				? LeftInto extends RightFrom
					// @ts-ignore: this is correct
					? CheckFlowIter<[[{}, Modify<LeftInto, RightInto>], ...Rest], Return>
					: never
				: never
			: never
		: Return;
	
export type CheckFlow<T extends readonly [{}, {}][], Return> = CheckFlowIter<[[{}, {}], ...T], Return>;

export type MiddlewareToFlow<T extends readonly Middleware<any, any, any, any, any>[]> =
	{
		[key in keyof T]: T[key] extends Middleware<any, any, any, infer Import, infer Export>
			? [Import, Export]
			: never;
	};
