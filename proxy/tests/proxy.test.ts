import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../src/index.ts';
const payload = {
  installId: 'pv_test', context: { video_title: 'Film', channel: 'Channel', protected_titles: [] },
  question: { instructions: 'Is {{id}} a spoiler?', criteria: { true: 'Spoiler', false: 'Safe' } },
  comments: [{ id: 'a', text: 'A message' }],
};
function environment(used = '0'): Env {
  return {
    QUOTA: { get: async () => used, put: async () => {} } as unknown as Env['QUOTA'],
    TYPESAFE_API_KEY: 'test-only', TYPESAFE_URL: 'https://test.invalid', JEV_MODEL: 'jev-latest',
    DAILY_LIMIT: '2000', MAX_BATCH: '20', MAX_COMMENT_CHARS: '10000',
  };
}
const context = { waitUntil: (_promise: Promise<unknown>) => {} } as unknown as Parameters<typeof worker.fetch>[2];
async function run(body: unknown = payload, env = environment()) {
  return worker.fetch(new Request('https://proxy.test/judge', { method: 'POST', body: JSON.stringify(body) }), env, context);
}
test('长评论不静默截断；总文本和条数均受限', async () => {
  for (const comments of [
    [{ id: 'a', text: 'x'.repeat(10001) }],
    [{ id: 'a', text: 'x'.repeat(9000) }, { id: 'b', text: 'x'.repeat(9000) }],
    Array.from({ length: 21 }, (_, i) => ({ id: String(i), text: 'message' })),
  ]) assert.equal((await run({ ...payload, comments })).status, 400);
});
test('配额在批次越界前拒绝', async () => {
  assert.equal((await run(payload, environment('2000'))).status, 429);
});
test('明确过载仅退避重试一次；问题包含实际内容路径、概率严格校验', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body)) as { model: string; questions: Record<string, { instructions: string }> };
    assert.equal(body.model, 'jev-latest');
    assert.equal(body.questions.a.instructions, 'Is a a spoiler?');
    return calls === 1 ? new Response('', { status: 529, headers: { 'retry-after': '0' } })
      : Response.json({ answers: { a: { type: 'noul', noul: .9 } }, usage: { input_tokens: 100 } });
  };
  try {
    const res = await run(); assert.equal(res.status, 200);
    const data = await res.json() as { results: object; schemaVersion: number };
    assert.equal(data.schemaVersion, 2);
    assert.deepEqual(data.results, { a: .9 });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
test('错误类型或越界概率不会冒充安全；网络失败不重复计费', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ answers: { a: { type: 'noul', noul: 1.5 } } });
    assert.deepEqual((await (await run()).json() as { results: object }).results, {});
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('network failure'); };
    assert.equal((await run()).status, 502); assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
