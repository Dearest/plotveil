import { browser } from 'wxt/browser';
import type { TabStatusMessage } from './messages';
import type { ProtectionStatus } from './protection';
/** 串行发送，避免旧状态覆盖新状态。 */
let pending: Promise<unknown> = Promise.resolve();
export function reportTabStatus(status: ProtectionStatus): void {
  const message: TabStatusMessage = { type: 'tab-status', status };
  pending = pending.then(() => browser.runtime.sendMessage(message)).catch(() => {});
}
