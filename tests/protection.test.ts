import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSite, type RunnerServices } from '../src/runner.ts';
import { EMPTY_STATUS, derivePhase, KEEPERS } from '../src/protection.ts';
import { createJudgeScheduler, evidenceKey } from '../src/judge/scheduler.ts';
import { spoilerRule } from '../src/rules/spoiler.ts';
import type { SiteAdapter, SiteItem, VeilOptions } from '../src/sites/types.ts';
import type { Settings } from '../src/storage.ts';
import type { JudgeRequest, JudgeResponse } from '../src/messages.ts';

const tick = (ms = 160) => new Promise(resolve => setTimeout(resolve, ms));
const defaultSettings: Settings = { enabled: true, sensitivity: 'standard', curtain: 'cover', watching: [], trustedChannels: [] };
// 用非 DOM 的渲染句柄运行整套会话测试，约束未来弹幕接入边界。
interface RenderHandle { isConnected: boolean }
const node = (): RenderHandle => ({ isConnected: true });
function fixture(judge: RunnerServices['judge']) {
  let scope = 'video-a';
  let emit: (items: SiteItem<RenderHandle>[]) => void = () => {};
  let navigate: () => void = () => {};
  let setting: (s: Settings) => void = () => {};
  const masks = new Map<RenderHandle, VeilOptions>();
  const adapter: SiteAdapter<RenderHandle> = {
    isConnected: target => target.isConnected,
    scope: () => scope, context: async () => ({ title: scope, channel: 'channel', protectedTitles: [] }),
    observe: cb => { emit = cb; return () => { emit = () => {}; }; },
    onNavigate: cb => { navigate = cb; return () => {}; },
    veil: (item, opts) => { masks.set(item.target, opts); return true; },
    unveil: el => { masks.delete(el); }, unveilAll: () => masks.clear(),
    setStatus: () => {}, dispose: () => {},
  };
  const runner = runSite(adapter, spoilerRule, {
    judge, readSettings: async () => defaultSettings, watchSettings: cb => { setting = cb; return () => {}; },
    publish: () => {}, reportVeiled: () => {},
    enable: async () => setting(defaultSettings),
  });
  return { runner, masks, emit: (items: SiteItem<RenderHandle>[]) => emit(items), change: (s: Settings) => setting(s),
    navigate: (next: string) => { scope = next; navigate(); } };
}

test('状态优先级、等待不误报安全、已有结果不随后续请求闪烁', () => {
  const s = { ...EMPTY_STATUS, scope: 'a' };
  assert.equal(derivePhase(s, false), 'idle');
  assert.equal(derivePhase({ ...s, pending: 3 }, false), 'checking');
  assert.equal(derivePhase({ ...s, checked: 5, pending: 3 }, false), 'safe');
  assert.equal(derivePhase({ ...s, spoilers: 1, pending: 3 }, false), 'protected');
  assert.equal(derivePhase({ ...s, revealed: 1, spoilers: 1 }, false), 'revealed');
  assert.equal(derivePhase({ ...s, failed: 1, revealed: 1 }, false), 'error');
  assert.equal(derivePhase({ ...s, failed: 1 }, true), 'off');
  assert.equal(new Set(Object.values(KEEPERS)).size, 7);
});

test('先遮后判、主动揭开、DOM 回收、重新遮盖、阈值本地重用', async () => {
  let calls = 0;
  const f = fixture(async req => { calls++; return { ok: true, results: Object.fromEntries(req.items.map(i => [i.id, .8])) }; });
  await tick(0);
  const a: SiteItem<RenderHandle> = { id: 'a', text: 'spoiler', target: node() };
  f.emit([a, a]);
  assert.equal(f.masks.get(a.target)?.state, 'checking');
  await tick();
  assert.equal(calls, 1);
  assert.equal(f.runner.getStatus().phase, 'protected');
  f.masks.get(a.target)!.onReveal();
  assert.equal(f.runner.getStatus().phase, 'revealed');
  f.navigate('video-a');
  assert.equal(f.runner.getStatus().phase, 'revealed');
  const b = { ...a, target: node() };
  f.emit([b]);
  assert.equal(f.masks.get(b.target)?.state, 'revealed');
  f.runner.command('recover');
  assert.equal(f.masks.get(b.target)?.state, 'spoiler');
  f.change({ ...defaultSettings, sensitivity: 'easygoing' });
  assert.equal(f.masks.size, 0);
  assert.equal(calls, 1);
  f.change(defaultSettings);
  assert.equal(f.runner.getStatus().phase, 'protected');
  f.runner.dispose();
});

