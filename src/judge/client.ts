import { browser } from 'wxt/browser';
import type { JudgeRequest, JudgeResponse, VeiledMessage } from '../messages';
/** 失败返回明确原因，调用方保留未核验遮罩。 */
export async function judgeBatch(req: Omit<JudgeRequest, 'type'>): Promise<JudgeResponse> {
  try {
    return await browser.runtime.sendMessage({ type: 'judge', ...req }) as JudgeResponse
      ?? { ok: false, reason: 'unreachable' };
  } catch { return { ok: false, reason: 'unreachable' }; }
}
export function reportVeiled(count: number) {
  if (count <= 0) return;
  const msg: VeiledMessage = { type: 'veiled', count };
  browser.runtime.sendMessage(msg).catch(() => {});
}
