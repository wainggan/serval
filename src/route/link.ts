
export default {
	index: () => `/` as const,
	content: <Content extends string>(content: Content) => `/content/${content}` as const,

	post_list: () => `/post` as const,
	post_display: <PostId extends string | number>(post_id: PostId) => `/post/${post_id}` as const,
	post_edit: <PostId extends string | number>(post_id: PostId) => `/post/${post_id}/edit` as const,

	tag_list: () => `/tag` as const,
	tag_display: <TagId extends string | number>(tag_id: TagId) => `/tag/${tag_id}` as const,
	tag_edit: <TagId extends string | number>(tag_id: TagId) => `/tag/${tag_id}/edit` as const,

	user_list: () => `/user` as const,
	user_login: () => `/user/login` as const,
	user_logout: () => `/user/logout` as const,
	user_display: <Username extends string>(username: Username) => `/user/${username}` as const,
	user_edit: <Username extends string>(username: Username) => `/user/${username}/edit` as const,
} as const satisfies {
	[key: string]: (...id: string[]) => string;
};

