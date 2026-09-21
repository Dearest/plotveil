import { createYouTubeAdapter } from '../src/sites/youtube/adapter';
import { spoilerRule } from '../src/rules/spoiler';
import { runSite } from '../src/runner';
import { browser } from 'wxt/browser';
import { judgeBatch, reportVeiled } from '../src/judge/client';
import { reportTabStatus } from '../src/action-status';
import { readSettings, settings } from '../src/storage';
import type { ProtectionCommandMessage } from '../src/messages';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_idle',
  main(ctx) {
    const runner = runSite(createYouTubeAdapter(), spoilerRule, {
      readSettings,
      watchSettings: cb => settings.watch(value => { if (value) cb(value); }),
      judge: judgeBatch, publish: reportTabStatus, reportVeiled,
      enable: async () => settings.setValue({ ...await readSettings(), enabled: true }),
    });
    const listener = (raw: unknown, _sender: unknown, respond: (value: unknown) => void) => {
      const message = raw as ProtectionCommandMessage | { type: 'get-protection-status' };
      if (message.type === 'get-protection-status') respond(runner.getStatus());
      if (message.type === 'protection-command' && message.scope === runner.getStatus().scope) {
        runner.command(message.command);
        respond(true);
      }
      return false;
    };
    browser.runtime.onMessage.addListener(listener);
    ctx.onInvalidated(() => { browser.runtime.onMessage.removeListener(listener); runner.dispose(); });
  },
});
