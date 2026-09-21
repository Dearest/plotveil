/** settings schema 与默认值。所有持久化键集中在这里。 */
import { storage } from 'wxt/utils/storage';

export type Sensitivity = 'easygoing' | 'standard' | 'cautious';
export type CurtainStyle = 'cover' | 'collapse';

export interface Settings {
  enabled: boolean;
  sensitivity: Sensitivity;
  curtain: CurtainStyle;
  /** 「我在看的作品」，可为空 */
  watching: string[];
  /** 白名单频道，命中则整页不判 */
  trustedChannels: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  sensitivity: 'standard',
  curtain: 'cover',
  watching: [],
  trustedChannels: [],
};

export const settings = storage.defineItem<Settings>('local:settings', {
  fallback: DEFAULT_SETTINGS,
});

/** 匿名安装 id，首次安装生成。 */
export const installId = storage.defineItem<string | null>('local:installId', { fallback: null });

export interface Usage {
  date: string; // YYYY-MM-DD
  checked: number; // 今日送去判断的条数（本地计，Worker 侧另有权威值）
  veiled: number; // 今日落幕条数
  limit: number; // Worker 返回的额度
}

export const usage = storage.defineItem<Usage>('local:usage', {
  fallback: { date: '', checked: 0, veiled: 0, limit: 2000 },
});

export type FailureReason = 'unreachable' | 'timeout' | 'quota' | 'upstream' | 'context';

export const today = () => new Date().toISOString().slice(0, 10);

export async function readSettings(): Promise<Settings> {
  const s = await settings.getValue();
  return { ...DEFAULT_SETTINGS, ...s };
}

/** Worker 地址覆盖（自托管或调试用，界面不暴露）；null 用内置地址 */
export const proxyUrl = storage.defineItem<string | null>('local:proxyUrl', { fallback: null });
