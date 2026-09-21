import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { settings, usage, today } from '../../src/storage';
import { EMPTY_STATUS, KEEPERS, statusTitle, statusDetail, statusAction } from '../../src/protection';
import type { ProtectionStatus } from '../../src/protection';
import type { ProtectionCommandMessage, TabStatusMessage } from '../../src/messages';
import { SENSITIVITY_HINT, SensitivitySegmented } from '../../src/ui/Segmented';
import { useStorageItem } from '../../src/ui/useStorage';

export default function App() {
  const [s, setSettings] = useStorageItem(settings);
  const [u] = useStorageItem(usage);
  const [snapshot, setSnapshot] = useState<ProtectionStatus>(EMPTY_STATUS);
  const [tabId, setTabId] = useState<number>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    let id: number | undefined;
    const listener = (raw: unknown, sender: { tab?: { id?: number } }) => {
      const msg = raw as TabStatusMessage;
      if (alive && sender.tab?.id === id && msg.type === 'tab-status') setSnapshot(msg.status);
    };
    browser.runtime.onMessage.addListener(listener);
    void browser.tabs.query({ active: true, currentWindow: true }).then(async tabs => {
      id = tabs[0]?.id;
      if (!alive || id === undefined) return;
      setTabId(id);
      try {
        const result = await browser.tabs.sendMessage(id, { type: 'get-protection-status' }) as ProtectionStatus;
        if (alive && result) setSnapshot(result);
      } catch { /* 非适用页面没有 content script，保持 Neutral。 */ }
    });
    return () => { alive = false; browser.runtime.onMessage.removeListener(listener); };
  }, []);
  const view: ProtectionStatus = !s.enabled && snapshot.scope ? { ...snapshot, phase: 'off' } : snapshot;
  const action = statusAction(view);
  async function runAction() {
    if (!action || tabId === undefined || !view.scope) return;
    setBusy(true);
    try {
      await browser.tabs.sendMessage(tabId, { type: 'protection-command', scope: view.scope, command: action.command } satisfies ProtectionCommandMessage);
      const next = await browser.tabs.sendMessage(tabId, { type: 'get-protection-status' }) as ProtectionStatus;
      if (next) setSnapshot(next);
    } catch { setSnapshot({ ...view, phase: 'error', reason: 'unreachable' }); }
    finally { setBusy(false); }
  }
  return (
    <main className="w-[320px] p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="pv-title text-xl leading-tight m-0">PlotVeil</h1>
        <button type="button" role="switch" aria-checked={s.enabled} aria-label="Enable spoiler protection"
          className="pv-switch" onClick={() => setSettings({ ...s, enabled: !s.enabled })} />
      </header>
      <section className="mt-4" aria-label="Current video protection">
        <div className="flex items-center gap-3">
          <img src={`/action/${KEEPERS[view.phase]}-64.png`} alt="" width="48" height="48" />
          <p className="m-0 text-sm">{statusTitle(view)}</p>
        </div>
        {view.scope && <p className="text-xs text-ink-2 mt-3 mb-0">{statusDetail(view)}</p>}
        {action && <button type="button" disabled={busy} className="pv-btn mt-3" onClick={() => void runAction()}>{action.label}</button>}
      </section>
      <div className="pv-tear" />
      <section>
        <div className="text-sm font-semibold mb-2">Sensitivity</div>
        <SensitivitySegmented value={s.sensitivity} onChange={v => setSettings({ ...s, sensitivity: v })} />
        <p className="m-0 mt-2 text-xs text-ink-2">{SENSITIVITY_HINT[s.sensitivity]}</p>
      </section>
      <div className="pv-tear" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-2">{u.date === today() ? u.veiled : 0} hidden today</span>
        <button type="button" className="pv-btn-text" onClick={() => browser.runtime.openOptionsPage()}>Settings</button>
      </div>
    </main>
  );
}
