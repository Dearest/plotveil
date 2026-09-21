/** 唯一的产品状态协议；计数仅限当前标签页的视频会话。 */
export type ProtectionPhase = 'unavailable' | 'idle' | 'checking' | 'safe' | 'protected' | 'revealed' | 'error' | 'off';
export type Keeper = 'neutral' | 'scout' | 'calm' | 'guard' | 'peek' | 'concerned' | 'closed';
export type ProtectionCommand = 'retry' | 'recover' | 'resume';
export interface ProtectionStatus {
  scope: string | null;
  phase: ProtectionPhase;
  checked: number;
  spoilers: number;
  veiled: number;
  revealed: number;
  pending: number;
  failed: number;
  reason: string | null;
}
export const EMPTY_STATUS: ProtectionStatus = {
  scope: null, phase: 'unavailable', checked: 0, spoilers: 0, veiled: 0,
  revealed: 0, pending: 0, failed: 0, reason: null,
};
export const KEEPERS: Record<ProtectionPhase, Keeper> = {
  unavailable: 'neutral', idle: 'neutral', checking: 'scout', safe: 'calm',
  protected: 'guard', revealed: 'peek', error: 'concerned', off: 'closed',
};
export function derivePhase(s: Omit<ProtectionStatus, 'phase'>, paused: boolean): ProtectionPhase {
  if (!s.scope) return 'unavailable';
  if (paused) return 'off';
  if (s.failed || s.reason) return 'error';
  if (s.revealed) return 'revealed';
  if (s.spoilers) return 'protected';
  // 后续批次不抹掉已有结果，详细文案仍明确有待检内容。
  if (s.checked) return 'safe';
  return s.pending ? 'checking' : 'idle';
}
export function statusTitle(s: ProtectionStatus): string {
  const comments = (n: number) => `${n} comment${n === 1 ? '' : 's'}`;
  switch (s.phase) {
    case 'unavailable': return 'PlotVeil works in YouTube video comments';
    case 'off': return s.reason === 'trusted' ? 'Protection paused for this trusted channel' : 'PlotVeil is paused';
    case 'idle': return 'Waiting for comments';
    case 'checking': return `Checking ${comments(s.pending)} · kept hidden until checked`;
    case 'safe': return `No spoilers found in ${comments(s.checked)} checked${s.pending ? ` · ${s.pending} pending` : ''}`;
    case 'protected': return `${s.veiled} possible spoiler${s.veiled === 1 ? '' : 's'} hidden${s.pending ? ` · ${s.pending} pending` : ''}`;
    case 'revealed': return `${comments(s.revealed)} revealed · ${s.veiled} still hidden`;
    case 'error': return `Protection incomplete · ${comments(s.failed)} ${s.failed === 1 ? 'needs' : 'need'} attention`;
  }
}
export function statusDetail(s: ProtectionStatus): string {
  if (s.phase === 'error') {
    const reasons: Record<string, string> = {
      quota: 'Daily limit reached. Checks resume after the next UTC midnight.', timeout: 'The check timed out.', upstream: 'The checking service is unavailable.',
      unreachable: 'Could not reach the checking service.', context: 'Video information is unavailable.',
      layout: 'Some comment content could not be covered.', 'too-long': 'A comment exceeds the checking limit.',
    };
    return `${reasons[s.reason ?? ''] ?? 'Some comments could not be checked.'} Unchecked comments stay hidden where possible. You can reveal them individually.`;
  }
  if (s.phase === 'off') return 'Comments are visible. Resume protection when you are ready.';
  return `${s.checked} checked · ${s.veiled} hidden · ${s.revealed} revealed · ${s.pending} pending. Only comments encountered in this video are counted.`;
}
export function statusAction(s: ProtectionStatus): { command: ProtectionCommand; label: string } | null {
  if (s.phase === 'off') return { command: 'resume', label: 'Resume protection' };
  if (s.phase === 'error' && s.reason !== 'quota' && s.reason !== 'too-long') return { command: 'retry', label: 'Retry protection' };
  if (s.revealed) return { command: 'recover', label: 'Hide revealed comments again' };
  return null;
}
