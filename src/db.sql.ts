
import { DatabaseSync, StatementSync } from "node:sqlite";
import { Err } from "./common.ts";
import * as db from "./db.ts";
import { content_type_codes } from "./server/serve.types.ts";

export class SqlDB implements db.DB {
	constructor(dir: string) {
		this.dir = dir;

		this.db = new DatabaseSync(dir + `/data.sql`);

		this.db.exec(`
			PRAGMA foriegn_keys = ON;

			CREATE TABLE IF NOT EXISTS users (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				username TEXT NOT NULL UNIQUE,
				password BLOB NOT NULL,
				permission INTEGER NOT NULL
			);

			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				user_id INTEGER NOT NULL,
				date_expire INTEGER NUL NULL,
				FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
			);

			CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
			CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(date_expire);

			CREATE TABLE IF NOT EXISTS posts (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				user_id INTEGER NOT NULL,
				subject TEXT NOT NULL,
				content TEXT NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id)
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

	async post_new(user_id: number): Promise<number> {
		const result = this.#_statement_run(`
			INSERT INTO posts
				(user_id, subject, content)
			VALUES
				(?, ?, ?);
		`).run(user_id, "no subject", "blank");
		return result.lastInsertRowid as number;
	}

	async post_delete(post_id: number): Promise<null> {
		this.#_statement_run(`
			DELETE FROM posts
			WHERE id = (?);
		`).run(post_id);

		return null;
	}

	async post_get(post_id: number): Promise<db.Post | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM posts
			WHERE id = (?);
		`).get(post_id);

		if (result === undefined) {
			return new Err('not_found', `file '${post_id}' not found`);
		}
		
		return result as db.Post;
	}

	async post_update(post: db.Post): Promise<null | Err<db.DBError>> {
		this.#_statement_run(`
			UPDATE posts
			SET
				user_id = (?),
				subject = (?),
				content = (?)
			WHERE
				id = (?)
		`).run(post.user_id, post.subject, post.content, post.id);

		return null;
	}

	async post_files(post_id: number): Promise<number[]> {
		const result = this.#_statement_run(`
			SELECT id FROM files
			WHERE post_id = (?);
		`).all(post_id);
		return result.map(x => x['id'] as number);
	}

	async post_search(tags: string[], limit: number, offset: number): Promise<db.Post[]> {
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
			`).all(limit, offset) as db.Post[];
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

		return result as db.Post[];
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

	async file_delete(file_id: number): Promise<null | Err<db.DBError>> {
		const file = await this.file_get(file_id);
		if (file instanceof Err) {
			return file;
		}

		const result = await this.file_url(file);

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

	async file_update(file: db.File): Promise<null | Err<db.DBError>> {
		const result = this.#_statement_run(`
			UPDATE files
			SET
				post_id = (?)
			WHERE
				id = (?);

		`).run(file.post_id, file.id);
		result;
		return null;
	}

	async file_get(file_id: number): Promise<db.File | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM files
			WHERE id = (?);
		`).get(file_id);

		if (result === undefined) {
			return new Err('not_found', `file not found`);
		}

		return result as db.File;
	}

