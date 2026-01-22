
import { router } from "./route/route.ts";
import { response_handler } from "./server/serve.ts";

import config from "../config.ts";
import { SqlDB } from "./db/db.sql.ts";

await Deno.mkdir(config.db_path, { recursive: true });
await Deno.mkdir(config.db_path + `/content`, { recursive: true });

const db = new SqlDB(config.db_path);

Deno.serve(
	{
		port: config.port,
	},
	response_handler({
		route: router,
		data: {
			db,
		},
		stdio: true,
	}),
);

