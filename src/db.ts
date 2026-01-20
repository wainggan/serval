
import { DatabaseSync, StatementSync } from "node:sqlite";
import { content_type_codes } from "./server/serve.types.ts";

export type Post = {
	id: number;
	subject: string;
	content: string;
};

export type Tag = {
	readonly id: number;
	name: string;
	description: string;
};

export class Err<Type> {
	constructor(type: Type, message: string) {
		this.type = type;
		this.message = message;
	}

	readonly type: Type;
	readonly message: string;

	toError(): Error {
		return new Error(this.toString());
	}

	toString() {
		return `error (${this.type}) ${this.message}`;
	}
}

type DBError =
	| 'unknown'
	| 'not_found'
	| 'exists';

export interface DB {
	/**
	creates a new, blank post, and returns its id.
	*/
	post_new(): Promise<number>;
	
	post_del(post_id: number): Promise<null>;

	/**
	returns post's data.
	*/
	post_get(post_id: number): Promise<Post | Err<DBError>>;

	post_set(post: Post): Promise<null | Err<DBError>>;

	/**
	returns a slice of posts with a given list of tags.
	an empty array will return all posts.
	*/
	post_list(
		search: string[],
		limit: number,
		offset: number,
	): Promise<Post[]>;

	/**
	returns a list of file ids pointing to a post.
	use with `file_url()`.
	*/
	post_files(post_id: number): Promise<number[]>;

	/**
	creates a new file pointing to a post, and
	returns its id.
	*/
	file_add(
		post_id: number,
		type: keyof typeof content_type_codes,
		file: Uint8Array<ArrayBuffer>,
	): Promise<number | Err<'exists'>>;

	/**
	deletes a file.
	*/
	file_del(file_id: number): Promise<null | Err<DBError>>;
	
	/**
	gets a valid url for retrieving a file, and
	the file's content type.
	*/
	file_url(file_id: number):
		Promise<[string, keyof typeof content_type_codes] | Err<DBError>>;

	/**
	creates a new tag.
	*/
	tag_new(name: string): Promise<number | Err<DBError>>;
	
	tag_get(tag_id: number): Promise<Tag | Err<DBError>>;
	tag_set(tag: Tag): Promise<null | Err<DBError>>;
	tag_resolve(names: string[]): Promise<Tag[]>;

	tag_list(
		search: string,
		limit: number,
		offset: number,
	): Promise<Tag[]>;

	tagged_from_post(post_id: number): Promise<Tag[]>;
	tagged_from_tag(tag_id: number): Promise<Post[]>;

	tagged_into_post(post_id: number, tag_id_list: number[]): Promise<null>;
}

export class SqlDB implements DB {
	constructor(dir: string) {
		this.dir = dir;

		this.db = new DatabaseSync(dir + `/data.sql`);

		this.db.exec(`
			PRAGMA foriegn_keys = ON;

			CREATE TABLE IF NOT EXISTS posts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				subject TEXT NOT NULL,
				content TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS files (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				post_id INTEGER NOT NULL,
				file_name TEXT NOT NULL UNIQUE,
				file_type TEXT NOT NULL,
				FOREIGN KEY (post_id) REFERENCES posts(id)
			);

			CREATE TABLE IF NOT EXISTS tags (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL UNIQUE,
				description TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS tagged (
				post_id INTEGER NOT NULL,
				tag_id INTEGER NOT NULL,
				PRIMARY KEY (post_id, tag_id),
				FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
				FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_tagged_post ON tagged(post_id);
			CREATE INDEX IF NOT EXISTS idx_tagged_tag ON tagged(tag_id);
		`);

		this.#_statement_cache = new Map();
	}

	private dir: string;

	private db: DatabaseSync;

	#_statement_cache: Map<string, StatementSync>;
	
	#_statement_run(str: string): StatementSync {
		const cached = this.#_statement_cache.get(str);

		if (cached !== undefined) {
			return cached;
		}

		const statement = this.db.prepare(str);

		this.#_statement_cache.set(str, statement);
		
