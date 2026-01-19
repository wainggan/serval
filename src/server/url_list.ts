
const url_list = {
	post_list: () => `/post` as const,
	post_display: <PostId extends string | number>(post_id: PostId) => `/post/${post_id}` as const,
	post_edit: <PostId extends string | number>(post_id: PostId) => `/post/${post_id}/edit` as const,
	tag_list: () => `/tag` as const,
	tag_display: <TagId extends string | number>(tag_id: TagId) => `/tag/${tag_id}` as const,
	tag_edit: <TagId extends string | number>(tag_id: TagId) => `/tag/${tag_id}/edit` as const,
} satisfies {
	readonly [key: string]: (...id: (string | number)[]) => string;
};

export default url_list;

