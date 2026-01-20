const config: import("./src/config.types.ts").default = {
	db_path: "./db",
	port: 8000,
	permission: {},
	allowed_content: {
		txt: false,
		css: false,
		html: false,
		js: false,
		json: false,
		png: false,
		jpg: false,
		gif: false,
		webp: false,
	},
};

export default config;
