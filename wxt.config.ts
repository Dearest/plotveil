import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'PlotVeil',
    action: { default_icon: { 16: 'action/neutral-16.png', 24: 'action/neutral-24.png', 32: 'action/neutral-32.png' } },
    description: 'AI spoiler blocker for YouTube comments. Veils spoilers, not keywords.',
    permissions: ['storage'],
    host_permissions: ['*://*.youtube.com/*'],
    web_accessible_resources: [
      { resources: ['action/*'], matches: ['*://*.youtube.com/*'] },
    ],
  },
});
