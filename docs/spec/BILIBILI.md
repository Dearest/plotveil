# SPEC · Bilibili 弹幕

**状态：不开工。** 等 YouTube 版 Chrome 商店过审后再评估是否动工。
调研日期 2026-09-21，技术验证已完成，无任何代码。

本文是冻结的实现规格：技术事实全部实测，范围已按「自用 + 预研」定位裁剪过。
解冻开工时直接照 §5 执行，不要重新调研；§6 是留给用户量上来后的进阶能力，§7 是明确砍掉的部分，都别提前捡回来。

---

## 1. 定位（决定了下面所有范围裁剪）

**不是商业化第二站。** 是自用工具，兼作**日本弹幕站（niconico）的技术预研**。

海外市场奔着盈利，国内市场是自用和炫技——这两条线的成本约束完全不同：

- 自用 N=1，判断结果没有共享对象，**共享缓存本期不做**——设计保留在 §6，等真有用户量再解冻。
- 自用成本可忽略：Jev $0.042/MTok × 0.12M ≈ **$0.005/集**，一年 500 集约 15 元。
  成本在商业化场景是核心约束，在自用场景是噪音。不要再按成本裁剪功能。
- 不上商店、不做七态视觉打磨、不做五类视频 QA。load unpacked 自用，误判自己点开。

复利在于：弹幕预取、时间轴窗口、节点复用、渲染降级这套问题，
在 niconico（海外、日本、有付费习惯、弹幕文化更重、剧透痛点相同）上是同一套。
**用国内自用版把弹幕形态的坑踩完，再把它变成海外的盈利版。**

## 2. 只做弹幕，不做评论

B 站的痛点是弹幕与画面同帧、躲不掉。评论区要往下滚才看得到，不痛，YouTube 已经覆盖这个形态。
B 站评论的适配虽然便宜（见 §4），但对自用目标零增量，不做。

## 3. 技术验证结果

真实站点实测，样本：`BV1GJ411x7h7`（普通视频页）、`ep327642` 三国演义第34集（番剧页）。

| 项 | 结论 |
|---|---|
| 弹幕渲染 | **DOM，不是 canvas**。`.bpx-player-row-dm-wrap > div.bili-danmaku-x-dm`，CSS 变量（`--translateX`/`--offset`）驱动动画 |
| 节点生命周期 | **固定节点池复用**：6 秒观测期内 addedNodes 0、removedNodes 0、textContent 改写 22 次。`childList` 监听会完全失效，必须 `characterData` 或轮询 |
| 插入时机 | 新节点插入时尚无 `bili-danmaku-x-show` class（播放器先测宽度再显示），**存在显示前的同步介入窗口** |
| 顶部/高级弹幕 | 文本在 `.bili-danmaku-x-high-text` 子元素里，外层 `textContent` 会拼上 `+1` 等图标文本，按外层匹配会漏 |
| 全量弹幕数据 | `GET x/v2/dm/web/seg.so?type=1&oid=<cid>&pid=<aid>&segment_index=N`，protobuf，每段 6 分钟，**匿名可取**，内容脚本同源 fetch 即可 |
| protobuf 解析 | 手写 ~70 行 varint 解析器即可取 `content`(field 7) / `progress`(2) / `weight`(9)，**零依赖**，实测解出 1411 条 |
| 旧 XML 接口 | `x/v1/dm/list.so?oid=<cid>` 仍可用，返回采样池（上限 1200），可作降级路径 |
| 上下文（普通页） | `__INITIAL_STATE__.videoData`：`title` / `owner.name` / `cid` / `aid` / `pages`（分 P） |
| 上下文（番剧页） | Next.js 页，`__INITIAL_STATE__` **为空**。走 `__NEXT_DATA__.props.pageProps.dehydratedState`（`pgc/view/web/simple/season`）+ `window.player.getManifest().cid`（实测取到 197720337）+ DOM 上的季名与集号 |
| 剧集判据 | `/bangumi/play/ep*` 这个 URL 路径本身就是判据，不需要额外判断 |
| 弹幕规模 A | 三国演义 45min：**8430 条 / 7893 唯一 / 99762 字符** ≈ 120k input tokens；90 秒窗口平均 272 条、峰值 366 条 |
| 弹幕规模 B | Rick Astley MV 3.5min：1411 条 / 1343 唯一 / 18615 字符。**去重率仅 5%，去重不是有效的省钱手段** |
| 评论区结构（备查） | `bili-comments` → `bili-comment-thread-renderer` → `bili-comment-renderer` → `bili-rich-text`，全链 open shadow root，正文在 `bili-rich-text` shadowRoot 的 `p#contents`；作者在 `bili-comment-user-info` shadowRoot。已实测穿透挂上遮罩，但本期不做 |
| 用户屏蔽词（云端） | `GET x/dm/filter/user` 端点存在，需登录（未登录返回 `{code:-101}`）。响应结构**未实测**，公开 API 文档未收录 |
| 用户屏蔽词（本地） | `localStorage.bpx_player_profile.blockList`（字段已确认存在，未登录时为空数组） |
| B 站屏蔽设定面板 | `.bpx-player-dm-setting-left-block`，含 `-word`（输入）/ `-add` / `-sync`（同步云端），常驻 DOM |

