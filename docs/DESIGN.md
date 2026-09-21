# PlotVeil Design System

版本：2026-09-21 · Veil Keeper functional UI。本文是当前产品设计规范，实现入口：src/protection.ts、src/styles/theme.css、src/sites/youtube/。

## 1. 产品原则

PlotVeil 是静默剧透屏蔽工具，类似广告屏蔽器。正常工作不抢焦点、不弹 toast、不自动展开状态面板、不反复播放吉祥物动画。用户来看评论，不是来看助手。

角色保持已有品牌身份：深炭黑兜帽、暖白脸、简单双眼、少量琥珀。完整柔软插画用于宣传；小尺寸状态统一为头像级构图，Guard 只额外保留 Shhh 手势，Peek 保留贴边探头动作。组件姿态与状态母板分层，不能因为造型适合某个容器就把它误算成状态。产品状态不能只靠颜色，也不能以数字、✓、!、× 徽标取代角色。

语义优先：未检测不等于安全，检测成功不等于覆盖全部评论；手动揭开不是异常。任何遮盖都应可撤销，任何揭开都应可再次遮盖。

## 2. 状态语言

| 产品 phase | Keeper | 形态线索 | 语义 / 入口 |
|---|---|---|---|
| unavailable / idle | neutral | 普通静候头像 | 非适用页面或等待评论；tooltip 区分 |
| checking | scout | 睁眼观察 | 首批检查中，待检内容先遮住 |
| safe | calm | 放松闭眼 | 已检查部分未发现剧透，不保证未加载评论 |
| protected | guard | Shhh 手势挡在脸前 | 已发现的剧透保持遮盖 |
| revealed | peek | 探头、双手 | 用户主动揭开过内容，可一键再遮盖 |
| error | concerned | 担忧眼形、收敛姿态 | 检查或挂载不完整；说明原因，允许恢复 |
| off | closed | 披风合拢遮住脸 | 全局关闭或信任频道暂停；Resume |

优先级：非适用 → 暂停 → 错误 → 已揭开 → 已保护 → 有已检结果 → 首批检查 → 等待。
后续批次不把 Guard/Peek/Calm 反复切换为 Scout；tooltip/详情继续显示 pending。Guard 不应被理解为全视频评论已检查完：有 pending 必须在可访问标题中说明。

错误包括超时、网络、上游、配额、上下文、超长、挂载失败。Concerned 不闪红、不响铃。配额说明下一 UTC 日恢复，超长说明不支持；这两类不显示无效重试。其他错误可 Retry protection。失败评论仍可单独揭开，再用 Peek 遮盖。

`Mask Perch` 是独立的组件姿态，不是第八个状态，也不是 Peek/revealed。它从 Peek 的趴边构图派生，只服务评论遮罩条的物理贴合；图片 `alt` 为空，checking / hidden / failed 由遮罩文案与可访问名称表达。Guard 的 Shhh 状态图标只用于工具栏、播放器、popup 和状态总览，不塞进遮罩条。

## 3. 三层信息密度

1. 常驻：只有 Keeper。工具栏和播放器不显示数字徽标或自动说明文字。
2. hover / 键盘焦点：tooltip、aria-label 给出当前状态与必要 pending。
3. 用户主动点击：popup/播放器面板显示 checked、hidden、revealed、pending 及相关操作。

只统计当前视频会话已经遇到的不同内容证据；文本编辑可形成新证据。不是可见 DOM 数，不是网站评论总数。今日 hidden 是本机使用统计，不等于当前页状态，也不等于计费用量。

## 4. 组件规范

### 评论遮罩

- 挂在正文容器内，保留原高度；Cover 默认，Collapse 可选择 24px 高。
- Shadow DOM 隔离字体、button reset、盒模型，不继承网页衬线字体。
- 一行：Possible spoiler hidden / Show anyway；等待为 Checking for spoilers，失败为 Could not check this comment。
- 使用 13px Roboto/Arial，圆角 6px，1px 边框；右端预留 44px 给 Keeper。
- 灰条右上角固定一个 32px Mask Perch（action/mask-perch-128.png，按 alpha 包围盒裁掉母版留白），双手压在灰条上沿、身体藏在遮罩后面；它是组件造型，不随 checking / failed 换形态，也不表示 Peek/revealed。状态由文案表达。Keeper 溢出到灰条上方的空白处，不压住用户名、Translate、点赞或回复。
- 宽度 ≤260px 隐藏辅助说明，保留 Show anyway 和完整可访问名称，不挤出第二行。
- 遮罩不能越过内容边界压住 Translate、点赞、回复或用户名；原文通过 visibility 隐藏，不只是模糊。
- 点击恢复原文，留 24×24px Peek 按钮（图像 22px）；正文预留 28px 末端空间，避免盖住文字。
- Peek title/aria-label 为 Hide this comment again。图像 alt 为空，不能重复朗读角色名。
- 角色与按钮只用于本评论，不触发点赞、回复或播放器快捷键。

### Chrome action

使用 action/{keeper}-{16,24,32}.png，按 tabId 更新；页面加载回到 Neutral。商店安装标志仍使用 public/icon。
图标透明；16px 必须单独检查眼形/手势，不用完整身体缩图。七态小尺寸辨认仍需要用户视觉验收，不以自动测试代替。

### 播放器入口

一个 27px Keeper 放在原控制条自然布局，不绝对覆盖 CC/齿轮/翻译按钮。
点击才开 280px 状态面板：标题、范围说明、一个上下文操作。Escape 关闭并归还焦点，外点关闭，播放器自动隐藏时收起。
迷你播放器或宽度 <520px 隐藏，工具栏继续可用。DOM 被重建后只挂一个入口。此入口是辅助功能，失效不能影响评论保护。
面板不用 alert/live 每批播报。焦点时可读出状态；无需通知每次检查完成。

