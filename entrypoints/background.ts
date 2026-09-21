import { browser } from 'wxt/browser';
import { JUDGE_TIMEOUT_MS, PROXY_URL } from '../src/config';
import { getCached, putCached } from '../src/judge/cache';
import { createJudgeScheduler } from '../src/judge/scheduler';
import type { JudgeRequest, JudgeResponse, Message } from '../src/messages';
import { EMPTY_STATUS, KEEPERS, statusTitle } from '../src/protection';
import type { ProtectionStatus } from '../src/protection';
import { installId, proxyUrl, today, usage, type FailureReason } from '../src/storage';

let usageWrite: Promise<unknown> = Promise.resolve();
function bumpUsage(patch: { checked?: number; veiled?: number; limit?: number }) {
  usageWrite = usageWrite.catch(() => {}).then(async () => {
    const u = await usage.getValue();
    const fresh = u.date === today() ? u : { date: today(), checked: 0, veiled: 0, limit: u.limit };
    await usage.setValue({
      date: fresh.date,
      checked: Math.max(fresh.checked, patch.checked ?? 0),
      veiled: fresh.veiled + (patch.veiled ?? 0),
      limit: patch.limit ?? fresh.limit,
    });
  });
  return usageWrite;
}
let identity: Promise<string> | null = null;
function ensureInstallId(): Promise<string> {
  return identity ??= (async () => {
    const existing = await installId.getValue();
    if (existing) return existing;
    const id = 'pv_' + crypto.randomUUID().replaceAll('-', '');
    await installId.setValue(id); return id;
  })();
}
const actionWrites = new Map<number, Promise<unknown>>();
function setTabStatus(tabId: number, s: ProtectionStatus) {
  const task = (actionWrites.get(tabId) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const keeper = KEEPERS[s.phase];
    await Promise.all([
      browser.action.setIcon({ tabId, path: { 16: `action/${keeper}-16.png`, 24: `action/${keeper}-24.png`, 32: `action/${keeper}-32.png` } }),
      browser.action.setBadgeText({ tabId, text: '' }),
      browser.action.setTitle({ tabId, title: 'PlotVeil · ' + statusTitle(s) }),
    ]);
  });
  actionWrites.set(tabId, task);
  void task.finally(() => { if (actionWrites.get(tabId) === task) actionWrites.delete(tabId); }).catch(() => {});
  return task;
}
const cooldowns = new Map<string, { until: number; reason: FailureReason }>();
async function fetchJudgment(req: Omit<JudgeRequest, 'type'>): Promise<JudgeResponse> {
  const [id, override] = await Promise.all([ensureInstallId(), proxyUrl.getValue()]);
  const base = override || PROXY_URL;
  const cooling = cooldowns.get(base);
  if (cooling && cooling.until > Date.now() && (!req.retry || cooling.reason === 'quota'))
    return { ok: false, reason: cooling.reason };
  try {
    const res = await fetch(`${base}/judge`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        installId: id,
        context: { video_title: req.ctx.title, channel: req.ctx.channel, protected_titles: req.ctx.protectedTitles },
        question: req.question, comments: req.items,
      }),
      signal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
    });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({})) as { used?: number; limit?: number };
      await bumpUsage({ checked: body.used, limit: body.limit });
      cooldowns.set(base, { until: Date.parse(today() + 'T00:00:00Z') + 86400000, reason: 'quota' });
      return { ok: false, reason: 'quota' };
    }
    if (!res.ok) {
      cooldowns.set(base, { until: Date.now() + 10000, reason: 'upstream' });
      return { ok: false, reason: 'upstream' };
    }
    const data = await res.json() as { schemaVersion?: number; results?: Record<string, unknown>; usage?: { used?: number; limit?: number } };
    const results: Record<string, number> = {};
    const failures: Record<string, FailureReason> = {};
    for (const item of req.items) {
      // 旧 Worker 会截断 1200 字后的内容；不能把不完整判断当成安全结论。
      if (item.text.length > 1200 && data.schemaVersion !== 2) { failures[item.id] = 'upstream'; continue; }
      const p = data.results?.[item.id];
      if (typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1) results[item.id] = p;
    }
    await bumpUsage({ checked: data.usage?.used, limit: data.usage?.limit });
    cooldowns.delete(base);
    return { ok: true, results, failures };
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'unreachable';
    cooldowns.set(base, { until: Date.now() + 10000, reason });
    return { ok: false, reason };
  }
}
const judge = createJudgeScheduler({ read: getCached, write: putCached, fetch: fetchJudgment });
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => { void ensureInstallId(); });
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'loading') void setTabStatus(tabId, EMPTY_STATUS).catch(() => {});
  });
  browser.tabs.onRemoved.addListener(tabId => { actionWrites.delete(tabId); });
  browser.runtime.onMessage.addListener((raw: unknown, sender, respond) => {
    const msg = raw as Message;
    if (msg?.type === 'judge') {
      proxyUrl.getValue().then(base => judge(msg, base || PROXY_URL))
        .then(respond).catch(() => respond({ ok: false, reason: 'unreachable' } satisfies JudgeResponse));
      return true;
    }
    if (msg?.type === 'veiled') {
      bumpUsage({ veiled: msg.count }).then(() => respond(true)).catch(() => respond(false));
      return true;
    }
    if (msg?.type === 'tab-status' && typeof sender.tab?.id === 'number') {
      setTabStatus(sender.tab.id, msg.status).then(() => respond(true)).catch(() => respond(false));
      return true;
    }
    return false;
  });
});