## 4. 开源先例

| 项目 | 用途 |
|---|---|
| [xmcp/pakku.js](https://github.com/xmcp/pakku.js) | `protocol/urls.ts` 有完整拦截点清单（含 `wbi/` 变体与 history 接口）；`interface_protobuf.ts` 用 protobufjs 完整编解码，证明重写弹幕数据可行；**内含 WBI 签名实现**，§8 风险兑现时照它抄 |
| [F-know/spoiler-barrage-ai-filter](https://github.com/F-know/spoiler-barrage-ai-filter) | 同样用 TypeSafe Jev 做 B 站剧透弹幕过滤。走 DOM 层「轮询扫描 + MutationObserver 加速」，替换 textContent 为 `<已屏蔽>`。踩的坑与本文实测一致（节点复用、`.bili-danmaku-x-high-text`）。它分析期间要暂停视频，因为没做预取——我们预取，不要抄这个妥协 |
| [pskdje/bilibili-API-collect](https://github.com/pskdje/bilibili-API-collect) | 弹幕 protobuf 字段定义、个人配置接口（`ai_switch` / `ai_level` 智能云屏蔽等级）。原仓库 SocialSisterYi 已归档，默认分支改为 `deprecated`，用这个活跃存档 |

## 5. 实现清单（解冻后按此执行，预估 2–3 天）

1. `src/sites/bilibili/danmaku.ts` 实现 `SiteAdapter<Target>`，Target 用弹幕句柄不是 DOM 节点，
   scope `bilibili:danmaku:<cid>`。runner 不加站点分支。
2. **预取**：`document_start` 取 cid + 时长 → 算段数 → 并行自取全部 seg 段 → 手写 protobuf 解析。
   **不要抄竞品的「分析时暂停视频」**：预取的目的就是让结论在用户按下播放前到位。
3. **送判**：按文本去重、剔除纯符号与长度 ≤2 的条目；按 `progress` 切时间窗口，
   **播放位置前方 90 秒优先**，其余后台补齐。复用现有 Jev 调度、批量预算与缓存。
4. **执行**：`characterData` observer + 低频轮询兜底；按文本匹配已判定集合；
   处理 `.bili-danmaku-x-high-text`（顶部弹幕文本在子元素里）。
5. **未判断完的弹幕不显示，而不是遮住**。与「判断前先遮」同一原则（未判断 = 不放行），
   但呈现不同：开播满屏遮罩条体验极差，弹幕晚 2 秒出现无人察觉。
   **判断失败/超时同样保持不显示**，状态面板说明原因——不得失败放行。
6. **遮盖形态**：保留原节点位置，文字转透明，叠暗色胶囊「剧透已遮 · 看」，点击还原原文。
   同时提供「直接隐藏」选项：高密度弹幕下满屏遮盖条本身也是噪音。
7. **入口**：复用 YouTube 的 player-status 模式，在 `.bpx-player-control-bottom-right` 放 Keeper 按钮。
   **不寄生在 B 站屏蔽设定面板**——那是改版高频区、bui 样式体系、动态显隐，做主入口太脆。
8. **上下文**：普通页与番剧页两条提取路径各自兜底（番剧页 `__INITIAL_STATE__` 为空，见 §3）。
9. 自用验收即可：一部番 + 一部电视剧，看 seek 跳转、分 P 切换、全屏、弹幕关闭状态。

## 6. 弹幕池共享缓存（进阶能力，设计保留，等用户量）

**本期不做，但设计不作废。** 触发条件是**真的有了用户量**——在此之前它解决的是一个不存在的问题。

自用 N=1 没有共享对象，所以现在做它等于纯成本。但一旦是免费分发给很多人，
它会从「优化」变成「支点」：一集 45 分钟电视剧约 120k input tokens，没有它这个功能不可持续；
有了它，第一个看的人付成本，之后所有人命中缓存，边际趋零。
这也是 BYOK 架构的竞品（§4）结构性做不到的事——**它是届时唯一真正的护城河，不是模型**。

解冻时照这个设计做，不用重新想：

- **为什么能共享**：弹幕池是公共数据，「这条弹幕是否剧透本片」的答案对所有观众一致，与个人无关。
- **缓存键**：`bili:cid:<cid>:rule:<version>` → `{文本指纹: 概率}`。cid 是分集粒度，天然对齐弹幕池。
- **只对剧集与电影开，普通投稿视频不开**。判据零成本：`/bangumi/play/ep*` 这个 URL 路径本身就是。
  这一刀同时压成本和放大共享率——一部热剧几十万人看同一个 cid，命中率极高；
  而普通投稿是长尾，缓存基本不命中，存了也是白存。
- **个人化维度必须隔离**：`protectedTitles`、个人偏好会破坏共享性，因此**拆成两道题**——
  基础剧透判断走共享缓存，个人化判断单独走、单独计费、默认关闭、可单独关掉。
- **配额单位要一起改**：现在是 KV 里按「条数」的软限制，弹幕量级下这个单位不成立，
  要改成按「**未命中缓存的字符数**」。这项绑定共享缓存，两者同时做或都不做。
- 注意现有配额是非原子的软限制，不是计费系统。收费前另做鉴权、原子用量与服务端限流（见 ARCHITECTURE）。

## 7. 明确不做（连理由一起记，防止日后重新捡起）

| 不做 | 理由 |
|---|---|
| B 站评论区适配 | 见 §2。技术已验证（§3 末），随时可做，但对自用零增量 |
| 自己做关键词过滤 | B 站自带文本/正则/用户三类屏蔽 + 智能云屏蔽（按弹幕 weight 分级），重复实现零增量价值 |
| 导入用户屏蔽词做个人偏好判断 | 第二道题 = 成本翻倍且不可共享。真要做也是把屏蔽词转成自然语言偏好，不是再做一份关键词表——那违背 "Veils spoilers, not keywords" |
| 番剧「未来剧集」判断 | 上下文加「当前第 N 集 / 共 M 集」，判断题改为「是否透露第 N 集之后的内容」。这是 B 站/番剧独有的强能力，但需要独立标注集与规则版本，不能复用 YouTube 题面。留给商业化 |
| 数据层拦截 seg.so 重写 protobuf | pakku.js 已验证可行，比 DOM 层干净，但要 MAIN world 注入 + protobuf 编码器 + 阻塞策略。§8 的 canvas 风险兑现时才被迫走这条 |
| 上商店 / 七态视觉打磨 / 五类视频 QA | 自用不需要 |

## 8. 已知风险

- **弹幕渲染引擎切换**：当前实测为 DOM 渲染。若 B 站启用 canvas/WebGL 弹幕，DOM 层方案**整体失效**，
  必须回落到数据层拦截。这是将来商业化时最终要走数据层的根本理由。
- **WBI 签名迁移**：B 站正在把弹幕接口迁到 `x/v2/dm/wbi/web/seg.so`。当前无签名版本实测可用，
  一旦下线，自主预取需实现 WBI 签名（pakku.js 有现成实现）。
- **番剧页是 Next.js**，与普通视频页两套数据源、两种改版节奏，两条提取路径都要兜底。
- **niconico 不能假设复用**：它的弹幕渲染方式与 B 站不同，预研成果里只有「预取 + 时间窗口 + 判断调度」
  这层是确定可迁移的，渲染拦截那层必须重新验证。
- **屏蔽词接口结构未知**：`x/dm/filter/user` 需登录态实测，不要按猜测实现。

## 9. 附：效果预览

在真实 B 站页面注入验证得到，只证明挂载机制可行，不代表判断准确率，也不是视觉验收：

- `docs/qa/bili-danmaku-mock.png` — 播放中 3 条剧透弹幕换成暗色胶囊「剧透已遮 · 看」，
  Keeper 趴在胶囊左端，其余弹幕照常飞过。
- `docs/qa/bili-comment-mock.png` — 评论区穿透 shadow DOM 后的遮罩条（本期不做，留作备查）。