		return statement;
	}

	#_statement_uncache(str: string): StatementSync {
		return this.db.prepare(str);
	}

	async post_new(): Promise<number> {
		const result = this.#_statement_run(`
			INSERT INTO posts
				(subject, content)
			VALUES
				(?, ?);
		`).run("no subject", "blank");
		return result.lastInsertRowid as number;
	}

	async post_del(post_id: number): Promise<null> {
		this.#_statement_run(`
			DELETE FROM posts
			WHERE id = (?);
		`).run(post_id);

		return null;
	}

	async post_get(post_id: number): Promise<Post | Err<'not_found'>> {
		const result = this.#_statement_run(`
			SELECT * FROM posts
			WHERE id = (?);
		`).get(post_id);

		if (result === undefined) {
			return new Err('not_found', `file '${post_id}' not found`);
		}
		
		return result as Post;
	}

	async post_set(post: Post): Promise<null | Err<DBError>> {
		this.#_statement_run(`
			UPDATE posts
			SET
				subject = (?),
				content = (?)
			WHERE
				id = (?)
		`).run(post.subject, post.content, post.id);

		return null;
	}

	async post_files(post_id: number): Promise<number[]> {
		const result = this.#_statement_run(`
			SELECT id FROM files
			WHERE post_id = (?);
		`).all(post_id);
		return result.map(x => x['id'] as number);
	}

	async post_list(tags: string[], limit: number, offset: number): Promise<Post[]> {
		let list = ``;
		for (let i = 0, len = tags.length; i < len; i++) {
			list += '?';
			if (i !== len - 1) {
				list += ',';
			}
		}
		
		if (list === '') {
			return this.#_statement_run(`
				SELECT * FROM posts
				LIMIT (?) OFFSET (?);
			`).all(limit, offset) as Post[];
		}

		const result = this.#_statement_uncache(`
			SELECT posts.* FROM posts
			JOIN tagged ON posts.id = tagged.post_id
			JOIN tags ON tags.id = tagged.tag_id
			WHERE tags.name IN (${list})
			GROUP BY posts.id
			HAVING COUNT(DISTINCT tags.name) = ${tags.length}
			LIMIT (?) OFFSET (?);
		`).all(...tags, limit, offset);

		return result as Post[];
	}

	async file_add(
		post_id: number,
		type: keyof typeof content_type_codes,
		file: Uint8Array<ArrayBuffer>,
	): Promise<number | Err<'exists'>> {
		const hash = new Uint8Array(await crypto.subtle.digest('sha-256', file));
		const hash_str = hash.toHex();
		const hash_str_url = `${this.dir}/content/${hash_str}.${type}`;

		using target = await Deno.create(hash_str_url);
		const writer = target.writable.getWriter();
		await writer.write(file);
		writer.close();

		let result;
		
		try {
			result = this.#_statement_run(`
				INSERT INTO files
					(post_id, file_name, file_type)
				VALUES
					(?, ?, ?);
			`).run(post_id, hash_str, type);
		}
		catch (_e) {
			return new Err('exists', `file already exists!`);
		}

		return result.lastInsertRowid as number;
	}

	async file_del(file_id: number): Promise<null | Err<'not_found'>> {
		const result = await this.file_url(file_id);

		if (result instanceof Err) {
			return result;
		}

		try {
			await Deno.remove(`${this.dir}${result[0]}`);
		}
		catch (_e) {
			return new Err('not_found', `internal file missing`);
		}

		this.#_statement_run(`
			DELETE FROM files
			WHERE id = (?);
		`).run(file_id);

		return null;
	}

	async file_url(file_id: number):
		Promise<[string, keyof typeof content_type_codes] | Err<'not_found'>>
	{
		const result = this.#_statement_run(`
			SELECT file_name, file_type FROM files
			WHERE id = (?);
		`).get(file_id);

		if (result === undefined) {
			return new Err('not_found', `file '${file_id}' not found`);
		}

		const file_name = result['file_name'] as string;
		const file_type = result['file_type'] as keyof typeof content_type_codes;

		return [
			`/content/${file_name}.${file_type}`,
			file_type,
		];
	}

	async post_get_tags(id: number): Promise<Tag[]> {
		const result = this.#_statement_run(`
			SELECT * FROM tags
			JOIN tagged ON tags.id = tagged.tag_id
			WHERE tagged.post_id = (?)
		`).all(id);

		return result as Tag[];
	}

	async tag_new(name: string): Promise<number | Err<'exists'>> {
		let result;
		try {
			result = this.#_statement_run(`
				INSERT INTO tags
					(name, description)
				VALUES
					(?, ?);
			`).run(name, "");
		}
		catch (_e) {
			return new Err('exists', `tag '${name}' already exists`);
		}

		return result.lastInsertRowid as number;
	}

	async tag_resolve(names: string[]): Promise<Tag[]> {
		const list = names.map(_x => '?').join(', ');
		
		// okay to cache
		const result = this.#_statement_run(`
			SELECT * FROM tags
			WHERE name in (${list});
		`).all(...names);

		return result as Tag[];
	}

	async tag_get(tag_id: number): Promise<Tag | Err<'not_found'>> {
		const result = this.#_statement_run(`
			SELECT * FROM tags
			WHERE id = (?);
		`).get(tag_id);

		if (result === undefined) {
			return new Err('not_found', `tag '${tag_id}' not found`);
		}

		return result as Tag;
	}

	async tag_set(tag: Tag): Promise<null | Err<DBError>> {
		try {
			this.#_statement_run(`
				UPDATE tags
				SET
					name = (?),
					description = (?)
				WHERE
					id = (?)
			`).run(tag.name, tag.description, tag.id);
		}
		catch (_e) {
			return new Err('exists', `tag '${tag.name}' already exists`);
		}

		return null;
	}

	async tag_list(like: string, limit: number, offset: number):
		Promise<Tag[]>
	{
		const result = this.#_statement_run(`
			SELECT * FROM tags
			WHERE name LIKE '%' || (?) || '%'
			LIMIT (?) OFFSET (?);
		`).all(like, limit, offset);

		return result as Tag[];
	}

	async tagged_from_post(post_id: number): Promise<Tag[]> {
		const result = this.#_statement_run(`
			SELECT * FROM tags
			JOIN tagged ON tags.id = tagged.tag_id
			WHERE tagged.post_id = (?);
		`).all(post_id);

		return result as Tag[];
	}

	async tagged_from_tag(tag_id: number): Promise<Post[]> {
		const result = this.#_statement_run(`
			SELECT * FROM posts
			JOIN tagged ON posts.id = tagged.post_id
			WHERE tagged.tag_id = (?);
		`).all(tag_id);

		return result as Post[];
	}

	async tagged_into_post(post_id: number, tag_id_list: number[]): Promise<null> {
		const result_current_tags = this.#_statement_run(`
			SELECT tag_id FROM tagged
			WHERE post_id = (?);
		`).all(post_id).map(x => x['tag_id']) as number[];

		const tags_old = new Set(result_current_tags);
		const tags_new = new Set(tag_id_list);

		const to_del = tags_old.difference(tags_new);
		const to_add = tags_new.difference(tags_old);

		const insert_del_list = to_del.values().map(_x => '?').toArray().join(', ');
		const insert_add_list = to_add.values().map(_x => '(?, ?)').toArray().join(', ');

		const pass_add = to_add.values().flatMap(x => [post_id, x]);

		if (to_del.size !== 0) {
			this.#_statement_uncache(`
				DELETE FROM tagged
				WHERE post_id = (?)
				AND tag_id IN (${insert_del_list});
			`).run(
				post_id,
				...to_del,
			);
		}

		if (to_add.size !== 0) {
			this.#_statement_uncache(`
				INSERT INTO tagged
				(post_id, tag_id)
				VALUES ${insert_add_list};
			`).run(
				...pass_add,
			);
		}

		return null;
	}
}

