/**
 * 规则是数据不是代码。
 * 一条 Rule 把「站点给出的上下文」变成一道给 Jev 的 yes/no 题；判断层与遮罩层不知道题目内容。
 */
export interface ItemContext {
  /** 内容所在页面讲的是什么：视频标题 */
  title: string;
  /** 发布者 */
  channel: string;
  /** 用户额外声明要保护的作品 */
  protectedTitles: string[];
}

export interface Question {
  /** 可含 {{id}} 占位，代理逐条替换为内容 id */
  instructions: string;
  criteria: { true: string; false: string };
}

export interface Rule {
  id: string;
  version: number;
  /** 由上下文生成题目 */
  question(ctx: ItemContext): Question;
}
