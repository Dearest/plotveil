import type { ItemContext } from '../rules/types';
import type { ProtectionCommand, ProtectionStatus } from '../protection';
/** 内容证据与呈现目标分离：目标可以是 DOM 节点或弹幕渲染器的句柄。 */
export interface SiteItem<Target extends object = HTMLElement> {
  id: string;
  text: string;
  target: Target;
}
export type VeilState = 'checking' | 'spoiler' | 'failed' | 'revealed';
export interface VeilOptions {
  state: VeilState;
  collapse: boolean;
  onReveal: () => void;
  onReveil: () => void;
}
export interface SiteAdapter<Target extends object = HTMLElement> {
  scope(): string | null;
  context(): Promise<ItemContext | null>;
  observe(onItems: (items: SiteItem<Target>[]) => void): () => void;
  onNavigate(cb: () => void): () => void;
  setStatus(status: ProtectionStatus, command: (command: ProtectionCommand) => void): void;
  /** 挂载失败不能误报为已保护。 */
  isConnected(target: Target): boolean;
  veil(item: SiteItem<Target>, opts: VeilOptions): boolean;
  unveil(target: Target): void;
  unveilAll(): void;
  dispose(): void;
}
