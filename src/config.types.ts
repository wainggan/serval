/*
this file exports `Config`, which is used to type check the config exported in this project's `config.ts`.
*/

import { content_type_codes } from "./server/serve.types.ts";

type Config = {
	db_path: string;
	port: number;
	permission: {};
	allowed_content: {
		[key in keyof typeof content_type_codes]: boolean;
	};
};

export default Config;

