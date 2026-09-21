/**
 * YouTube 的全部选择器集中在此，别散落。对不上时只改这里，并在 DECISIONS.md 记一条当天的 DOM 结构。
 * 2026-09-20 观察：评论节点是 <ytd-comment-view-model>（2024 起替代 ytd-comment-renderer），
 * 结构 #body > #main > #expander > #content > #content-text；回复同为 ytd-comment-view-model，嵌在 ytd-comment-replies-renderer 内。
 */
export const SEL = {
  player: '#movie_player',
  playerControls: '.ytp-right-controls',
  miniPlayer: '.ytp-player-minimized',
  /** 一条评论（含回复），多个候选按顺序试 */
  comment: 'ytd-comment-view-model, ytd-comment-renderer',
  /** 评论正文 */
  contentText: '#content-text',
  /** 正文外层容器（幕布盖在这一层，连同 Read more 一起盖住）；找不到就用正文的父元素 */
  contentWrapper: '#expander',
  /** 作者 */
  author: '#author-text, #header-author a',
  /** 视频标题候选 */
  videoTitle: ['ytd-watch-metadata h1 yt-formatted-string', 'ytd-watch-metadata h1', 'h1.title yt-formatted-string', '#title h1'],
  /** 频道名候选（DOM 里合作视频会带「以及另外 N 位」后缀，oEmbed 更干净，优先用它） */
  channel: ['ytd-video-owner-renderer ytd-channel-name #text a', 'ytd-watch-metadata #owner ytd-channel-name a', '#upload-info ytd-channel-name a'],
  /** 标题/频道兜底：YouTube 自己的 oEmbed，同源、免登录、不带用户身份 */
  oembed: (videoId: string) => `/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
  /** 深色主题标记 */
  darkAttr: 'dark',
  /** SPA 导航完成事件 */
  navigateEvent: 'yt-navigate-finish',
  navigateStartEvent: 'yt-navigate-start',
} as const;
