# Chrome Web Store 提交清单

版本 0.1.0 · 包 `.output/plotveil-0.1.0-chrome.zip`。截图取自当前构建的真实 YouTube 页面与真实 options 页，不使用旧版界面。
本文是提交表单的逐项答案，填完即可提交；`⚠️ 待确认` 的条目在提交前必须由用户定稿。

## 1. Store listing

| 字段 | 值 |
|---|---|
| Name | PlotVeil |
| Short description（≤132） | Quietly hides YouTube comments that would spoil what you're watching — judged by meaning, not a keyword blocklist. |
| Category | Entertainment（备选 Functionality & UI） |
| Language | English (United States) |
| Store icon | `docs/launch/store/icon-128.png`（128×128） |
| Screenshots | `docs/launch/store/screenshot-1..5.png`（各 1280×800） |
| Small promo tile | `docs/launch/store-tile-440x280.png` |
| Marquee promo tile | `docs/launch/store-marquee-1400x560.png` |
| Official URL / Homepage | `https://plotveil.app/` |
| Support URL | `https://plotveil.app/` |
| Privacy policy URL | `https://plotveil.app/privacy` |
| Support email | `hello@plotveil.app`（Cloudflare Email Routing catch-all → 私人 Gmail，MX/SPF 已生效） |

### Detailed description

```
Keep the surprises.

You open a video and the comments have already told you how it ends. PlotVeil covers
that comment before you read it.

PlotVeil reads each comment in the context of the video you are on — its title and
channel, plus any other shows, films or games you have chosen to protect — and asks
whether that comment would give something away. Comments that would are covered with
a quiet grey bar. Everything else is left exactly as YouTube rendered it.

It is not a keyword blocklist. Nothing is hidden because it contains the word "dies"
or a character name; it is hidden because, read against what you are watching, it
gives the story away.

How it behaves

• Covered first, checked second. A comment is covered while it is being checked, so
  nothing flashes up before the verdict arrives.
• A failed check keeps the cover. If the network or the service fails, the comment
  stays covered rather than being let through.
• Always reversible. "Show anyway" reveals any comment, and the Keeper stays on it so
  one click puts the cover back.
• Quiet by default. No pop-ups, no toasts, no badges, no counters on your screen. The
  hooded Keeper in your toolbar shows the state; click it only if you want detail.
• Honest about coverage. PlotVeil never claims comments it has not seen are safe. It
  reports what it checked, what it hid, and what is still pending.

Settings

• Three sensitivity levels — Easygoing, Standard, Cautious. A lower threshold covers
  more, not less.
• Cover or Collapse — a full-height mask, or a compact 24px bar.
• What you're watching — add other titles so comments that spoil them are covered too,
  even under an unrelated video.
• Trusted channels — channels whose comments are never covered.

What it supports today

YouTube comments, on desktop Chrome. Bilibili comments and danmaku sites are a planned
direction, not a current feature.

How checking works

Comments near your viewport are sent, in batches, to PlotVeil's own Cloudflare Worker,
which forwards them to a language model for the spoiler judgment. The request carries
the comment text, the video's title and channel, any titles you chose to protect, and
a random installation ID used only for daily quota accounting. It does not carry your
Google account, cookies, watch history, comment author names or the page URL, and the
installation ID is not forwarded to the model provider. There is no analytics and no
tracking. Full detail in the privacy policy.
```

## 2. Privacy practices

### Single purpose

```
PlotVeil has a single purpose: on YouTube watch pages, cover comments that would spoil
the video the user is watching, and let the user reveal or re-cover any of them.
```

### Permission justifications

| Permission | 理由（可直接粘贴） |
|---|---|
| `storage` | Stores the user's own settings (protection on or off, sensitivity, mask style, protected titles, trusted channels), a session cache of spoiler probabilities keyed by hashed evidence, and a random local installation identifier used for daily quota accounting. None of it is tied to an account or synced to a server. |
| Host permission `*://*.youtube.com/*` | PlotVeil's entire function is covering spoiler comments on YouTube. The content script must read comment text on youtube.com watch pages in order to have it checked and to place the mask over it. No other site is matched. |
| Remote code | **No.** All logic ships inside the package. The extension only calls its own HTTPS endpoint for spoiler judgments; it never loads or executes remotely hosted code. |

### Data usage 问卷