test('旧视频在途响应与旧队列不能污染新视频；刷新会话重新遮盖', async () => {
  let resolveOld: (r: JudgeResponse) => void = () => {};
  const f = fixture(req => req.scope === 'video-a'
    ? new Promise(resolve => { resolveOld = resolve; })
    : Promise.resolve({ ok: true, results: { b: .1 } }));
  await tick(0);
  f.emit([{ id: 'a', text: 'old', target: node() }]); await tick();
  f.navigate('video-b'); await tick(0);
  f.emit([{ id: 'b', text: 'new', target: node() }]); await tick();
  resolveOld({ ok: true, results: { a: .99 } }); await tick(0);
  assert.equal(f.runner.getStatus().scope, 'video-b');
  assert.equal(f.runner.getStatus().checked, 1);
  assert.equal(f.runner.getStatus().phase, 'safe');
  f.runner.dispose();
});

test('失败保留遮罩、部分缺失不能当安全、重试成功清除错误', async () => {
  let retry = false;
  const f = fixture(async (): Promise<JudgeResponse> => retry ? { ok: true, results: { a: .1 } } : { ok: true, results: {} });
  await tick(0); const el = node();
  f.emit([{ id: 'a', text: 'unchecked', target: el }]); await tick();
  assert.equal(f.masks.get(el)?.state, 'failed');
  assert.equal(f.runner.getStatus().phase, 'error');
  f.masks.get(el)!.onReveal();
  assert.equal(f.runner.getStatus().phase, 'error');
  assert.equal(f.runner.getStatus().revealed, 1);
  retry = true; f.runner.command('retry'); await tick(0);
  assert.equal(f.runner.getStatus().phase, 'safe');
  assert.equal(f.masks.size, 0);
  f.runner.dispose();
});

test('双重批次预算及全局暂停期间不再发请求', async () => {
  const batches: number[] = [];
  const f = fixture(async req => {
    batches.push(req.items.reduce((sum, i) => sum + i.text.length, 0));
    return { ok: true, results: Object.fromEntries(req.items.map(i => [i.id, .1])) };
  });
  await tick(0);
  f.emit(Array.from({ length: 25 }, (_, i) => ({ id: String(i), text: 'x'.repeat(2000), target: node() })));
  await tick();
  assert.ok(batches.every(n => n <= 16000));
  assert.equal(batches.length, 4);
  f.change({ ...defaultSettings, enabled: false });
  assert.equal(f.masks.size, 0);
  assert.equal(f.runner.getStatus().phase, 'off');
  f.runner.dispose();
});

const request: Omit<JudgeRequest, 'type'> = {
  scope: 'a', ruleVersion: 2, ctx: { title: 'Film', channel: 'c', protectedTitles: [] },
  question: spoilerRule.question({ title: 'Film', channel: 'c', protectedTitles: [] }),
  items: [{ id: 'one', text: 'A comment' }],
};
test('证据缓存覆盖文本、上下文、规则与端点', async () => {
  const base = await evidenceKey(request, 'A comment', 'endpoint');
  for (const candidate of [
    { ...request, scope: 'b' }, { ...request, ruleVersion: 3 },
    { ...request, ctx: { ...request.ctx, protectedTitles: ['Another film'] } },
  ]) assert.notEqual(await evidenceKey(candidate, 'A comment', 'endpoint'), base);
  assert.notEqual(await evidenceKey(request, 'changed', 'endpoint'), base);
  assert.notEqual(await evidenceKey(request, 'A comment', 'other'), base);
});
test('并发相同证据合并、缓存复用且不同评论 ID 正确映射', async () => {
  let calls = 0;
  const cache: Record<string, number> = {};
  const judge = createJudgeScheduler({
    read: async () => cache,
    write: async values => { Object.assign(cache, values); },
    fetch: async req => { calls++; await tick(20); return { ok: true, results: Object.fromEntries(req.items.map(i => [i.id, .91])) }; },
  });
  const [a, b] = await Promise.all([
    judge(request, 'endpoint'),
    judge({ ...request, items: [{ id: 'two', text: 'A comment' }] }, 'endpoint'),
  ]);
  assert.deepEqual(a, { ok: true, results: { one: .91 } });
  assert.deepEqual(b, { ok: true, results: { two: .91 } });
  await judge(request, 'endpoint');
  assert.equal(calls, 1);
});
test('跨标签页请求并发上限为 2；失败释放队列', async () => {
  let current = 0, max = 0;
  const judge = createJudgeScheduler({
    read: async () => ({}), write: async () => {},
    fetch: async () => { current++; max = Math.max(max, current); await tick(10); current--; return { ok: false, reason: 'timeout' }; },
  });
  await Promise.all(Array.from({ length: 8 }, (_, i) => judge({ ...request, scope: String(i) }, 'endpoint')));
  assert.equal(max, 2); assert.equal(current, 0);
});
