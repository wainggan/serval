
import { Err } from "./common.ts";
import { content_type_codes } from "./server/serve.types.ts";

export type User = {
	readonly id: number;
	username: string;
	password: Uint8Array;
	permission: number;
};

export type Post = {
	readonly id: number;
	user_id: number;
	subject: string;
	content: string;
};

export type Tag = {
	readonly id: number;
	name: string;
	description: string;
};

export const permission = {
	/**
	+ create posts
	+ edit own posts
	*/
	post_new: 0b00000001,
	/**
	+ edit all posts
	*/
	post_mod: 0b00000010,
	/**
	+ create tags
	+ edit all tags
	*/
	mod_tag: 0b00000100,
	/**
	+ create users
	+ edit own user
	*/
	user_new: 0b00001000,
	/**
	+ edit all users
	+ edit all permissions
	*/
	user_mod: 0b00010000,
} as const;;

export type DBError =
	| 'unknown'
	| 'not_found'
	| 'exists';

export interface DB {
	/**
	creates a new, blank post, and returns its id.
	*/
	post_new(): Promise<number | Err<DBError>>;
	
	post_delete(post_id: number): Promise<null | Err<DBError>>;

	/**
	returns post's data.
	*/
	post_get(post_id: number): Promise<Post | Err<DBError>>;

	post_update(post: Post): Promise<null | Err<DBError>>;

	/**
	returns a slice of posts with a given list of tags.
	an empty array will return all posts.
	*/
	post_search(tags: string[], limit: number, offset: number): Promise<Post[] | Err<DBError>>;

	/**
	returns a list of file ids pointing to a post.
	use with `file_url()`.
	*/
	post_files(post_id: number): Promise<number[] | Err<DBError>>;

	/**
	creates a new file pointing to a post, and
	returns its id.
	*/
	file_add(post_id: number, type: keyof typeof content_type_codes, file: Uint8Array): Promise<number | Err<DBError>>;

	/**
	deletes a file.
	*/
	file_delete(file_id: number): Promise<null | Err<DBError>>;
	
	/**
	gets a valid url for retrieving a file, and
	the file's content type.
	*/
	file_url(file_id: number): Promise<[string, keyof typeof content_type_codes] | Err<DBError>>;

	/**
	creates a new tag.
	*/
	tag_new(name: string): Promise<number | Err<DBError>>;
	tag_delete(tag_id: number): Promise<null | Err<DBError>>;
	tag_get(tag_id: number): Promise<Tag | Err<DBError>>;
	tag_get_name(name: string): Promise<Tag | Err<DBError>>;
	tag_get_name_list(names: string[]): Promise<Tag[] | Err<DBError>>;
	tag_update(tag: Tag): Promise<null | Err<DBError>>;
	tag_search(search: string, limit: number, offset: number): Promise<Tag[] | Err<DBError>>;

	tagged_from_post(post_id: number): Promise<Tag[] | Err<DBError>>;
	tagged_from_tag(tag_id: number): Promise<Post[] | Err<DBError>>;
	tagged_into_post(post_id: number, tag_id_list: number[]): Promise<null | Err<DBError>>;

	user_new(username: string, password: Uint8Array): Promise<number | Err<DBError>>;
	user_delete(user_id: number): Promise<null | Err<DBError>>;
	user_get(user_id: number): Promise<User | Err<DBError>>;
	user_get_username(username: string): Promise<User | Err<DBError>>;
	user_update(user: User): Promise<null | Err<DBError>>;
	user_search(search: string, limit: number, offset: number): Promise<User[] | Err<DBError>>;

	session_new(user_id: number): Promise<string | Err<DBError>>;
	session_user(session_id: string): Promise<User | Err<DBError>>;
	session_delete(session_id: string): Promise<null | Err<DBError>>;
}


