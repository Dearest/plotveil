# Veil Keeper ImageGen 生成规范

更新：2026-09-21

本文用于生成新的 Veil Keeper 位图插画，并尽量保持角色身份、材质和比例一致。权威身份母版是：

`assets/brand/veil-keeper/v1/masters/default-1024.png`

## 1. 一致性的边界

ImageGen 可以高度保持角色身份，但不能保证逐像素一致。涉及以下资产时禁止重新生成：

- Logo、Head Mark、商店左上角品牌标志：直接复用 `default-1024.png` 或 `v1/logo/`。
- 16–128px 功能图标：优先复用已有状态母版，通过 `pnpm icons` 确定性导出。
- 已有营销图只需换 Logo：使用母版像素合成，不让模型重画整张图。

只有新增表情、动作、姿势或场景插画时才使用 ImageGen。生成结果必须经过视觉验收，不能只凭提示词或文件元数据判定一致。

## 2. 参考图优先级

每次都显式说明每张输入图的职责：

1. `default-1024.png`：权威角色身份参考，决定头部轮廓、脸部比例、材质、色彩和光照。
2. 对应状态母版：只提供表情、手势或披风姿势，不得覆盖 Image 1 的身份。
3. 目标底图：只提供版式、背景或合成位置，不得影响角色造型。

不要只写“参考这些图片”。必须写成：

```text
Input images:
- Image 1: authoritative Veil Keeper identity reference.
- Image 2: pose or expression reference only.
- Image 3: edit target or composition reference only.
```

## 3. 不可变化的身份特征

以下约束应在每次生成和每次迭代中重复：

- 深炭黑、不对称的柔软兜帽；顶部有自然向后垂落的帽尖。
- 兜帽是有布料厚度和褶皱的黑色 Hood，不是圆润三角形几何外壳。
- 暖象牙白脸，保持母版的宽度、高度和在兜帽开口中的位置。
- 默认没有眉毛、眉线、额头线、鼻子、嘴、耳朵或头发。
- 眼睛只按状态变化；除眼睛外不额外增加面部线条。
- 柔软 3D 布料/黏土质感，漫射棚拍光，不改成扁平矢量、塑料或金属。
- 主色只有炭黑、暖白和少量琥珀；不增加红、蓝、紫等新强调色。
- 琥珀色四角星位于角色右下侧；除状态明确需要外，不增加其他符号。
- 不增加文字、水印、边框、底座或无关道具。

## 4. 通用提示词模板

使用内置 ImageGen 的编辑模式，并传入 `default-1024.png`。把尖括号内容替换成实际需求。

```text
Use case: identity-preserve
Asset type: PlotVeil Veil Keeper <functional state / marketing illustration / transparent character asset>

Primary request:
Create <the exact requested state, pose, or scene> from Image 1.
Preserve the Veil Keeper identity from Image 1 exactly: the same asymmetric soft charcoal-black fabric hood, backward-drooping hood tip, black inner opening, warm ivory face shape and proportions, soft 3D fabric/clay material, camera angle, diffuse studio lighting, and small amber four-point glint on the character's lower-right side.
Change only <the requested expression, gesture, pose, or scene relationship>. Keep every unrelated identity feature unchanged.

Input images:
- Image 1: authoritative Veil Keeper identity reference. It controls identity, proportions, materials, palette, and lighting.
- Image 2: <optional pose/expression reference only; it must not override Image 1 identity>.
- Image 3: <optional edit target or composition reference only>.

Composition/framing:
<1:1 transparent character master / exact target aspect ratio and placement>. Keep the character scale and camera angle consistent with Image 1 unless explicitly requested otherwise.

Constraints:
- no eyebrows, brow lines, forehead marks, nose, mouth, ears, or hair
- preserve the exact hood silhouette, face proportions, black inner opening, material, palette, and lighting from Image 1
- use only the eye shape and gesture explicitly requested below
- no extra symbols beyond the existing amber glint unless explicitly requested
- no text, no watermark, no border
- genuinely transparent background when this is a reusable character asset

Avoid:
rounded geometric triangle mascot, flat vector icon, generic hooded person, changed face proportions, changed hood tip, extra facial marks, extra accessories, new colors, hard plastic, metallic material, excessive gloss, extra fingers or limbs
```

## 5. 七态专用追加语句

通用模板之后只追加对应状态的一段，不同时描述多个状态。

| 状态 | 追加提示词 | 首选参考 |
|---|---|---|
| neutral | `Use exactly two vertical black oval eyes. Keep the face completely eyebrow-free.` | `default-1024.png` |
| scout | `Use two small tapered rice-grain-shaped black eyes to express attentive observation. Do not add eyebrows or any marks above the eyes.` | `scout-1024.png` |
| calm | `Change only the eyes to two relaxed closed-eye arcs. These arcs are the eyes, not eyebrows. Keep the forehead completely blank.` | `calm-1024.png` |
| guard | `Use the head-level Guard composition with one compact shushing finger. Do not add a torso, legs, feet, or trailing cape.` | `functional-masters/guard-1024.png` |
| peek | `Preserve the low peeking pose and hands on the lower edge. Keep the authoritative hood and face identity unchanged.` | `peek-1024.png` |
| concerned | `Use the head-level concerned composition with two subtly inward tapered eyes. Do not add eyebrows, hands, punctuation, a warning triangle, or a full body.` | `functional-masters/concerned-1024.png` |
| closed | `Bring two soft charcoal cloak folds inward so they meet and cover most of the face. The result must read as fabric folds, not a geometric mask.` | `closed-1024.png` |

