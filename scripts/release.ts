// 固定的自托管发布流程：build → zip → 校验 → 落到 site/download → 回写安装页。
// 只产出 zip。Chrome 自 75 起拒绝安装没有商店签名 proof 的 .crx（CRX_REQUIRED_PROOF_MISSING），
// 所以网页侧载只有「解压 + 加载已解压的扩展程序」一条路，发 .crx 只会给用户一个装不上的文件。
// 不做 git 提交，不做部署。部署是 pnpm deploy:site 的事。

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 落地页上永不变的下载地址。换回商店时只需要改 site 里的链接，不用动这里。 */
const DOWNLOAD_NAME = 'plotveil-chrome.zip';
const DOWNLOAD_DIR = join(root, 'site', 'download');
const INSTALL_PAGE = join(root, 'site', 'install.html');

interface PackageJson {
  version: string;
}

interface ChromeManifest {
  version: string;
  name: string;
}

function step(message: string): void {
  console.log(`\n→ ${message}`);
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function run(command: string, args: readonly string[]): void {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

const pkg = readJson<PackageJson>(join(root, 'package.json'));
const version = pkg.version;

step(`构建 PlotVeil ${version}`);
run('pnpm', ['build']);

step('打包');
run('pnpm', ['zip']);

// 校验 1：产物的 manifest 版本必须和 package.json 一致，否则用户装到的版本号是错的。
const manifest = readJson<ChromeManifest>(join(root, '.output', 'chrome-mv3', 'manifest.json'));
if (manifest.version !== version) {
  fail(`manifest 版本 ${manifest.version} 与 package.json 的 ${version} 不一致，先对齐再发布`);
}

const builtZip = join(root, '.output', `plotveil-${version}-chrome.zip`);
let builtSize: number;
try {
  builtSize = statSync(builtZip).size;
} catch {
  fail(`找不到 ${builtZip}，pnpm zip 的输出名可能变了`);
}

// 校验 2：manifest.json 必须在 zip 根目录。手动安装要求用户选中解压后含 manifest 的那一层，
// 如果 zip 里多包了一层目录，用户会选错目录、Chrome 报「清单文件缺失或不可读取」。
const listing = execFileSync('unzip', ['-Z1', builtZip], { encoding: 'utf8' });
if (!listing.split('\n').includes('manifest.json')) {
  fail('zip 根目录没有 manifest.json，解压后用户会选不到正确的目录');
}

step(`落到 site/download/${DOWNLOAD_NAME}`);
mkdirSync(DOWNLOAD_DIR, { recursive: true });
const published = join(DOWNLOAD_DIR, DOWNLOAD_NAME);
copyFileSync(builtZip, published);

const bytes = readFileSync(published);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const sizeKb = `${Math.round(builtSize / 1024)} KB`;

// 发布日期只在包内容真的变了才刷新。否则改一行文案重新部署，页面就会谎称这是新版本。
const latestPath = join(DOWNLOAD_DIR, 'latest.json');
let releasedOn = new Date().toISOString().slice(0, 10);
try {
  const previous = readJson<{ sha256: string; releasedOn: string }>(latestPath);
  if (previous.sha256 === sha256) {
    releasedOn = previous.releasedOn;
    console.log('  包内容未变，沿用原发布日期');
  }
} catch {
  // 首次发布，没有 latest.json。
}

writeFileSync(
  latestPath,
  `${JSON.stringify({ version, file: DOWNLOAD_NAME, size: builtSize, sha256, releasedOn }, null, 2)}\n`,
);

// 回写安装页里的 <!--REL:key-->…<!--/REL--> 占位。确定性文本替换，改动可以 diff。
step('回写 site/install.html');
const values: Record<string, string> = { version, size: sizeKb, sha256, released: releasedOn };
const page = readFileSync(INSTALL_PAGE, 'utf8');
const seen = new Set<string>();
const next = page.replace(/<!--REL:([a-z0-9]+)-->[\s\S]*?<!--\/REL-->/g, (whole, key: string) => {
  const value = values[key];
  if (value === undefined) {
    console.warn(`  ! 安装页有未知占位 REL:${key}，原样保留`);
    return whole;
  }
  seen.add(key);
  return `<!--REL:${key}-->${value}<!--/REL-->`;
});
const missing = Object.keys(values).filter((key) => !seen.has(key));
if (missing.length > 0) {
  fail(`安装页缺少占位：${missing.map((key) => `REL:${key}`).join('、')}`);
}
writeFileSync(INSTALL_PAGE, next);

console.log(`
✓ PlotVeil ${version} 已就绪
  site/download/${DOWNLOAD_NAME}  ${sizeKb}
  sha256  ${sha256}

下一步：
  1. 本地验一遍手动安装：解压这个 zip，chrome://extensions 开开发者模式，加载已解压的扩展程序
  2. pnpm deploy:site 部署落地页（会把 zip 一起传上去）
  3. 商店过审后把 site 里指向 /install 的入口换回商店链接，并删掉 site/download
`);
