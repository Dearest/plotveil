import type { JudgeRequest, JudgeResponse } from '../messages';
type Request = Omit<JudgeRequest, 'type'>;
type Result = { ok: true; p: number } | Extract<JudgeResponse, { ok: false }>;
export interface JudgeServices {
  read(keys: string[]): Promise<Record<string, number>>;
  write(values: Record<string, number>): Promise<void>;
  fetch(request: Request): Promise<JudgeResponse>;
}
/** 完整证据指纹：相同文本在不同视频、观看列表、规则或服务地址下不能互用。 */
export async function evidenceKey(req: Request, text: string, endpoint: string): Promise<string> {
  const evidence = JSON.stringify({
    schema: 2, endpoint, scope: req.scope, rule: req.ruleVersion,
    title: req.ctx.title, channel: req.ctx.channel,
    watching: [...req.ctx.protectedTitles].sort(), question: req.question, text,
  });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(evidence));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
export function createJudgeScheduler(services: JudgeServices) {
  const pending = new Map<string, Promise<Result>>();
  let running = 0;
  const waiters: (() => void)[] = [];
  async function limited(req: Request): Promise<JudgeResponse> {
    if (running >= 2) await new Promise<void>(resolve => waiters.push(resolve));
    else running++;
    try { return await services.fetch(req); }
    catch { return { ok: false, reason: 'unreachable' }; }
    finally { const next = waiters.shift(); if (next) next(); else running--; }
  }
  return async (req: Request, endpoint: string): Promise<JudgeResponse> => {
    const keyed = await Promise.all(req.items.map(async item => ({ item, key: await evidenceKey(req, item.text, endpoint) })));
    const cached = await services.read(keyed.map(i => i.key)).catch(() => ({} as Record<string, number>));
    const fresh: { item: Request['items'][number]; key: string; resolve: (r: Result) => void }[] = [];
    const tasks = keyed.map(({ item, key }) => {
      if (typeof cached[key] === 'number') return Promise.resolve({ id: item.id, result: { ok: true, p: cached[key] } as Result });
      let task = pending.get(key);
      if (!task) {
        task = new Promise<Result>(resolve => fresh.push({ item, key, resolve }));
        pending.set(key, task);
      }
      return task.then(result => ({ id: item.id, result }));
    });
    if (fresh.length) void (async () => {
      const response = await limited({ ...req, items: fresh.map(f => f.item) });
      const values: Record<string, number> = {};
      for (const f of fresh) {
        const p = response.ok ? response.results[f.item.id] : undefined;
        if (typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1) values[f.key] = p;
      }
      // 缓存不可用不能丢掉已经拿到的判断。
      await services.write(values).catch(() => {});
      for (const f of fresh) {
        const p = values[f.key];
        f.resolve(typeof p === 'number' ? { ok: true, p } : response.ok ? { ok: false, reason: response.failures?.[f.item.id] ?? 'upstream' } : response);
        pending.delete(f.key);
      }
    })();
    const settled = await Promise.all(tasks);
    const results: Record<string, number> = {};
    const failures: Record<string, Extract<JudgeResponse, { ok: false }>['reason']> = {};
    let failure: Extract<JudgeResponse, { ok: false }> | null = null;
    for (const { id, result } of settled) {
      if (result.ok) results[id] = result.p;
      else { failure = result; failures[id] = result.reason; }
    }
    // 部分成功仍回传有效概率；缺失项由 runner 保留遮罩。
    return Object.keys(results).length
      ? Object.keys(failures).length ? { ok: true, results, failures } : { ok: true, results }
      : failure ?? { ok: true, results };
  };
}