已有七态不应再次生成。上表主要用于未来需要更大尺寸、不同构图或新动作时锁定语义。

## 6. 可直接复制的 Scout 提示词

```text
Use case: identity-preserve
Asset type: PlotVeil Veil Keeper functional state master, transparent square bitmap

Primary request:
Create the Scout state from Image 1. Preserve exactly the same Veil Keeper identity, asymmetric soft charcoal-black fabric hood, backward-drooping hood tip, black inner opening, warm ivory face, soft 3D fabric/clay material, proportions, camera angle, diffuse studio lighting, and amber four-point glint. Change only the two eyes into small tapered rice-grain-shaped black eyes that express attentive observation. Keep the forehead completely blank.

Input images:
- Image 1: authoritative Veil Keeper identity reference.

Composition/framing:
1:1 square, same head scale and placement as Image 1, centered, with transparent margin.

Constraints:
- genuinely transparent background
- absolutely no eyebrows, brow lines, or forehead marks
- no nose, mouth, ears, or hair
- no body or hands
- no symbols beyond the existing amber glint
- no text or watermark

Avoid:
vertical oval neutral eyes, eyebrows, rounded geometric triangle mascot, flat vector look, generic hooded person, changed hood proportions, extra accessories, new colors
```

## 7. 营销插画提示词

先生成不带文字和 Logo 的角色或场景，再用确定性工具合成品牌标志和文案。不要要求模型同时画角色、Logo 和精确文字。

```text
Use case: identity-preserve
Asset type: PlotVeil marketing illustration

Primary request:
Place the Veil Keeper from Image 1 into <scene and action>. Preserve the character identity exactly. Change only the full-body pose and its interaction with <object or environment>.

Input images:
- Image 1: authoritative Veil Keeper identity reference.
- Image 2: optional pose reference only.

Scene/backdrop:
<describe the environment, or request a genuinely transparent background for later compositing>

Composition/framing:
<aspect ratio, subject placement, crop, negative space>

Constraints:
- preserve the exact hood, face proportions, materials, palette, lighting, and eyebrow-free face from Image 1
- keep anatomy simple and consistent with the existing non-human mascot
- no embedded Logo, no text, no watermark

Avoid:
rounded geometric triangle mascot, flat vector style, human facial features, new costume, new brand colors, unrelated props, extra limbs or fingers
```

## 8. 纠错提示词

迭代时只修一个问题，不要重写整段场景。

### 去掉误生成的眉毛

```text
Change only the face: remove every eyebrow, brow line, and forehead mark. Keep the requested eye shapes unchanged. Keep the hood, face proportions, material, lighting, amber glint, framing, and transparency exactly unchanged.
```

### Scout 眼形错误

```text
Change only the two eyes to small tapered rice-grain-shaped black eyes. Do not add eyebrows or any marks above the eyes. Keep every other pixel-level design feature as close to the current image as possible.
```

### 兜帽变成圆润三角形

```text
Change only the hood construction. Restore the asymmetric soft charcoal-black fabric hood from Image 1, including its thick folded opening, black inner cavity, natural fabric volume, and backward-drooping tip. It must read as a worn hood, not a rounded geometric triangle shell. Keep the face, eyes, pose, lighting, framing, and background unchanged.
```

## 9. 标准工作流

1. 先查看 `default-1024.png`，再调用内置 ImageGen。
2. 每个不同状态或不同资产单独生成一次，不用一条提示词批量混合多个状态。
3. 首轮只改需求中明确要求变化的部分。
4. 检查眉毛、眼形、兜帽轮廓、脸部比例、材质、琥珀星和透明边缘。
5. 发现偏差时使用第 8 节的单点纠错，不同时修改多个变量。
6. 通过视觉验收后，把结果从 `$CODEX_HOME/generated_images/` 复制到项目目录。
7. 统一转换为 sRGB、8-bit RGBA；营销成图按目标规格决定是否保留 Alpha。
8. 功能图标运行 `pnpm icons`，再检查 16/24/32/128px 实际显示。
9. Logo 和精确文字最后通过 SVG、HTML 或 ImageMagick 合成，不交给 ImageGen。

## 10. 验收清单

- [ ] 角色是黑色布料兜帽，不是圆润三角形外壳。
- [ ] 没有眉毛、眉线或额头杂线。
- [ ] 眼形符合当前状态。
- [ ] 暖白脸比例、位置和母版一致。
- [ ] 帽尖方向、黑色内腔和布料厚度一致。
- [ ] 只使用炭黑、暖白、少量琥珀。
- [ ] 没有新增嘴、鼻子、耳朵、头发、服装或无关符号。
- [ ] 透明资产确实包含 Alpha，不是棋盘格或纯色假透明。
- [ ] 文件尺寸、色彩空间、位深和目标用途一致。
- [ ] 16/24/32px 图标经过实际尺寸人工检查。
- [ ] Logo、品牌文字和营销文案不是模型生成文本。
- [ ] 最终文件已复制进项目，而不是只留在 ImageGen 默认输出目录。

常用元数据检查：

```sh
magick identify -format '%f %wx%h %[channels] %[colorspace] depth=%z opaque=%[opaque]\n' path/to/image.png
```

注意：元数据正确不代表视觉身份已经通过验收。
