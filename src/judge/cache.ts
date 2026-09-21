import { storage } from 'wxt/utils/storage';
interface CachedJudgment { p: number; at: number }
const key = (id: string) => `session:judgment-v2:${id}` as const;
const TTL = 24 * 60 * 60 * 1000;
export async function getCached(ids: string[]): Promise<Record<string, number>> {
  const entries = await storage.getItems(ids.map(key));
  const out: Record<string, number> = {};
  entries.forEach((e, i) => {
    const v = e.value as CachedJudgment | null;
    if (v && typeof v.p === 'number' && v.p >= 0 && v.p <= 1 && Date.now() - v.at < TTL) out[ids[i]!] = v.p;
  });
  return out;
}
export async function putCached(values: Record<string, number>) {
  const items = Object.entries(values).map(([id, p]) => ({ key: key(id), value: { p, at: Date.now() } }));
  if (items.length) await storage.setItems(items);
}
