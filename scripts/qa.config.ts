import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
export default {
  plugins: [{ name: 'fixture-route', configureServer(server: { middlewares: { use(handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): void } }) {
    server.middlewares.use((req, _res, next) => {
      if (req.url?.startsWith('/watch?')) req.url = '/docs/qa/product-fixture.html';
      next();
    });
  } }],
  root: fileURLToPath(new URL('../', import.meta.url)),
  resolve: { alias: { 'wxt/browser': fileURLToPath(new URL('../tests/browser-stub.ts', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 4178, strictPort: true },
};
