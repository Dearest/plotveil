/**
 * 从 Veil Keeper 3D 品牌/功能母版确定性导出状态、组件姿态、Chrome action、官网预览与横向 Logo。
 * SVG 只负责引用权威 PNG 母版，不再用几何路径近似兜帽轮廓。
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
const functionalDir = new URL('assets/brand/veil-keeper/functional/', root);
const logoDir = new URL('assets/brand/veil-keeper/v1/logo/', root);
const actionDir = new URL('public/action/', root);
const siteKeeperDir = new URL('site/keeper/', root);

type KeeperState =
  | 'neutral'
  | 'scout'
  | 'calm'
  | 'guard'
  | 'peek'
  | 'concerned'
  | 'closed';

interface StateSource {
  readonly master: string;
  readonly description: string;
}

const stateSources: Record<KeeperState, StateSource> = {
  neutral: {
    master: 'assets/brand/veil-keeper/v1/masters/default-1024.png',
    description: 'Neutral Veil Keeper with two vertical oval eyes.',
  },
  scout: {
    master: 'assets/brand/veil-keeper/v1/masters/scout-1024.png',
    description: 'Attentive Veil Keeper with eyebrow-free rice-grain eyes.',
  },
  calm: {
    master: 'assets/brand/veil-keeper/v1/masters/calm-1024.png',
    description: 'Calm Veil Keeper with relaxed closed eyes and no eyebrows.',
  },
  guard: {
    master: 'assets/brand/veil-keeper/functional-masters/guard-1024.png',
    description: 'Head-level Guard Veil Keeper making a quiet shushing gesture.',
  },
  peek: {
    master: 'assets/brand/veil-keeper/v1/masters/peek-1024.png',
    description: 'Veil Keeper peeking over the lower edge.',
  },
  concerned: {
    master: 'assets/brand/veil-keeper/functional-masters/concerned-1024.png',
    description: 'Head-level Concerned Veil Keeper with restrained inward eyes and no alert symbol.',
  },
  closed: {
    master: 'assets/brand/veil-keeper/v1/masters/closed-1024.png',
    description: 'Veil Keeper closing the charcoal cloak over the face.',
  },
};

interface Box { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** 纯 Node 解析 8bit RGBA 非隔行 PNG，取不透明像素包围盒；裁剪框随母版更新，不写死数字。 */
const alphaBox = (png: Buffer): Box => {
  let pos = 8;
  let width = 0, height = 0, colorType = 0, depth = 0, interlace = 0;
  const parts: Buffer[] = [];
  while (pos < png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString('ascii', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]!; colorType = data[9]!; interlace = data[12]!;
    }
    if (type === 'IDAT') parts.push(data);
    pos += 12 + length;
  }
  if (depth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error('母版必须是 8bit RGBA 非隔行 PNG');
  }
  const raw = inflateSync(Buffer.concat(parts));
  const stride = width * 4;
  let prev = Buffer.alloc(stride);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor]!; cursor += 1;
    const line = Buffer.from(raw.subarray(cursor, cursor + stride)); cursor += stride;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= 4 ? line[i - 4]! : 0;
      const b = prev[i]!;
      const c = i >= 4 ? prev[i - 4]! : 0;
      if (filter === 1) line[i] = (line[i]! + a) & 255;
      else if (filter === 2) line[i] = (line[i]! + b) & 255;
      else if (filter === 3) line[i] = (line[i]! + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[i] = (line[i]! + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < width; x += 1) {
      if (line[x * 4 + 3]! <= 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    prev = line;
  }
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
};

const renderSvg = (source: URL, target: URL, width: number, height: number): void => {
  execFileSync('rsvg-convert', [
    '-w',
    String(width),
    '-h',
    String(height),
    '-o',
    target.pathname,
    source.pathname,
  ]);
};

const functionalSvg = (state: KeeperState, source: StateSource, masterDataUri: string): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
  <title id="title">PlotVeil Veil Keeper · ${state}</title>
  <desc id="desc">${source.description}</desc>
  <image href="${masterDataUri}" width="1024" height="1024" preserveAspectRatio="xMidYMid meet"/>
</svg>
`.trimStart();

const maskPerchSvg = (masterDataUri: string, box: Box): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box.width} ${box.height}" role="img" aria-labelledby="title desc">
  <title id="title">PlotVeil Veil Keeper · mask perch</title>
  <desc id="desc">Component-only Veil Keeper pose resting on the comment mask edge; it is not a protection state.</desc>
  <image href="${masterDataUri}" x="${-box.x}" y="${-box.y}" width="1024" height="1024" preserveAspectRatio="xMidYMid meet"/>
</svg>
`.trimStart();

const horizontalLogoSvg = (light: boolean, masterDataUri: string): string => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 420" role="img" aria-labelledby="title desc">
  <title id="title">PlotVeil</title>
  <desc id="desc">PlotVeil wordmark with the authoritative black-hood Veil Keeper master.</desc>
  <image href="${masterDataUri}" x="0" y="0" width="420" height="420" preserveAspectRatio="xMidYMid meet"/>
  <text x="445" y="282" fill="${light ? '#fffaf3' : '#17171b'}" font-family="Arial Rounded MT Bold, Arial Rounded MT, Arial, sans-serif" font-size="236" font-weight="800" letter-spacing="-12">PlotVeil</text>
</svg>
`.trimStart();

await mkdir(functionalDir, { recursive: true });
await mkdir(logoDir, { recursive: true });
await mkdir(actionDir, { recursive: true });
await mkdir(siteKeeperDir, { recursive: true });

for (const [state, source] of Object.entries(stateSources) as [KeeperState, StateSource][]) {
  const master = await readFile(new URL(source.master, root));
  const masterDataUri = `data:image/png;base64,${master.toString('base64')}`;
  const svgUrl = new URL(`${state}.svg`, functionalDir);
  await writeFile(svgUrl, functionalSvg(state, source, masterDataUri));

  for (const size of [16, 24, 32, 48, 64, 128]) {
    // 每个尺寸从同一品牌母版采样，保持透明背景；16px 仍需人工视觉验收。
    const targetDir = size === 128 ? functionalDir : actionDir;
    renderSvg(svgUrl, new URL(`${state}-${size}.png`, targetDir), size, size);
  }
  renderSvg(svgUrl, new URL(`${state}.png`, siteKeeperDir), 128, 128);
}

// Mask Perch 是遮罩组件的贴边造型，不属于七态；构图复用 Peek 母版，但资产和语义独立。
const peekMaster = await readFile(new URL(stateSources.peek.master, root));
const peekBox = alphaBox(peekMaster);
const perchSvg = new URL('mask-perch.svg', functionalDir);
await writeFile(
  perchSvg,
  maskPerchSvg(`data:image/png;base64,${peekMaster.toString('base64')}`, peekBox),
);
const perchWidth = 128;
renderSvg(
  perchSvg,
  new URL(`mask-perch-${perchWidth}.png`, actionDir),
  perchWidth,
  Math.round((perchWidth * peekBox.height) / peekBox.width),
);
renderSvg(
  perchSvg,
  new URL('mask-perch.png', siteKeeperDir),
  perchWidth,
  Math.round((perchWidth * peekBox.height) / peekBox.width),
);

const defaultMaster = await readFile(new URL(stateSources.neutral.master, root));
const defaultMasterDataUri = `data:image/png;base64,${defaultMaster.toString('base64')}`;
await writeFile(
  new URL('mark.svg', logoDir),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
  <title id="title">PlotVeil Veil Keeper</title>
  <desc id="desc">The authoritative black-hood Veil Keeper brand master.</desc>
  <image href="${defaultMasterDataUri}" width="1024" height="1024" preserveAspectRatio="xMidYMid meet"/>
</svg>\n`,
);

for (const light of [false, true]) {
  const suffix = light ? '-light' : '';
  const svgUrl = new URL(`logo-horizontal${suffix}.svg`, logoDir);
  await writeFile(svgUrl, horizontalLogoSvg(light, defaultMasterDataUri));
  renderSvg(
    svgUrl,
    new URL(`logo-horizontal-${light ? 'light' : 'dark'}-1600x420.png`, logoDir),
    1600,
    420,
  );
}
