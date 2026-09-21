import { createYouTubeAdapter } from '../../src/sites/youtube/adapter';
import { runSite } from '../../src/runner';
import { spoilerRule } from '../../src/rules/spoiler';
import type { Settings } from '../../src/storage';

history.replaceState({}, '', '/watch?v=fixture-a');
let fail = false;
let count = 0;
const comments = document.querySelector<HTMLElement>('#comments')!;
function add(text: string) {
  const el = document.createElement('ytd-comment-view-model');
  el.innerHTML = '<div class="avatar"></div><div class="author" id="author-text">@viewer · 2 weeks ago</div><div id="expander"><div id="content"><span id="content-text"></span></div></div><div class="translation">Translate to Chinese (China)</div><div class="actions">♡  842　　 Reply</div>';
  el.querySelector('#content-text')!.textContent = text;
  comments.append(el);
  return el;
}
add('SPOILER · A fictional ending is revealed here.');
add('A thoughtful soundtrack. I loved every second.');
add('SPOILER · This is a longer fictional comment to test wrapping and layout. '.repeat(3));
const settings: Settings = { enabled: true, sensitivity: 'standard', curtain: 'cover', watching: [], trustedChannels: [] };
const runner = runSite(createYouTubeAdapter(), spoilerRule, {
  readSettings: async () => settings,
  watchSettings: () => () => {},
  judge: async req => {
    await new Promise(resolve => setTimeout(resolve, 250));
    return fail ? { ok: false, reason: 'timeout' } : { ok: true, results: Object.fromEntries(req.items.map(i => [i.id, i.text.includes('SPOILER') ? .95 : .02])) };
  },
  enable: async () => {}, reportVeiled: () => {},
  publish: snapshot => { document.querySelector('#status')!.textContent = JSON.stringify(snapshot, null, 2); },
});
for (const name of ['neutral', 'scout', 'calm', 'guard', 'peek', 'concerned', 'closed']) {
  const el = document.createElement('div'); el.className = 'icon';
  el.innerHTML = `<img width="80" height="80" src="/assets/brand/veil-keeper/functional/${name}-128.png" alt="${name}"><span>${name}</span><div class="sizes"><img width="16" height="16" src="/action/${name}-16.png" alt=""><img width="24" height="24" src="/action/${name}-24.png" alt=""><img width="32" height="32" src="/action/${name}-32.png" alt=""></div>`;
  document.querySelector('#icons')!.append(el);
}
document.querySelector('#theme')!.addEventListener('click', () => { document.documentElement.toggleAttribute('dark'); document.body.classList.toggle('dark'); });
document.querySelector('#failure')!.addEventListener('click', () => { fail = !fail; document.querySelector('#failure')!.textContent = fail ? 'Restore service' : 'Fail next checks'; });
document.querySelector('#add')!.addEventListener('click', () => add('SPOILER · Newly loaded comment ' + ++count));
document.querySelector('#navigate')!.addEventListener('click', () => {
  history.pushState({}, '', '/watch?v=fixture-' + ++count);
  comments.replaceChildren(); add('Safe comment on another video.');
  document.dispatchEvent(new Event('yt-navigate-finish'));
});
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
document.querySelector('#checks')!.addEventListener('click', async () => {
  // 不让首次挂载的异步推理与“恢复 protected”断言竞态。
  while (runner.getStatus().pending) await wait(30);
  const results: string[] = [];
  const check = (name: string, pass: boolean) => { results.push((pass ? 'PASS ' : 'FAIL ') + name); };
  const row = comments.querySelector<HTMLElement>('ytd-comment-view-model')!;
  const host = row.querySelector<HTMLElement>('.pv-host')!;
  const root = host.shadowRoot!;
  const translation = row.querySelector('.translation')!.getBoundingClientRect();
  check('mask does not overlap translation', host.getBoundingClientRect().bottom <= translation.top);
  (root.querySelector('.curtain') as HTMLButtonElement).click();
  await wait(30);
  check('reveal retains keeper', !!row.querySelector('.pv-revealed') && getComputedStyle(root.querySelector('.reveal-control')!).display === 'grid');
  check('revealed status', runner.getStatus().phase === 'revealed');
  (root.querySelector('.reveal-control') as HTMLButtonElement).click();
  check('recover returns protected', runner.getStatus().phase === 'protected');
  const controls = document.querySelector('.ytp-right-controls')!;
  controls.querySelector('.pv-player-host')!.remove();
  await wait(30);
  check('player control restored once', controls.querySelectorAll('.pv-player-host').length === 1);
  document.documentElement.setAttribute('dark', '');
  await wait(30);
  check('theme follows document', host.classList.contains('pv-dark'));
  document.documentElement.removeAttribute('dark');
  const before = row.querySelector('#content-text')!.textContent;
  row.querySelector('#content-text')!.textContent = 'Edited safe comment';
  await wait(500);
  check('edited comment rescanned', !row.querySelector('.pv-host'));
  row.querySelector('#content-text')!.textContent = before;
  await wait(500);
  check('spoiler reappears from session', !!row.querySelector('.pv-veiled'));
  document.querySelector('#results')!.textContent = results.join('\n');
});