	async file_get_name(file_name: string): Promise<db.File | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM files
			WHERE file_name = (?);
		`).get(file_name);

		if (result === undefined) {
			return new Err('not_found', `file not found`);
		}

		return result as db.File;
	}

	async file_url(file: db.File):
		Promise<[string, keyof typeof content_type_codes] | Err<db.DBError>>
	{
		return [
			`/content/${file.file_name}.${file.file_type}`,
			file.file_type,
		];
	}

	async post_get_tags(id: number): Promise<db.Tag[] | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM tags
			JOIN tagged ON tags.id = tagged.tag_id
			WHERE tagged.post_id = (?)
		`).all(id);

		return result as db.Tag[];
	}

	async tag_new(name: string): Promise<number | Err<db.DBError>> {
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

	async tag_delete(tag_id: number): Promise<null | Err<db.DBError>> {
		this.#_statement_run(`
			DELETE FROM tags
			WHERE id = (?);
		`).run(tag_id);

		return null;
	}

	async tag_get_name(name: string): Promise<db.Tag | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM tags
			WHERE name = ?;
		`).get(name);

		if (result === undefined) {
			return new Err('not_found', `tag ${name} not found`);
		}

		return result as db.Tag;
	}

	async tag_get_name_list(names: string[]): Promise<db.Tag[] | Err<db.DBError>> {
		const list = names.map(_x => '?').join(', ');
		
		// okay to cache
		const result = this.#_statement_run(`
			SELECT * FROM tags
			WHERE name in (${list});
		`).all(...names);

		return result as db.Tag[];
	}

	async tag_get(tag_id: number): Promise<db.Tag | Err<'not_found'>> {
		const result = this.#_statement_run(`
			SELECT * FROM tags
			WHERE id = (?);
		`).get(tag_id);

		if (result === undefined) {
			return new Err('not_found', `tag '${tag_id}' not found`);
		}

		return result as db.Tag;
	}

	async tag_update(tag: db.Tag): Promise<null | Err<db.DBError>> {
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

	async tag_search(like: string, limit: number, offset: number):
		Promise<db.Tag[]>
	{
		const result = this.#_statement_run(`
			SELECT * FROM tags
			WHERE name LIKE '%' || (?) || '%'
			LIMIT (?) OFFSET (?);
		`).all(like, limit, offset);

		return result as db.Tag[];
	}

	async tagged_from_post(post_id: number): Promise<db.Tag[]> {
		const result = this.#_statement_run(`
			SELECT * FROM tags
			JOIN tagged ON tags.id = tagged.tag_id
			WHERE tagged.post_id = (?);
		`).all(post_id);

		return result as db.Tag[];
	}

	async tagged_from_tag(tag_id: number): Promise<db.Post[]> {
		const result = this.#_statement_run(`
			SELECT * FROM posts
			JOIN tagged ON posts.id = tagged.post_id
			WHERE tagged.tag_id = (?);
		`).all(tag_id);

		return result as db.Post[];
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

	async user_new(username: string, password: Uint8Array): Promise<number | Err<db.DBError>> {
		const result = this.#_statement_run(`
			INSERT INTO users
				(username, password, permission)
			VALUES
				(?, ?, ?);
		`).run(username, password, 0);

		return result.lastInsertRowid as number;
	}

	async user_get(user_id: number): Promise<db.User | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM users
			WHERE id = (?);
		`).get(user_id);

		if (result === undefined) {
			return new Err('not_found', `user '${user_id}' does not exist`);
		}

		return result as db.User;
	}

	async user_get_username(username: string): Promise<db.User | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM users
			WHERE username = (?);
		`).get(username);

		if (result === undefined) {
			return new Err('not_found', `user '${username}' does not exist`);
		}

		return result as db.User;
	}

	async user_update(user: db.User): Promise<null | Err<db.DBError>> {
		const result = this.#_statement_run(`
			UPDATE users
			SET
				username = (?),
				password = (?),
				permission = (?)
			WHERE
				id = (?);
		`).run(user.username, user.password, user.permission, user.id);
		result;

		return null;
	}

	async user_search(like: string, limit: number, offset: number): Promise<db.User[] | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT * FROM users
			WHERE username LIKE '%' || (?) || '%'
			LIMIT (?) OFFSET (?);
		`).all(like, limit, offset);

		return result as db.User[];
	}

	async user_delete(user_id: number): Promise<null | Err<db.DBError>> {
		const result = this.#_statement_run(`
			DELETE FROM users
			WHERE id = (?);
		`).run(user_id);
		result;

		return null;
	}

	async user_count(): Promise<number | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT COUNT(id) as count FROM users;
		`).get();

		if (result === undefined) {
			return new Err('unknown', `unknown error`);
		}

		return result['count'] as number;
	}

	async session_new(user_id: number): Promise<string | Err<db.DBError>> {
		const now = Date.now();

		// purge old sessions
		const result_del = this.#_statement_run(`
			DELETE FROM sessions
			WHERE date_expire <= (?);
		`).run(now);
		result_del;

		const session_id = crypto.randomUUID();
		// 14 days
		const expires = now + 1000 * 60 * 60 * 60 * 24 * 14;

		const result_add = this.#_statement_run(`
			INSERT INTO sessions
				(id, user_id, date_expire)
			VALUES
				(?, ?, ?);
		`).run(session_id, user_id, expires);
		result_add;
		
		return session_id;
	}

	async session_user(session_id: string): Promise<db.User | Err<db.DBError>> {
		const result = this.#_statement_run(`
			SELECT users.* FROM sessions
			JOIN users ON users.id = sessions.user_id
			WHERE sessions.id = (?) AND sessions.date_expire > (?);
		`).get(session_id, Date.now());

		if (result === undefined) {
			return new Err('not_found', `session id not valid`);
		}

		return result as db.User;
	}

	async session_delete(session_id: string): Promise<null | Err<db.DBError>> {
		const result = this.#_statement_run(`
			DELETE FROM sessions
			WHERE id = (?);
		`).run(session_id);
		result;

		return null;
	}
}

