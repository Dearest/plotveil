# ARCHITECTURE

更新：2026-09-20。这是工作区设计；新版 Worker 尚未部署。

## 边界

| 层 | 入口 | 职责 |
|---|---|---|
| 站点 | src/sites/types.ts、sites/youtube/* | 采集、上下文、导航、目标生命周期、遮罩、播放器 |
| 会话 | src/runner.ts | 先遮后判、队列、阈值、揭开意图、恢复、计数 |
| 规则 | src/rules/* | 平台无关题目与规则版本 |
| 调度 | src/judge/scheduler.ts | 证据指纹、缓存、在途合并、全扩展并发 2 |
| 浏览器 | entrypoints/youtube.content.ts、background.ts | runtime、配置、每标签页 action、网络、用量 |
| 代理 | proxy/src/index.ts | 校验、Jev noul、软配额、有限重试 |
| 状态 | src/protection.ts | 唯一 phase、角色、文案、动作协议 |

SiteItem<Target> 将 id/text 与呈现对象分开。Target 只要求 object，可以是 DOM，也可以是未来弹幕渲染句柄。runner 不导入 browser/DOM；通过 RunnerServices 注入外部服务。SiteAdapter.veil 返回是否成功挂载，不能失败后报告已保护。

## 生命周期

1. 适配器报告视口附近完整文本。YouTube 身份使用作者+文本双哈希，但作者不发服务端。
2. 同步遮住，再按 120ms 合并窗口排队：每批 ≤20 条且 ≤16000 UTF-16 字符；单条 ≤10000。超长保持未检查，不截断。
3. 同证据多个节点共享概率与当前会话揭开意图。节点重用/文本编辑重新采集。
4. background 查 SHA-256 缓存、合并相同在途证据、限制全扩展并发两批。
5. p ≥ 阈值保留遮罩，否则恢复原文；缺失、NaN、越界或网络失败不是安全。部分成功单独落地。
6. 揭开后保留 Peek 按钮，单条或状态面板再次遮盖。阈值变化仅重用概率，不重新推理。
7. 导航开始失效旧会话，结束建立新 scope；迟到响应不得污染新页面。刷新/切视频重置揭开意图。

scope 当前为 youtube:video:<id>:comments。揭开不写共享 storage，标签页间隔离；计数是本视频会话遇到的不同内容证据，不是网站总评论数。

关闭保护移除遮罩、停止观察；恢复可重用会话概率。保护作品变化重建判断上下文。信任频道在采集前判定，当前页 Resume 可临时绕过信任。

## Jev 调用方案

遵循 [TypeSafe Jev skill](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md)：

- 共享 state 放上下文及 comments 字典；每条独立内容一题 noul，多题并行。
- instructions 必须明确指向 state.comments.<id>，不要依赖 questions 键隐含传入模型。
- 不再请求 confidence，noul 就是概率。默认 .7，宽松 .85，严格 .5；降低阈值会遮更多。
- 紧凑规则不重复展开视频/频道字符串；评论是证据，不是指令。
- 同证据合并、缓存复用；敏感度变化不重发。缓存键含 schema、端点、scope、规则版本、标题、频道、排序保护作品、题目、完整文本。
- storage.session 的 judgment-v2 缓存保存 p/at，有效 24 小时。过期读取忽略，尚无批量清扫。

docs/qa/jev-v2-evaluation.json：10 条合成英/中/日/指令注入样例，v1/v2 均 10/10，input tokens 2300→2093（约 -9%）。这不是跨语言生产准确率结论，单次延迟不构成基准测试。

## Worker 协议

POST /judge 接收 installId、context（video_title/channel/protected_titles）、question（instructions 的 {{id}} 占位及 criteria）、comments（id/text）。
调用 POST https://api.typesafe.ai/v1/systemone，model=jev-latest。TYPESAFE_API_KEY 仅存在服务端 secret。
响应 schemaVersion:2、results（id→概率）、model、usage。400 非法，429 配额不足，502 上游失败；另有 /health、/usage。

旧 Worker 截断 1200 字符：新扩展对长于 1200 且无 schemaVersion:2 的结果拒绝信任，继续遮盖；短评论向后兼容。发布顺序应先 Worker 后扩展。

Worker 上游预算 8 秒，扩展 10 秒。仅明确 429/529/503 最多退避一次，Retry-After 超过 1.5 秒不在本请求内重试；超时/网络不自动重发以免重复成本。临时失败冷却 10 秒，用户主动 Retry 可跳过；配额冷却至下一 UTC 日，不可绕过。

KV usage:<installId>:<UTC date> 保存 48 小时，先检查 used+batch <=limit 再异步累计，是非原子的软限制，不是严格计费或防滥用系统。收费前另做鉴权、原子用量及服务端限流。

## DOM 与隐私

Shadow DOM 隔离按钮/字体/盒模型，仅 pv-* class 控制评论内容容器。翻译/点赞/回复行不在遮罩内；第三方翻译 DOM 仍需真实插件验收。播放器 DOM 注入是辅助入口，没有官方稳定插槽；重建时重挂，迷你及宽度 <520px 隐藏，自动隐藏时关闭面板。失败不影响评论或工具栏。

Worker 收到匿名安装 ID、评论文本、标题、频道、可选保护作品；Jev 不收到安装 ID。扩展不发送评论作者、cookie、账户或浏览历史。评论本身可能包含个人信息，不能宣称“绝无识别性内容”。

## 下一站的扩展方式

新增 Bilibili / 日本站只实现 SiteAdapter<Target>，scope 含平台+内容 ID+comments/danmaku，判断调度不写站点分支。
弹幕必须在显示前获取文本并预缓冲；Canvas/WebGL 用稳定句柄，按单条抑制，不覆盖整个视频。过期目标通过 isConnected 释放；暂停、seek、分 P 切换属于适配器生命周期设计。
当前泛型接口不是已完成的弹幕支持：播放时钟、数据获取、预缓冲、Canvas 拦截尚未实现。第二站落地后再提炼共性，不预建庞大插件框架。
日文短句、缩写、作品别名需独立标注集；不默认先翻译再判断，以免延迟与语义损失。
