# PlotVeil 开发约定

## 先读

按顺序读 docs/TASKS.md、docs/DESIGN.md、docs/ARCHITECTURE.md。打包分发读 docs/RELEASE.md。架构决策追加 docs/DECISIONS.md，不改写历史。文档与代码不一致时先核实代码和最新用户要求，不能沿用旧版“失败放行”或剧院视觉。

## 产品边界

- 静默剧透屏蔽工具，不是聊天助手。品牌是黑兜帽 Veil Keeper；不用数字、✓、! 或 × 代替角色状态，不自动弹窗。
- 首发只支持 YouTube 评论。未来 Bilibili 评论/弹幕、日本弹幕站通过 SiteAdapter<Target> 接入；本轮不实现第二站。
- 判断前先遮；失败继续保留遮罩，允许用户主动揭开。揭开后保留重新遮盖入口。不能宣称所有未加载评论安全。
- 揭开状态只属于当前文档的视频会话，不跨标签页共享。概率缓存可以共享。
- 用户关闭保护或信任频道时停止采集、显示原文；不要把关闭当作错误。

## 工程约束

- TypeScript，禁止 any。关键状态/并发逻辑写中文注释。样式与选择器按模块归属，不在 runner 加站点分支。
- runner 不依赖 browser 或 DOM；站点处理采集、上下文、呈现目标生命周期。判断服务只收可序列化证据。
- 改规则必须提升 RULE_VERSION，并跑回归。降低阈值会遮更多，不要写成“阈值越高保护越强”。
- 缓存键包括端点、scope、规则版本、上下文、完整文本；不缓存揭开意图。不能截断长评论后报告安全。
- 新 API、状态重构、依赖变化必须同步 ARCHITECTURE / TASKS。不添加未经需要的新依赖。
- 网页分发只发 zip，不发 .crx：Chrome 拒装没有商店签名 proof 的 .crx（CRX_REQUIRED_PROOF_MISSING）。安装包由 pnpm release 产出，流程见 docs/RELEASE.md。
- API 密钥仅在 Worker secret / 本地忽略文件，不进入扩展、日志或截图。
- 不发 cookie、账号、浏览历史或评论作者名。Worker 接收匿名安装 ID、内容上下文、可选观看作品和评论证据；安装 ID 不转发 Jev。
- 配额现在是 KV 软限制，不是原子计费系统。不要声称并发下严格限制。
- 保留用户已有未提交修改。清理素材前查实际引用；保留品牌母版，退役文件优先移到废纸篓。
- 改动通过校验后主动提交 Git，提交信息写清动机和取舍，不用先问。
- 不主动部署 Worker、发布商店或发送营销消息，这三件要先确认。开发完成不等于发布验收通过。

## 校验

```sh
pnpm compile
pnpm test
pnpm --dir proxy exec tsc --noEmit
pnpm --dir proxy test
pnpm build
pnpm zip
pnpm qa
```

Node 24 用于原生 TypeScript 测试/脚本。pnpm icons 需要 rsvg-convert，基于现有 SVG 母版生成，不重新设计品牌。
pnpm qa 的本地夹具复用真实 adapter/runner，端口 4178。必须等判断结束后跑 DOM checks。
真实浏览器用独立命名 session 和临时 profile；只关闭本任务 session，禁止 close --all。
测试结论区分：自动测试、真实站点验证、未覆盖项目、用户视觉验收。记录部署版本。

