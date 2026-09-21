/** 仅用于本地 DOM 夹具；生产构建不会引用。 */
export const browser = { runtime: { getURL: (path: string) => path } };
