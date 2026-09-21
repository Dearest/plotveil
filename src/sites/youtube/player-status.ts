import { browser } from 'wxt/browser';
import { KEEPERS, EMPTY_STATUS, statusTitle, statusDetail, statusAction } from '../../protection';
import type { ProtectionCommand, ProtectionStatus } from '../../protection';
import { SEL } from './selectors';
import css from './player-status.css?inline';

/** DOM 注入仅提供辅助入口；挂载失败不影响评论保护。 */
export function createPlayerStatus() {
  const host = document.createElement('div');
  host.className = 'pv-player-host ytp-button';
  host.style.cssText = 'display:inline-block;position:relative;vertical-align:top;overflow:visible';
  host.setAttribute('translate', 'no');
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style'); style.textContent = css;
  const toggle = document.createElement('button'); toggle.type = 'button';
  toggle.className = 'toggle'; toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'pv-status-panel');
  const img = document.createElement('img'); img.alt = ''; toggle.append(img);
  const panel = document.createElement('div'); panel.id = 'pv-status-panel'; panel.className = 'panel'; panel.hidden = true;
  panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'PlotVeil protection status');
  const title = document.createElement('strong');
  const detail = document.createElement('p');
  const action = document.createElement('button'); action.type = 'button'; action.className = 'action';
  panel.append(title, detail, action); root.append(style, toggle, panel);
  let status: ProtectionStatus = { ...EMPTY_STATUS };
  let command: (cmd: ProtectionCommand) => void = () => {};
  let player: HTMLElement | null = null;
  function close() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); }
  toggle.addEventListener('click', e => {
    e.stopPropagation(); panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  action.addEventListener('click', e => { e.stopPropagation(); const a = statusAction(status); if (a) command(a.command); });
  host.addEventListener('keydown', e => {
    // 避免播放器把空格、方向键当播放快捷键；Escape 归还触发点焦点。
    e.stopPropagation();
    if (e.key === 'Escape') { close(); toggle.focus(); }
  });
  const outside = (e: PointerEvent) => { if (!e.composedPath().includes(host)) close(); };
  document.addEventListener('pointerdown', outside);
  const resize = new ResizeObserver(() => {
    const small = !player || player.clientWidth < 520 || player.matches(SEL.miniPlayer);
    host.style.display = small ? 'none' : 'inline-block';
    if (small) close();
  });
  function attach() {
    if (!status.scope) { host.remove(); close(); return; }
    const next = document.querySelector<HTMLElement>(SEL.player);
    const controls = next?.querySelector<HTMLElement>(SEL.playerControls);
    if (!next || !controls) return;
    if (player !== next) { resize.disconnect(); player = next; resize.observe(player); }
    if (host.parentElement !== controls) controls.prepend(host);
    host.style.display = next.clientWidth < 520 || next.matches(SEL.miniPlayer) ? 'none' : 'inline-block';
    if (next.matches(SEL.miniPlayer) || next.classList.contains('ytp-autohide')) close();
  }
  const observer = new MutationObserver(attach);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  return {
    update(next: ProtectionStatus, handler: (cmd: ProtectionCommand) => void) {
      if (next.scope !== status.scope) close();
      status = next; command = handler;
      const text = statusTitle(next);
      toggle.title = text; toggle.setAttribute('aria-label', 'PlotVeil: ' + text);
      img.src = browser.runtime.getURL(`/action/${KEEPERS[next.phase]}-48.png`);
      title.textContent = text; detail.textContent = statusDetail(next);
      const a = statusAction(next);
      action.hidden = !a; action.textContent = a?.label ?? '';
      attach();
    },
    dispose() { observer.disconnect(); resize.disconnect(); document.removeEventListener('pointerdown', outside); host.remove(); },
  };
}
