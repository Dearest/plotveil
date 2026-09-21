import { browser } from 'wxt/browser';
import type { ItemContext } from '../../rules/types';
import type { SiteAdapter, SiteItem, VeilOptions } from '../types';
import { SEL } from './selectors';
import { createPlayerStatus } from './player-status';
import veilCss from './veil.css?inline';
import pageCss from './page.css?inline';

function commentId(text: string, author: string): string {
  // 双哈希只用于页面身份；判断缓存另外使用 SHA-256 完整内容指纹。
  let a = 2166136261, b = 5381;
  for (const c of author + '|' + text) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619);
    b = Math.imul(b, 33) ^ c.charCodeAt(0);
  }
  return 'c' + (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
function firstText(selectors: readonly string[]) {
  return selectors.map(s => document.querySelector(s)?.textContent?.trim()).find(Boolean) ?? '';
}
function wrapperOf(el: HTMLElement) {
  const text = el.querySelector<HTMLElement>(SEL.contentText);
  if (!text) return null;
  const wrapper = text.closest<HTMLElement>(SEL.contentWrapper);
  return wrapper && el.contains(wrapper) ? wrapper : text.parentElement;
}
interface Mounted {
  target: HTMLElement;
  host: HTMLElement;
  update(opts: VeilOptions): void;
  remove(): void;
}
export function createYouTubeAdapter(): SiteAdapter {
  const style = document.createElement('style');
  style.id = 'pv-page-style';
  style.textContent = pageCss;
  document.head.append(style);
  const player = createPlayerStatus();
  const mounted = new Map<HTMLElement, Mounted>();
  const theme = new MutationObserver(() => {
    for (const m of mounted.values()) m.host.classList.toggle('pv-dark', document.documentElement.hasAttribute(SEL.darkAttr));
  });
  theme.observe(document.documentElement, { attributes: true, attributeFilter: [SEL.darkAttr] });
  let navigating = false;
  const videoId = () => !navigating && location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null;
  const scope = () => videoId() ? 'youtube:video:' + videoId() + ':comments' : null;
  let meta: { videoId: string; promise: Promise<ItemContext | null> } | null = null;
  async function context(): Promise<ItemContext | null> {
    const id = videoId();
    if (!id) return null;
    const title = firstText(SEL.videoTitle);
    const channel = firstText(SEL.channel);
    if (title && channel) return { title, channel, protectedTitles: [] };
    if (meta?.videoId !== id) {
      meta = { videoId: id, promise: fetch(SEL.oembed(id), { credentials: 'omit', signal: AbortSignal.timeout(3000) })
        .then(async r => {
          if (!r.ok) return null;
          const j = await r.json() as { title?: string; author_name?: string };
          return j.title ? { title: j.title, channel: j.author_name ?? '', protectedTitles: [] } : null;
        }).catch(() => null) };
    }
    const result = await meta.promise;
    // 元数据获取失败不永久缓存，允许用户 Retry 后恢复。
    if (!result && meta?.videoId === id) meta = null;
    return result;
  }

  function observe(onItems: (items: SiteItem[]) => void) {
    const seen = new WeakMap<HTMLElement, string>();
    const nearby = new Set<HTMLElement>();
    const observed = new WeakSet<HTMLElement>();
    let stopped = false;
    let scheduled = false;
    const itemOf = (el: HTMLElement): SiteItem | null => {
      const text = el.querySelector(SEL.contentText)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (!text) return null;
      const author = el.querySelector(SEL.author)?.textContent?.trim() ?? '';
      return { id: commentId(text, author), text, target: el };
    };
    const deliver = () => {
      const items: SiteItem[] = [];
      for (const el of nearby) {
        if (!el.isConnected) { nearby.delete(el); io.unobserve(el); continue; }
        const item = itemOf(el);
        if (!item || seen.get(el) === item.id) continue;
        seen.set(el, item.id);
        items.push(item);
      }
      if (items.length) onItems(items);
    };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) nearby.add(e.target as HTMLElement);
        else nearby.delete(e.target as HTMLElement);
      }
      deliver();
    }, { rootMargin: '150% 0px 150% 0px' });
    const scan = () => {
      scheduled = false;
      if (stopped) return;
      for (const [el, m] of mounted) if (!el.isConnected) { m.remove(); mounted.delete(el); }
      document.querySelectorAll<HTMLElement>(SEL.comment).forEach(el => {
        if (el.querySelector(SEL.comment) || observed.has(el)) return;
        observed.add(el); io.observe(el);
      });
      deliver();
    };
    const mo = new MutationObserver(records => {
      // 自己的遮罩更新不触发扫描，也不误读 Shadow DOM 中的品牌文案。
      if (records.every(r => r.target instanceof Element && r.target.closest('.pv-host, .pv-player-host'))) return;
      if (!scheduled) { scheduled = true; queueMicrotask(scan); }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    scan();
    return () => { stopped = true; io.disconnect(); mo.disconnect(); nearby.clear(); };
  }

  function veil(item: SiteItem, opts: VeilOptions): boolean {
    const target = wrapperOf(item.target);
    if (!target) return false;
    const existing = mounted.get(item.target);
    if (existing?.target === target && existing.host.isConnected) { existing.update(opts); return true; }
    existing?.remove();
    const host = document.createElement('div');
    host.className = 'pv-host';
    host.classList.toggle('pv-dark', document.documentElement.hasAttribute(SEL.darkAttr));
    host.setAttribute('translate', 'no');
    const root = host.attachShadow({ mode: 'open' });
    const css = document.createElement('style'); css.textContent = veilCss;
    const curtain = document.createElement('button'); curtain.className = 'curtain'; curtain.type = 'button';
    const copy = document.createElement('span'); copy.className = 'copy';
    const message = document.createElement('span'); message.className = 'message';
    const action = document.createElement('span'); action.className = 'action'; action.textContent = 'Show anyway';
    const keeper = document.createElement('img'); keeper.className = 'keeper'; keeper.alt = '';
    keeper.src = browser.runtime.getURL('/action/mask-perch-128.png');
    copy.append(message, action); curtain.append(copy);
    const recover = document.createElement('button');
    recover.className = 'reveal-control'; recover.type = 'button';
    recover.title = 'Hide this comment again'; recover.setAttribute('aria-label', recover.title);
    const peek = document.createElement('img'); peek.alt = ''; peek.src = browser.runtime.getURL('/action/peek-48.png');
    recover.append(peek); root.append(css, curtain, keeper, recover);
    let current = opts;
    curtain.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); current.onReveal(); });
    recover.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); current.onReveil(); });
    const entry: Mounted = {
      target, host,
      update(next) {
        current = next;
        const revealed = next.state === 'revealed';
        target.classList.toggle('pv-veiled', !revealed);
        target.classList.toggle('pv-revealed', revealed);
        target.classList.toggle('pv-collapse', !revealed && next.collapse);
        host.classList.toggle('pv-reveal-control', revealed);
        const line = next.state === 'checking' ? 'Checking for spoilers' : next.state === 'failed' ? 'Could not check this comment' : 'Possible spoiler hidden';
        if (message.textContent !== line) message.textContent = line;
        curtain.setAttribute('aria-label', line + '. Show anyway');
        curtain.title = line + ' · Show anyway';
      },
      remove() {
        host.remove();
        target.classList.remove('pv-veiled', 'pv-revealed', 'pv-collapse');
      },
    };
    target.append(host); mounted.set(item.target, entry); entry.update(opts);
    return true;
  }
  function unveil(el: HTMLElement) { mounted.get(el)?.remove(); mounted.delete(el); }
  function unveilAll() { for (const el of mounted.keys()) unveil(el); }
  return {
    scope, context, observe, veil, unveil, unveilAll, isConnected: target => target.isConnected,
    onNavigate(cb) {
      // 导航开始立即失效旧队列；结束后再取得新视频上下文。
      const begin = () => { navigating = true; meta = null; cb(); };
      const finish = () => { navigating = false; meta = null; cb(); };
      document.addEventListener(SEL.navigateStartEvent, begin);
      document.addEventListener(SEL.navigateEvent, finish);
      return () => {
        document.removeEventListener(SEL.navigateStartEvent, begin);
        document.removeEventListener(SEL.navigateEvent, finish);
      };
    },
    setStatus: (s, command) => player.update(s, command),
    dispose() { theme.disconnect(); player.dispose(); style.remove(); },
  };
}
