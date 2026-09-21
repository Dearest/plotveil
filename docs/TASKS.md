# TASKS

## 当前交接 · 2026-09-21

静默产品交互与判断架构改造已实现，发布前五项验收主人确认完成（结论待回填）。当前状态是等 Chrome 商店审核。
旧版“MVP 已全部验收，只差提交”与“尚未完成发布验收”都不再适用。

## 已落地

- 七个 Veil Keeper 功能形态，覆盖 unavailable/idle/checking/safe/protected/revealed/error/off；工具栏、播放器、popup 共用状态。
- 状态母板与组件姿态已分层：Guard/Concerned 使用头像级功能母板；评论遮罩保留趴边的 Mask Perch，但它不属于七态、不表示 Peek/revealed。
- 待检先遮、失败继续遮；揭开保留 24px 再遮盖按钮，状态入口支持批量恢复。
- 单行无衬线 Shadow DOM 遮罩，避让翻译行；播放器辅助入口可重挂，窄屏/迷你隐藏。
- 泛型 SiteAdapter<Target> + 注入服务 runner：测试使用非 DOM 句柄；未来评论和弹幕复用判断核心。
- Jev v2：上下文完整缓存键、相同在途合并、全扩展并发 2、字符/条数预算、概率校验、部分失败、有限退避。
- 长评论不截断；旧 Worker 缺 schemaVersion:2 时不信任超过 1200 字符的结论。
- 清理无引用的扩展字体、旧 public/veil 素材和重复夹具；原品牌母版及历史 QA 保留。
- 更新 AGENTS / CLAUDE / ARCHITECTURE / DESIGN 及发布文案。

## 验证记录

- 扩展 TypeScript、Worker TypeScript 检查通过。
- build/zip 与 git diff --check 通过；本地包 .output/plotveil-0.1.0-chrome.zip 约 211 KB。
- 通用状态/调度测试 8 项、Worker 测试 4 项通过；非 DOM 句柄参与会话测试。
- 真实 adapter/runner 的本地 DOM 检查 8 项通过：翻译避让、揭开入口、状态、恢复、控制条重挂、主题、评论编辑、重新遮盖。
- 真实 YouTube：MWzOB1D_2HE 页面 20 个已加载节点，视口附近 8 条已检查，4 条遮盖；揭开一条后变为 1 revealed / 3 hidden，保留 24px 入口，再遮盖回到 4 hidden。
- 浏览器播放器被 YouTube 登录/机器人检查限制；不能据此宣称真实播放、全屏均验收。
- Jev v1/v2 各 10 条合成样例均 10/10，input tokens 2300→2093；详见 qa/jev-v2-evaluation.json，不作大样本结论。
- 截图：qa/product-functional-light.png、product-functional-dark.png、product-live-revealed.png；旧 01–08、handtest-2026-09-20.md 是 v1 历史。

## 下一步从这里开始

发布前五项（部署 proxy、登录浏览器真实验收、v2 重跑五类视频、16px 七态确认、商店素材与隐私问卷）
主人 2026-09-21 确认全部完成，已从本清单移除。**具体结论与部署版本尚未回填，见下方「待回填」。**

1. 等 Chrome 商店审核。过审后按 docs/RELEASE.md 末节把落地页从 /install 手动安装入口回滚到商店链接。
2. Bilibili 不开工。可行性验证已完成，规格冻结在 docs/spec/BILIBILI.md，解冻条件是商店过审。
   定位为自用与 niconico 预研，不是商业化第二站。不声称已支持。

## 待回填

以下是主人口头确认完成、但仓库里没有记录的事实，不要凭推测补写：

- proxy 部署版本号与部署时间；schemaVersion:2、长评论、429/529 退避的实测结论。
- 登录浏览器验收覆盖到哪些项（真实翻译插件、全屏/剧场/迷你、回复、SPA、多标签页隔离），有无未覆盖项。
- v2 五类视频的实际结果，替换掉上方「验证记录」里的 v1 历史。
- 16px 七态是否通过视觉验收。
- 商店是否已提交、提交时间与版本。

## 发布配置待确认

hello@plotveil.app 已通过 Cloudflare Email Routing 转发。
落地页商店链接已改为手动安装入口 /install：商店未过审期间自托管 zip（site/download/plotveil-chrome.zip），用户走「加载已解压的扩展程序」。不发 .crx，Chrome 拒装无商店签名 proof 的 .crx。发布流程固定在 pnpm release / pnpm deploy:site，见 docs/RELEASE.md，过审后按该文末节回滚。
端点现状：落地页 plotveil.app / www 由 landing/ 的 plotveil-site（纯 assets）提供；API 在 api.plotveil.app 由 proxy/ 的 plotveil-proxy 提供，已去掉 assets；workers.dev 保留为备用。src/config.ts 指向 https://api.plotveil.app。
请勿将旧版固定 PH 日期当成当前计划。（原「没有 Git commit、部署或商店提交」已过期：proxy 已部署、仓库已有提交，商店提交状态见「待回填」。）

## 清理可恢复

退役文件已移入本机回收站，仅作当轮操作记录，不属于仓库依赖。
浏览器 QA 必须独立 session，仅关闭自己的会话。重新加载扩展后才能测试新 build；不要 close --all。
