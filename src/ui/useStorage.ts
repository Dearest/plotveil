import { useEffect, useState } from 'react';
import type { WxtStorageItem } from 'wxt/utils/storage';

/** 订阅一个 storage item；写入走 item.setValue，其它界面通过 watch 同步。 */
export function useStorageItem<T>(item: WxtStorageItem<T, Record<string, unknown>>): [T, (next: T) => Promise<void>] {
  const [value, setValue] = useState<T>(item.fallback);
  useEffect(() => {
    let alive = true;
    item.getValue().then((v) => alive && setValue(v));
    const unwatch = item.watch((v) => setValue(v ?? item.fallback));
    return () => {
      alive = false;
      unwatch();
    };
  }, [item]);
  return [value, (next: T) => item.setValue(next)];
}
