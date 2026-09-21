import { useState } from 'react';
import { browser } from 'wxt/browser';
import { installId, settings, today, usage, type CurtainStyle } from '../../src/storage';
import { SensitivitySegmented } from '../../src/ui/Segmented';
import { useStorageItem } from '../../src/ui/useStorage';

function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="pv-rule-short mb-6" />
      <h2 className="pv-title text-xl m-0">{title}</h2>
      <p className="m-0 mt-1 mb-4 text-sm text-ink-2 max-w-[480px]">{hint}</p>
      {children}
    </section>
  );
}

function TagInput({ values, placeholder, onChange, label }: { values: string[]; placeholder: string; onChange: (v: string[]) => void; label: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2 m-0 mb-3 p-0 list-none">
          {values.map((v) => (
            <li key={v} className="pv-tag">
              <span>{v}</span>
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 max-w-[480px]">
        <input
          className="pv-input"
          aria-label={label}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="pv-btn" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

function CurtainOption({ value, current, title, onPick, children }: { value: CurtainStyle; current: CurtainStyle; title: string; onPick: (v: CurtainStyle) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={current === value} className="pv-radio" onClick={() => onPick(value)}>
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="flex gap-2 items-start">
        <div className="w-6 h-6 rounded-full bg-paper-2 border border-rule flex-none" />
        <div className="flex-1 min-w-0">
          <div className="pv-mini-line w-24 mb-2" />
          {children}
        </div>
      </div>
    </button>
  );
}

export default function App() {
  const [s, setSettings] = useStorageItem(settings);
  const [u] = useStorageItem(usage);
  const [seat] = useStorageItem(installId);
  const [copied, setCopied] = useState(false);
  const version = browser.runtime.getManifest().version;
  const checked = u.date === today() ? u.checked : 0;

  return (
    <main className="mx-auto w-[560px] max-w-[calc(100vw-32px)] py-12 px-4">
      <header className="flex items-baseline justify-between mb-10">
        <h1 className="pv-display text-3xl m-0 leading-none">PlotVeil</h1>
        <span className="pv-mono text-xs text-ink-2">v{version}</span>
      </header>

      <Group title="Sensitivity" hint="PlotVeil asks how likely each comment is to spoil the work. Cautious veils above 50%, Standard above 70%, Easygoing above 85%.">
        <div className="max-w-[360px]">
          <SensitivitySegmented value={s.sensitivity} onChange={(v) => setSettings({ ...s, sensitivity: v })} />
        </div>
      </Group>

      <Group title="Comment mask" hint="Unchecked comments stay hidden. You can reveal any comment and hide it again.">
        <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Curtain style">
          <CurtainOption value="cover" current={s.curtain} title="Cover" onPick={(v) => setSettings({ ...s, curtain: v })}>
            <div className="pv-mini-curtain h-9">Show anyway <img src="/action/guard-32.png" width="20" height="20" alt="" /></div>
            <div className="pv-mini-line w-16 mt-2 opacity-70" />
          </CurtainOption>
          <CurtainOption value="collapse" current={s.curtain} title="Collapse" onPick={(v) => setSettings({ ...s, curtain: v })}>
            <div className="pv-mini-curtain h-5">Show anyway <img src="/action/guard-32.png" width="20" height="20" alt="" /></div>
            <div className="pv-mini-line w-16 mt-2 opacity-70" />
          </CurtainOption>
        </div>
      </Group>

      <Group title="What you're watching" hint="Optional. You're already covered for the video you're on. Add titles to also veil comments that spoil them elsewhere.">
        <TagInput label="Add a title" values={s.watching} placeholder="Add a show, film or game…" onChange={(v) => setSettings({ ...s, watching: v })} />
      </Group>

      <Group title="Trusted channels" hint="Comments under these channels are never veiled. Use the channel name as it appears under the video.">
        <TagInput label="Add a channel" values={s.trustedChannels} placeholder="Add a channel…" onChange={(v) => setSettings({ ...s, trustedChannels: v })} />
      </Group>

      <Group title="Daily usage" hint="Cached judgments are reused. Changing sensitivity does not use additional checks.">
        <div className="pv-mono text-sm leading-7">
          <div>
            {String(checked).padStart(4, '0')} / {u.limit} comments checked today
          </div>
          <div className="flex items-center gap-3">
            <span>Installation&nbsp;&nbsp;{seat ?? '—'}</span>
            {seat && (
              <button
                type="button"
                className="pv-btn-text"
                onClick={() => {
                  navigator.clipboard.writeText(seat).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
        </div>
      </Group>

      <Group title="About" hint={`PlotVeil ${version}. Keep the surprises.`}>
        <p className="m-0 text-sm max-w-[480px]">Comment text, video title, channel name and your optional protected titles are sent for checking. A random installation ID is sent to our server for usage limits. No account or cookies are sent.</p>
        <p className="m-0 mt-2 text-sm text-ink-2">
          Feedback:{' '}
          <a className="text-ink underline decoration-1 underline-offset-[3px] hover:text-curtain" href="mailto:hello@plotveil.app">
            hello@plotveil.app
          </a>
        </p>
      </Group>
    </main>
  );
}
