# 发布

商店过审前的临时分发流程：官网自己托管安装包，用户手动安装。过审后整条流程作废，见末节。

## 为什么不发 .crx

Chrome 自 75 起拒绝安装任何没有商店签名 proof 的 .crx，用户拖进 `chrome://extensions` 会看到 `CRX_REQUIRED_PROOF_MISSING`，Windows 和 macOS 上没有开关能绕过。只有企业 `ExtensionInstallForcelist` 策略和 Linux 例外。

所以网页分发只发 zip，用户解压后走「加载已解压的扩展程序」。`scripts/release.ts` 不产出 .crx，也不要再加回来。

代价要在安装页上写明：Chrome 每次启动会提示停用开发者模式扩展，且已解压的扩展不会自动更新。

## 流程

```sh
pnpm release      # build + zip + 校验 + 落到 site/download + 回写安装页
pnpm deploy:site  # 先跑一遍 release，再部署落地页
```

`pnpm release` 做这几件事：

1. `pnpm build` 和 `pnpm zip`。
2. 校验 `.output/chrome-mv3/manifest.json` 的版本等于 `package.json` 的版本。
3. 校验 zip 根目录有 `manifest.json`。少了这条，用户解压后会选错目录，Chrome 报「清单文件缺失或不可读取」。
4. 复制到 `site/download/plotveil-chrome.zip`。文件名不带版本号，所以落地页链接永远不用改。
5. 算 sha256，写 `site/download/latest.json`。包内容没变时沿用原发布日期，避免改一行文案就谎称有新版本。
6. 把版本、体积、sha256、发布日期回写进 `site/install.html` 的 `<!--REL:key-->…<!--/REL-->` 占位。

zip 不进仓库（`.gitignore` 里的 `site/download/*.zip`），`latest.json` 进仓库，这样 sha 和发布日期可以 diff。

`pnpm deploy:site` 总是先跑 release，所以部署上去的 zip 一定和页面上的 sha 一致，不会出现下载 404。

## 发新版

1. 改 `package.json` 的 `version`。wxt 从这里取 manifest 版本。
2. 按 AGENTS.md 的校验清单跑一遍 compile / test / qa。
3. `pnpm release`。
4. 本地验手动安装：解压 `site/download/plotveil-chrome.zip`，开发者模式加载已解压的扩展程序，开一个 YouTube 视频确认评论先被遮住。
5. `pnpm deploy:site`。
6. 核对 https://plotveil.app/install 上的版本号和 sha256，下载一次对一下哈希。

已经装了旧版的用户不会自动收到更新。版本里有值得他们重装的东西时，要自己想办法通知。

## 过审之后

1. 把 `site/index.html` 和 `site/install.html` 里指向 `/install` 的入口换回商店链接，首屏那句「Store review is still pending」删掉，FAQ 里手动安装那条删掉。
2. 删掉 `site/install.html`、`site/download/`、`scripts/release.ts`，以及 `package.json` 里的 `release` 和 `deploy:site`（`deploy:site` 要改成只跑 wrangler，不再依赖 release）。
3. `.gitignore` 里 `site/download/*.zip` 一并删掉。
4. 从商店装一次，确认设置不会从手动安装的那份带过来：Chrome 把两者当成不同扩展。安装页上已经这么写了。
