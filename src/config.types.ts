
import { content_type_codes } from "./server/serve.types.ts";

type Config = {
	db_path: string;
	port: number;
	allowed_content: {
		[key in keyof typeof content_type_codes]: boolean;
	};
};

export default Config;

