import type { ItemContext, Question } from './rules/types';
import type { ProtectionCommand, ProtectionStatus } from './protection';
import type { FailureReason } from './storage';
export interface JudgeRequest {
  type: 'judge';
  scope: string;
  ruleVersion: number;
  /** 仅用户明确重试时跳过短暂网络冷却，不跳过每日配额。 */
  retry?: boolean;
  ctx: ItemContext;
  question: Question;
  items: { id: string; text: string }[];
}
export type JudgeResponse =
  | { ok: true; results: Record<string, number>; failures?: Record<string, FailureReason> }
  | { ok: false; reason: FailureReason };
export interface VeiledMessage { type: 'veiled'; count: number }
export interface TabStatusMessage { type: 'tab-status'; status: ProtectionStatus }
export interface ProtectionCommandMessage {
  type: 'protection-command';
  scope: string;
  command: ProtectionCommand;
}
export type Message = JudgeRequest | VeiledMessage | TabStatusMessage;
