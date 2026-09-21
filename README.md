# PlotVeil

Keep the surprises. A quiet spoiler blocker for YouTube comments.

PlotVeil covers a comment while it is being checked, and keeps it covered if the check says it
would give the story away. It is not a keyword blocklist: a comment is hidden because, read
against the video you are on, it discloses a concrete plot event — not because it contains the
word "dies".

Website and install instructions: <https://plotveil.app>. The Chrome Web Store listing is under
review; until then the site serves a zip to load as an unpacked extension.

## How Jev is used

The judgment is a single typed **Noul** decision per comment, made by
[Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev), TypeSafe AI's System One
model. There is no chat model and no free-text generation anywhere in the path.

- **The typed question** lives in the extension, not the server:
  [`src/rules/spoiler.ts`](src/rules/spoiler.ts). It asks whether `state.comments.{{id}}` reveals a
  concrete plot event, character fate, ending, twist or match result of `state.video_title` or of
  any title in `state.protected_titles`, with explicit `true` / `false` criteria. Comment text is
  passed as state and the question tells the model to treat state as evidence, never as
  instructions.
- **The call** is in [`proxy/src/index.ts`](proxy/src/index.ts) — a Cloudflare Worker that posts to
  `POST https://api.typesafe.ai/v1/systemone` with `model=jev-latest`, batching up to 20 comments
  per request. The API key exists only as a Worker secret. The Worker holds no product wording:
  the rule text is data sent by the extension, so the server never knows the word "spoiler".
- **The threshold is owned by application code, not the model.** Jev returns a probability; the
  extension compares it against a user-chosen threshold — `easygoing` 0.85, `standard` 0.7,
  `cautious` 0.5 — and covers the comment when the probability meets it. Lowering the threshold
  covers more comments and raises the false-positive rate.
- **Failure keeps the cover.** A network error, a quota rejection or a malformed answer leaves the
  comment covered rather than letting it through. Revealing is always the user's explicit action,
  and a Veil Keeper button stays on a revealed comment so it can be covered again.

Changing the question wording bumps `RULE_VERSION`, which invalidates cached verdicts.

### Evaluation

[`docs/qa/jev-v2-evaluation.json`](docs/qa/jev-v2-evaluation.json) holds 10 synthetic
English/Chinese/Japanese and prompt-injection samples. Rule v1 and v2 both scored 10/10; input
tokens went from 2300 to 2093 (about −9%). This is a regression check on a small hand-written set,
not a cross-language production accuracy claim, and the single-run latency it records is not a
benchmark.

### What leaves your machine

An anonymous install ID, the comment text, the video title and channel, and any titles you chose to
protect. No cookies, no account, no browsing history, no comment author names. The install ID is
used for quota accounting at the Worker and is not forwarded to Jev. Comment text may itself contain
personal information; PlotVeil does not claim otherwise. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and <https://plotveil.app/privacy>.

## Development

WXT + React + TypeScript + Tailwind v4. Chrome Manifest V3. Node 24 and pnpm.

```sh
pnpm install
pnpm dev
pnpm compile
pnpm test
pnpm --dir proxy test
pnpm build
pnpm zip
pnpm qa
```

Tests run offline; no API key is needed for `pnpm test` or the Worker tests.

Start with [AGENTS.md](AGENTS.md), [tasks](docs/TASKS.md), [design system](docs/DESIGN.md), and
[architecture](docs/ARCHITECTURE.md).

The Worker in `proxy/` and the landing page in `site/` are deployed separately (`landing/`).
`pnpm icons` requires rsvg-convert and uses the existing SVG mark.
QA fixture: <http://127.0.0.1:4178/docs/qa/product-fixture.html>. Wait for settled checks before
running DOM checks.
Manual paid evaluation: `node --env-file=.env.local scripts/evaluate-jev.ts`. Never commit secrets.

Bilibili comments/danmaku and Japanese danmaku sites would share the same judgment core; they are
not supported yet.

## License

[MIT](LICENSE).
