/**
 * PlotVeil proxy — POST /judge
 *
 * 扩展侧只发 { installId, context, question, comments[] }。
 * 这里组装 Jev（TypeSafe systemone）请求、做每日配额，只把 { id → probability } 返回。
 * 密钥只存在这里。规则措辞是扩展带过来的数据，Worker 不知道「剧透」二字。
 */

export interface Env {
  QUOTA: KVNamespace;
  TYPESAFE_API_KEY: string;
  TYPESAFE_URL: string;
  JEV_MODEL: string;
  DAILY_LIMIT: string;
  MAX_BATCH: string;
  MAX_COMMENT_CHARS: string;
}

interface JudgeRequest {
  installId: string;
  context: {
    video_title: string;
    channel: string;
    protected_titles?: string[];
  };
  question: {
    /** 可含 {{id}} 占位，Worker 按评论逐条替换 */
    instructions: string;
    criteria: { true: string; false: string };
  };
  comments: { id: string; text: string }[];
}

interface JevResponse {
  model?: string;
  answers?: Record<string, { type: string; noul?: number }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-max-age': '86400',
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra },
  });

const today = () => new Date().toISOString().slice(0, 10);

const isId = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s);

function validate(body: unknown, env: Env): JudgeRequest | string {
  if (!body || typeof body !== 'object') return 'body must be an object';
  const b = body as Partial<JudgeRequest>;
  if (!isId(b.installId)) return 'installId invalid';
  if (!b.context || typeof b.context !== 'object') return 'context missing';
  if (typeof b.context.video_title !== 'string') return 'context.video_title missing';
  if (typeof b.context.channel !== 'string') return 'context.channel missing';
  if (!b.question || typeof b.question.instructions !== 'string') return 'question.instructions missing';
  if (!b.question.criteria || typeof b.question.criteria.true !== 'string' || typeof b.question.criteria.false !== 'string')
    return 'question.criteria missing';
  if (!Array.isArray(b.comments) || b.comments.length === 0) return 'comments empty';
  const maxBatch = Number(env.MAX_BATCH) || 20;
  if (b.comments.length > maxBatch) return `comments > ${maxBatch}`;
  const maxChars = Number(env.MAX_COMMENT_CHARS) || 10000;
  const seen = new Set<string>();
  for (const c of b.comments) {
    if (!c || !isId(c.id) || typeof c.text !== 'string') return 'comment shape invalid';
    if (seen.has(c.id)) return `duplicate id ${c.id}`;
    seen.add(c.id);
    if (!c.text.trim() || c.text.length > maxChars) return 'comment text exceeds supported length';
  }
  const protectedTitles = Array.isArray(b.context.protected_titles)
    ? b.context.protected_titles.filter((t): t is string => typeof t === 'string').slice(0, 50).map(t => t.slice(0, 300))
    : [];
  if (b.comments.reduce((sum, c) => sum + c.text.length, 0) > 16000) return 'batch text exceeds supported length';
  return {
    installId: b.installId,
    context: {
      video_title: b.context.video_title.slice(0, 300),
      channel: b.context.channel.slice(0, 120),
      protected_titles: protectedTitles,
    },
    question: {
      instructions: b.question.instructions.slice(0, 4000),
      criteria: { true: b.question.criteria.true.slice(0, 1000), false: b.question.criteria.false.slice(0, 1000) },
    },
    comments: b.comments as JudgeRequest['comments'],
  };
}

async function handleJudge(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const parsed = validate(raw, env);
  if (typeof parsed === 'string') return json({ error: parsed }, 400);

  // 配额：先读，超了直接 429；通过后再累加（乐观，不做原子性，配额是软限制）
  const limit = Number(env.DAILY_LIMIT) || 2000;
  const key = `usage:${parsed.installId}:${today()}`;
  const used = Number((await env.QUOTA.get(key)) ?? 0);
  if (used + parsed.comments.length > limit) {
    return json({ reason: 'quota', used, limit }, 429, { 'retry-after': '3600' });
  }

  // 组装 Jev 请求：state 放上下文与评论，questions 每条评论一题
  const comments: Record<string, string> = {};
  for (const c of parsed.comments) comments[c.id] = c.text;
  const questions: Record<string, unknown> = {};
  for (const c of parsed.comments) {
    questions[c.id] = {
      type: 'noul',
      instructions: parsed.question.instructions.replaceAll('{{id}}', c.id),
      criteria: parsed.question.criteria,
    };
  }
  const jevBody = {
    state: {
      video_title: parsed.context.video_title,
      channel: parsed.context.channel,
      protected_titles: parsed.context.protected_titles ?? [],
      comments,
    },
    questions,
    model: env.JEV_MODEL || 'jev-latest',
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let upstream: Response;
  let data: JevResponse;
  try {
    upstream = await fetch(env.TYPESAFE_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(jevBody),
      signal: controller.signal,
    });
    // 只对明确的限流/过载响应做一次退避；网络超时不自动重发，避免重复计费。
    if ([429, 529, 503].includes(upstream.status)) {
      const retryAfter = upstream.headers.get('retry-after');
      const seconds = retryAfter ? Number(retryAfter) : NaN;
      const delay = Number.isFinite(seconds) ? seconds * 1000
        : retryAfter ? Date.parse(retryAfter) - Date.now() : 400 + Math.random() * 200;
      if (Number.isFinite(delay) && delay >= 0 && delay <= 1500) {
        await upstream.body?.cancel();
        await new Promise<void>(resolve => setTimeout(resolve, delay));
        upstream = await fetch(env.TYPESAFE_URL, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.TYPESAFE_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify(jevBody), signal: controller.signal,
        });
      }
    }
    if (!upstream.ok) return json({ error: 'upstream error', status: upstream.status }, 502);
    data = await upstream.json() as JevResponse;
  } catch {
    return json({ error: 'upstream unavailable or invalid response' }, 502);
  } finally {
    clearTimeout(timer);
  }
  const results: Record<string, number> = {};
  for (const c of parsed.comments) {
    const p = data.answers?.[c.id]?.noul;
    if (data.answers?.[c.id]?.type === 'noul' && typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1) results[c.id] = p;
  }

  const newUsed = used + parsed.comments.length;
  ctx.waitUntil(env.QUOTA.put(key, String(newUsed), { expirationTtl: 60 * 60 * 48 }));

  return json({
    schemaVersion: 2,
    results,
    model: data.model,
    usage: { used: newUsed, limit, input_tokens: data.usage?.input_tokens ?? null },
  });
}

async function handleUsage(url: URL, env: Env): Promise<Response> {
  const installId = url.searchParams.get('installId');
  if (!isId(installId)) return json({ error: 'installId invalid' }, 400);
  const limit = Number(env.DAILY_LIMIT) || 2000;
  const used = Number((await env.QUOTA.get(`usage:${installId}:${today()}`)) ?? 0);
  return json({ used, limit, date: today() });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return json({ ok: true, model: env.JEV_MODEL });
    if (url.pathname === '/usage' && req.method === 'GET') return handleUsage(url, env);
    if (url.pathname === '/judge' && req.method === 'POST') return handleJudge(req, env, ctx);
    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
