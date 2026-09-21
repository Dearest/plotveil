# Veil Keeper 资产职责

品牌身份保持黑兜帽、暖白脸、安静双眼和少量琥珀。当前交互规范以 ../DESIGN.md 为准。

新增角色插画前先读 [VEIL-KEEPER-IMAGEGEN.md](./VEIL-KEEPER-IMAGEGEN.md)。Logo 和功能小图标优先复用母版，不通过 ImageGen 重画。

| 类型 | 路径 | 用途 |
|---|---|---|
| 原始品牌母版 | assets/brand/veil-keeper/v1/masters/ | 已有五态柔软 3D 插画，不打进扩展 |
| 头像级功能母版 | assets/brand/veil-keeper/functional-masters/ | Guard / Concerned 小尺寸专用；不复用全身营销构图 |
| 宣传尺寸 | assets/brand/veil-keeper/v1/states/ | 官网/onboarding/营销，非功能状态机 |
| SVG 品牌标志 | assets/brand/veil-keeper/v1/logo/ | Head Mark、横向 Logo 和深浅版本 |
| 功能七态与组件源 | assets/brand/veil-keeper/functional/*.svg | 七态 neutral/scout/calm/guard/peek/concerned/closed；组件姿态 mask-perch 单列 |
| 功能预览 | assets/brand/veil-keeper/functional/*-128.png | QA，不打进扩展 |
| 运行时图标 | public/action/ | 七态使用 16/24/32/48/64px；评论遮罩使用 mask-perch-128.png |
| 安装/商店图标 | public/icon/{16,32,48,96,128}.png | 已有品牌图标 |
| 旧品牌总览 | docs/design/veil-keeper-asset-sheet.png | 插画素材历史展示，不作当前 UI 验收 |

功能状态由 scripts/build-keeper-icons.ts 从 v1 品牌母版与 functional-masters 头像级母版确定性生成。角色无眉毛；neutral 保持竖向椭圆眼，scout 以米粒状眼睛表达观察，guard 只保留头像与 Shhh 手势，concerned 只用内倾眼形、不带 `!` 警告牌。不得把全身营销插画直接缩进 16–64px 功能位，也不得再用圆润三角几何 SVG 近似角色。pnpm icons 需要 rsvg-convert。

功能状态与宣传插画分层：小图标使用几何眼形/手势/披风，不能缩小完整 3D 插画硬塞进 16px。图像透明，按钮负责 aria-label，图片 alt 为空。评论遮罩上的 Mask Perch 显示为 32px，揭开后 Peek 入口为 24px；状态含义见 DESIGN。

## 功能状态与母板

| 功能形态 | 产品语义 | 权威母板 | 构图规则 |
|---|---|---|---|
| Neutral | unavailable / idle | `v1/masters/default-1024.png` | 头像 |
| Scout | checking | `v1/masters/scout-1024.png` | 头像，米粒状观察眼 |
| Calm | safe | `v1/masters/calm-1024.png` | 头像，闭眼 |
| Guard | protected | `functional-masters/guard-1024.png` | 头像 + Shhh 手势，不用全身图 |
| Peek | revealed / 重新遮盖入口 | `v1/masters/peek-1024.png` | 贴边探头，只表达用户已揭开 |
| Concerned | error | `functional-masters/concerned-1024.png` | 头像，内倾眼形，不用警告牌 |
| Closed | off | `v1/masters/closed-1024.png` | 头像，披风合拢 |

| 组件姿态 | 使用位置 | 派生来源 | 语义边界 |
|---|---|---|---|
| Mask Perch | 评论遮罩条右上沿 | Peek 母版的透明包围盒裁切 | 只解决趴边构图，不属于七态，不表示 revealed |

`v1/masters/guard-1024.png` 与 `v1/masters/warning-1024.png` 是全身营销插画，不再作为功能图标源。旧名 `peek-badge` 退役，避免把组件造型误解成 Peek 状态。

旧 public/veil 1×/2×/3×栅格副本和过期截图夹具已退役，母版保留。当前 light/dark UI 证据在 docs/qa/product-*，旧 comment-mask-preview.png 仅为前版参考。