### Popup / Settings

Popup 宽 320px、内边距 16px。顶部品牌与全局开关，中部 48px Keeper + 当前标签页状态，下方敏感度和设置。今日计数降为辅助文字。
敏感度：Easygoing .85 / Standard .7 / Cautious .5；降低阈值意味着遮更多。修改不重新消耗判断请求。
Settings 分组维护 Comment mask、Watching、Trusted channels、Daily usage、Installation。不保留旧 Seat 命名。输入保护作品的传输行为在隐私说明中明确。

## 5. Design tokens

| token / 用途 | Light | Dark |
|---|---|---|
| --pv-paper / 页面 | #FAF9F6 | #1C1C21 |
| --pv-paper-2 / 次级表面 | #F0F1F5 | #27282E |
| --pv-rule / 边线 | #DDE0E8 | #3A3C45 |
| --pv-ink / 主文字 | #24242B | #F7EFE5 |
| --pv-ink-2 / 辅助文字 | #686B76 | #ACAAB4 |
| --pv-curtain / 高对比控件 | #24242B | #F7EFE5 |
| --pv-curtain-ink / 控件文字 | #FAF9F6 | #24242B |
| 焦点 / 少量品牌点色 | #F4B52E | #F4B52E |

curtain 是保留的兼容 token/设置字段名，不代表要恢复红幕布。Shadow DOM 使用局部 mask token：浅色底 #F0F1F5、字 #25262D；深色底 #27282E、字 #F2EEE8。局部值在 veil.css 定义，不依赖页面 CSS 变量。

产品界面使用系统 sans：-apple-system / BlinkMacSystemFont / Segoe UI / Arial；计数和安装 ID 用 ui-monospace。不打包 Webfont。
字号：辅助 12、正文 13、常规 15、小标题 20。控制圆角 4，遮罩 6，状态面板 8。间距以 4/8/12/16px 为主。
避免大面积琥珀、红色警告、霓虹、玻璃拟态、纸纹和花哨阴影。播放器只允许为暗背景辨识增加极轻轮廓。

## 6. 动效、可访问性与输入

状态资产静态，不循环眨眼、不持续旋转。揭开/遮盖立即完成，不用离场动画制造原文短暂泄漏。
只保留控件颜色 120ms 过渡；prefers-reduced-motion 禁用。焦点轮廓清晰，按钮有 type、名称、状态。开关 aria-checked，分段按钮 aria-pressed，播放器 aria-expanded/aria-controls。
评论小入口至少 24×24px。不能让屏幕阅读器读到仍被遮住的正文；不得把图片当成无名称按钮。
默认文案英文，未来本地化必须允许更长文案，不依赖两行卡片扩高正文。

## 7. 异常与交互边界

- 未加载/没有评论：Neutral，不写“安全”。
- 一边已有剧透一边继续加载：Guard 保持，pending 如实可查。
- 揭开后再发现剧透：Peek 保持；新剧透仍遮住，旧揭开意图不被覆盖。
- 失败同时有揭开：Concerned 优先；单条 Peek 仍能再遮盖。
- 暂停：Closed，移除遮罩，不再判断；Resume 恢复。
- SPA/刷新：新视频会话重置揭开，旧响应不得更新当前页。
- 多标签页：状态和揭开隔离，概率缓存共享。
- 翻译插件修改正文：重新采集新文本；不同插件 DOM 可能不同，必须实际兼容测试。
- 超长或旧服务截断风险：未检查，不能给 Calm。
- 检查挂载失败：错误，不将数量标成全部已遮盖。

## 8. 扩展到评论和弹幕

所有站点共用语义状态、tokens 和角色，不共用 YouTube DOM 结构。Bilibili 评论可复用相同交互原则；弹幕不适合每条常驻 Keeper，应以播放区域统一状态和用户主动查看入口为主。
这是未来设计边界，不是当前已实现功能。需要明确时间预缓冲、seek、过期句柄及单条渲染抑制后再定弹幕 UI；不能把整个视频遮住冒充弹幕保护。

## 9. 资产、验证与维护

- 母版与营销图：assets/brand/veil-keeper/v1/，保留。
- 功能母版：assets/brand/veil-keeper/functional-masters/ 保存 Guard / Concerned 的头像级源图；原全身 Guard / Warning 只作营销插画。
- 功能 SVG：assets/brand/veil-keeper/functional/，由 scripts/build-keeper-icons.ts 引用 3D 黑兜帽母版生成；Mask Perch 与七态分离，角色无眉毛，Scout 使用米粒状观察眼。
- 运行时：public/action/；七态使用 16/24/32/48/64px，Mask Perch 使用 128px 源图缩放显示；functional 下的七态 128px 只作预览。
- 本地交互证据：docs/qa/product-functional-light.png / product-functional-dark.png。
- pnpm qa 使用真实 adapter/runner；等待判断结束后运行 DOM checks。截图是测试夹具，不是全部第三方插件兼容证明。
- 真实 YouTube 揭开/再遮盖已验证；自动化浏览器遭遇登录墙，真实播放/全屏/翻译插件专项待验收。
- 旧商店 UI 截图和旧五视频 v1 记录保留历史标签，不作为 v2 发布依据。

本轮优先扩展产品界面。site/ 仍有旧营销布局与字体，品牌文案/隐私已纠正；网页全面换肤和商店新截图属于发布前独立制作，不把它们误当成此设计系统的产品组件范例。
