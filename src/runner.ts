/** 当前文档持有揭开状态；每个视频代次拥有独立队列，迟到响应无法污染新页面。 */
import { BATCH_SIZE, BATCH_DEBOUNCE_MS, MAX_CONCURRENT_BATCHES, MAX_BATCH_CHARS, MAX_COMMENT_CHARS } from './config.ts';
import { derivePhase, EMPTY_STATUS } from './protection.ts';
import type { ProtectionCommand, ProtectionStatus } from './protection.ts';
import type { JudgeRequest, JudgeResponse } from './messages';
import type { Rule } from './rules/types';
import { THRESHOLDS } from './rules/spoiler.ts';
import type { SiteAdapter, SiteItem } from './sites/types';
import type { Settings } from './storage';

export interface RunnerServices {
  readSettings(): Promise<Settings>;
  watchSettings(cb: (settings: Settings) => void): () => void;
  judge(req: Omit<JudgeRequest, 'type'>): Promise<JudgeResponse>;
  publish(status: ProtectionStatus): void;
  reportVeiled(count: number): void;
  enable(): Promise<void>;
}
interface Entry<Target extends object> {
  id: string;
  text: string;
  nodes: Set<Target>;
  p: number | null;
  state: 'queued' | 'running' | 'done' | 'failed';
  reason: string | null;
  revealed: boolean;
  mountFailed: boolean;
  counted: boolean;
  retry?: boolean;
}
interface Session<Target extends object> {
  scope: string | null;
  entries: Map<string, Entry<Target>>;
  queue: Entry<Target>[];
  running: number;
  timer: ReturnType<typeof setTimeout> | null;
  stop: (() => void) | null;
  paused: boolean;
  trusted: boolean;
  reason: string | null;
}
export function runSite<Target extends object>(adapter: SiteAdapter<Target>, rule: Rule, services: RunnerServices) {
  let settings: Settings | null = null;
  let disposed = false;
  let nodeIds = new WeakMap<Target, string>();
  let latest: ProtectionStatus = { ...EMPTY_STATUS };
  let active: Session<Target>;
  const threshold = () => THRESHOLDS[settings?.sensitivity ?? 'standard'];

  function publish(s: Session<Target>) {
    if (s !== active || disposed) return;
    const next = { ...EMPTY_STATUS, scope: s.scope, reason: s.trusted ? 'trusted' : s.reason };
    for (const e of s.entries.values()) {
      if (e.p !== null) next.checked++;
      if (e.state === 'queued' || e.state === 'running') next.pending++;
      if (e.state === 'failed' || e.mountFailed) {
        next.failed++;
        next.reason = e.mountFailed ? 'layout' : e.reason;
      }
      const spoiler = e.p !== null && e.p >= threshold();
      if (spoiler) {
        next.spoilers++;
        if (!e.revealed && !e.mountFailed && !s.paused) next.veiled++;
      }
      if (e.revealed && (spoiler || e.p === null)) next.revealed++;
    }
    next.phase = derivePhase(next, s.paused);
    latest = next;
    adapter.setStatus(next, command);
    services.publish(next);
  }

  function render(s: Session<Target>, e: Entry<Target>) {
    e.mountFailed = false;
    const safe = e.p !== null && e.p < threshold();
    for (const el of e.nodes) {
      if (!adapter.isConnected(el)) { e.nodes.delete(el); continue; }
      if (s.paused || safe) { adapter.unveil(el); continue; }
      const item = { id: e.id, text: e.text, target: el };
      const mounted = adapter.veil(item, {
        state: e.revealed ? 'revealed' : e.state === 'failed' ? 'failed' : e.p === null ? 'checking' : 'spoiler',
        collapse: settings?.curtain === 'collapse',
        onReveal: () => { if (s === active) { e.revealed = true; render(s, e); publish(s); } },
        onReveil: () => { if (s === active) { e.revealed = false; render(s, e); publish(s); } },
      });
      e.mountFailed ||= !mounted;
    }
    if (!safe && e.p !== null && !e.revealed && !e.mountFailed && !e.counted && !s.paused) {
      e.counted = true;
      services.reportVeiled(1);
    }
  }

  async function process(s: Session<Target>, batch: Entry<Target>[]) {
    let response: JudgeResponse;
    try {
      const ctx = await adapter.context();
      if (s !== active || s.paused) return;
      if (!ctx) response = { ok: false, reason: 'context' };
      else {
        ctx.protectedTitles = settings?.watching ?? [];
        response = await services.judge({
          scope: s.scope!, ruleVersion: rule.version, ctx, question: rule.question(ctx),
          retry: batch.some(e => e.retry),
          items: batch.map(({ id, text }) => ({ id, text })),
        });
      }
    } catch { response = { ok: false, reason: 'unreachable' }; }
    if (s !== active || s.paused) return;
    for (const e of batch) {
      e.retry = false;
      const p = response.ok ? response.results[e.id] : undefined;
      // 缺失、NaN、越界结果都不是“安全”。
      if (typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1) {
        e.p = p; e.state = 'done'; e.reason = null;
      } else {
        e.state = 'failed'; e.reason = response.ok ? response.failures?.[e.id] ?? 'upstream' : response.reason;
      }
      render(s, e);
    }
  }

  function pump(s: Session<Target>) {
    if (s !== active || s.paused) return;
    while (s.running < MAX_CONCURRENT_BATCHES && s.queue.length) {
      const batch: Entry<Target>[] = [];
      let chars = 0;
      while (s.queue.length && batch.length < BATCH_SIZE) {
        const entry = s.queue[0]!;
        if (batch.length && chars + entry.text.length > MAX_BATCH_CHARS) break;
        batch.push(s.queue.shift()!);
        chars += entry.text.length;
      }
      batch.forEach(e => { e.state = 'running'; });
      s.running++;
      void process(s, batch).finally(() => {
        s.running--;
        if (s !== active) return;
        pump(s); publish(s);
      });
    }
    publish(s);
  }

  function onItems(s: Session<Target>, items: SiteItem<Target>[]) {
    if (s !== active || s.paused) return;
    for (const item of items) {
      const prev = nodeIds.get(item.target);
      if (prev && prev !== item.id) {
        s.entries.get(prev)?.nodes.delete(item.target);
        adapter.unveil(item.target);
      }
      nodeIds.set(item.target, item.id);
      let e = s.entries.get(item.id);
      if (!e) {
        e = { id: item.id, text: item.text, nodes: new Set(), p: null,
          state: 'queued', reason: null, revealed: false, mountFailed: false, counted: false };
        s.entries.set(item.id, e);
        if (item.text.length > MAX_COMMENT_CHARS) { e.state = 'failed'; e.reason = 'too-long'; }
        else s.queue.push(e);
      }
      e.nodes.add(item.target);
      render(s, e); // 先遮再排队，等待网络期间不会裸露。
    }
    if (s.timer === null && s.queue.length) s.timer = setTimeout(() => {
      s.timer = null; pump(s);
    }, BATCH_DEBOUNCE_MS);
    publish(s);
  }

  function end(s: Session<Target> | undefined) {
    s?.stop?.();
    if (s?.timer) clearTimeout(s.timer);
  }

  async function start(preserve = false, bypassTrusted = false) {
    const prev = active;
    end(prev);
    adapter.unveilAll();
    const scope = adapter.scope();
    const entries = preserve && prev?.scope === scope ? prev.entries : new Map<string, Entry<Target>>();
    const s: Session<Target> = {
      scope, entries, queue: [], running: 0, timer: null, stop: null,
      paused: !settings?.enabled, trusted: false, reason: null,
    };
    active = s;
    nodeIds = new WeakMap();
    for (const e of entries.values()) {
      if (e.state === 'running' || e.state === 'queued') { e.state = 'queued'; s.queue.push(e); }
    }
    publish(s);
    if (!scope || s.paused) return;
    // 只有配置了信任频道才等待上下文；通常立即观察，缩短初始裸露窗口。
    if (settings?.trustedChannels.length && !bypassTrusted) {
      const ctx = await adapter.context().catch(() => null);
      if (active !== s || disposed) return;
      if (ctx?.channel && settings.trustedChannels.some(c => c.toLowerCase() === ctx.channel.toLowerCase())) {
        s.trusted = true; s.paused = true; publish(s); return;
      }
    }
    s.stop = adapter.observe(items => onItems(s, items));
    for (const e of entries.values()) render(s, e);
    if (s.queue.length) pump(s);
    publish(s);
  }

  function command(cmd: ProtectionCommand) {
    const s = active;
    if (!s || !s.scope) return;
    if (cmd === 'resume') {
      if (!settings?.enabled) void services.enable();
      else void start(true, true);
      return;
    }
    if (s.paused) return;
    for (const e of s.entries.values()) {
      if (cmd === 'recover') e.revealed = false;
      if (cmd === 'retry' && e.state === 'failed' && e.reason !== 'too-long') {
        e.state = 'queued'; e.reason = null; e.retry = true; s.queue.push(e);
      }
      render(s, e);
    }
    s.reason = null;
    if (cmd === 'retry') pump(s);
    publish(s);
  }

  const stopNav = adapter.onNavigate(() => {
    // 同 scope 的重复完成事件不是新视频，不丢弃现有判断和揭开意图。
    if (settings && adapter.scope() !== active?.scope) void start();
  });
  const stopSettings = services.watchSettings(next => {
    const prev = settings;
    settings = next;
    if (!prev) { void start(); return; }
    if (prev.enabled !== next.enabled) { void start(true); return; }
    if (prev.watching.join('\n') !== next.watching.join('\n')) { void start(); return; }
    if (prev.trustedChannels.join('\n') !== next.trustedChannels.join('\n')) { void start(true); return; }
    if (active) {
      for (const e of active.entries.values()) render(active, e);
      publish(active);
    }
  });
  void services.readSettings().then(value => {
    if (disposed || settings) return;
    settings = value; void start();
  });
  return {
    getStatus: () => latest,
    command,
    dispose: () => { disposed = true; end(active); stopNav(); stopSettings(); adapter.unveilAll(); adapter.dispose(); },
  };
}