勾选 **Website content** — 必须勾。理由：扩展读取并发送 YouTube 页面上的评论文本与视频标题、频道名。

不勾（逐项理由，必要时可回复审核）：

| 类别 | 答 | 理由 |
|---|---|---|
| Personally identifiable information | No | 不采集姓名、邮箱、年龄、身份标识。安装 ID 是本机随机生成、不关联任何账号，也不转发给模型方。 |
| Health information | No | — |
| Financial and payment information | No | — |
| Authentication information | No | 不读 cookie、不读登录态、不发账号信息。 |
| Personal communications | No | 只处理公开发布的 YouTube 评论，不涉及邮件、私信或聊天。 |
| Location | No | 不请求地理位置。网络请求本身带 IP，已在隐私政策写明。 |
| Web history | No | 不采集浏览历史或页面 URL。只在用户停留的那个视频页发送该视频的标题与频道名。 |
| User activity | No | 不记录点击流、鼠标轨迹或按键。 |

三项声明全部勾选（均属实）：
- 不出售、不转让用户数据给第三方（授权用途之外）
- 不将用户数据用于与单一用途无关的目的
- 不将用户数据用于判定信用状况或放贷

## 3. 提交前必须完成

1. ✅ **支持邮箱**：`hello@plotveil.app` 已通过 Cloudflare Email Routing catch-all 转发，MX/SPF 已生效。
2. ✅ **落地页与隐私页已上线**：`landing/wrangler.jsonc` 部署的 `plotveil-site` Worker（纯 assets，来源 `site/`）绑定 `plotveil.app` 与 `www.plotveil.app`，`/` 与 `/privacy` 外部访问均已验证。
3. ✅ **API 独立域名**：`plotveil-proxy` 只保留 `/judge`、`/usage`、`/health`，绑定 `api.plotveil.app`，不再服务静态资源。`workers_dev` 保留为备用端点。
4. ✅ **扩展端点**：`src/config.ts` 的 `PROXY_URL` = `https://api.plotveil.app`，已重新 build/zip。
5. 开发者账号已注册、已付 $5。

### 部署拓扑

| 域名 | Worker | 配置 | 内容 |
|---|---|---|---|
| `plotveil.app` / `www.plotveil.app` | `plotveil-site` | `landing/wrangler.jsonc` | `site/` 静态：落地页 + `/privacy` |
| `api.plotveil.app` | `plotveil-proxy` | `proxy/wrangler.jsonc` | `/judge`、`/usage`、`/health` |
| `plotveil-proxy.dearest.workers.dev` | 同上 | — | 备用端点，扩展不使用 |

拆成两个 Worker 是因为它们的变更节奏不同：改 API 不应该让官网下线，落地页也要能独立回滚。

## 4. 素材清单

| 用途 | 文件 | 尺寸 |
|---|---|---|
| 商店图标 | `docs/launch/store/icon-128.png` | 128×128 |
| 截图 1 遮罩 | `docs/launch/store/screenshot-1.png` | 1280×800 |
| 截图 2 揭开与再遮盖 | `docs/launch/store/screenshot-2.png` | 1280×800 |
| 截图 3 深色主题 | `docs/launch/store/screenshot-3.png` | 1280×800 |
| 截图 4 设置 | `docs/launch/store/screenshot-4.png` | 1280×800 |
| 截图 5 七态状态语言 | `docs/launch/store/screenshot-5.png` | 1280×800 |
| 小宣传图 | `docs/launch/store-tile-440x280.png` | 440×280 |
| 大宣传图 | `docs/launch/store-marquee-1400x560.png` | 1400×560 |

截图原始素材保留在 `docs/launch/store/src-*.png`，全部来自 2026-09-21 构建在真实 YouTube 视频 `MWzOB1D_2HE` 与真实 options 页上的截屏；截图 5 使用 `assets/brand/veil-keeper/functional/` 的运行时形态资产。

## 5. 已知会被审核问到的点

- **为什么要把评论发到服务器**：本地无法判断语义剧透。请求只带评论文本与视频上下文，答案见上面 detailed description 与隐私政策。
- **模型服务方**：Cloudflare Worker 转发至 TypeSafe 的 Jev API；安装 ID 不转发。
- **配额**：Worker KV 记录按安装 ID 的当日计数，48 小时过期；这是软限制，不是原子计费。
