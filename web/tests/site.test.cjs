const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'site-config.js'), 'utf8');

test('all local assets referenced by HTML exist', () => {
  const paths = [...html.matchAll(/(?:src|href)="(?!https?:|#)([^\"]+)"/g)].map(m => m[1]);
  for (const asset of paths) assert.ok(fs.existsSync(path.join(root, asset)), `Missing asset: ${asset}`);
});

test('HTML ids are unique', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML id detected');
});

test('brand, themes, and chat capabilities are present', () => {
  const fullUi = html + js;
  for (const phrase of ['KOKTUR', 'Наурыз', 'Новый год', 'Рождество', 'Хэллоуин', 'День Республики', 'Құрбан айт', 'Daylight', 'Cyber Neon', 'Фиолетовая орбита', 'aria-live']) assert.ok(fullUi.includes(phrase), `Missing UI phrase: ${phrase}`);
  for (const id of ['koktur','nauryz','newyear','christmas','winter','halloween','republic','independence','oraiz','qurban','spring','daylight','cyber','sapphire','violet']) assert.ok(css.includes(`data-theme="${id}"`), `Missing theme style: ${id}`);
  assert.ok(js.includes('/api/chat?stream=1'));
  assert.ok(js.includes('text/event-stream'));
  assert.ok(js.includes('localStorage'));
  assert.ok(js.includes('data-rename-chat'));
  assert.ok(js.includes('data-delete-chat'));
  assert.ok(js.includes('deepReasoning:currentThinking'));
  assert.ok(js.includes('reasoningEffort:currentThinking'));
  assert.ok(js.includes('maxTokens:currentThinking'));
  assert.ok(js.includes("'response','reply','response_delta'"));
});

test('public configuration does not contain a secret-key assignment', () => {
  assert.match(config, /coreApi:\s*"https:\/\//);
  assert.doesNotMatch(config, /(?:api[_-]?key|secret|password|token)\s*:\s*["'][^"']{8,}["']/i);
});

test('renderer uses escaped content and restricts external links to HTTP(S)', () => {
  assert.ok(js.includes('function escapeHtml'));
  assert.ok(js.includes("['http:','https:'].includes(u.protocol)"));
  assert.ok(js.includes('rel="noopener noreferrer"'));
});


test('landing page has a separate hero, animated CSS 3D mark, CTA, and community links', () => {
  for (const id of ['landingStage','landingLoader','coreObject','enterChatBtn','landingLoginBtn','landingRegisterBtn','landingTrustChatBtn','landingFooterChat','landingCoreStatus']) {
    assert.match(html, new RegExp(`id="${id}"`), `Missing landing element: ${id}`);
  }
  for (const link of ['https://t.me/koktur_bot','https://t.me/vendatelostudios','https://t.me/koktur_ai']) {
    assert.ok(html.includes(link), `Missing Telegram link: ${link}`);
  }
  assert.ok(html.includes('class="app-shell"'), 'Existing chat interface must remain in the page');
  assert.ok(html.includes('class="landing-active"'), 'Landing should appear before opening the chat');
  assert.ok(css.includes('@keyframes core-float'));
  assert.ok(css.includes('@keyframes land-stage-out'));
  assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('body.landing-active .app-shell{display:none}'));
});

test('landing CTA and successful auth transition into the existing chat app', () => {
  assert.ok(js.includes('function enterChatFromLanding'));
  assert.ok(js.includes("$('#enterChatBtn')?.addEventListener('click',enter)"));
  assert.ok(js.includes("if(document.body.classList.contains('landing-active')) enterChatFromLanding"));
  assert.ok(js.includes("$('#switchAuthMode')?.addEventListener('click'"));
  assert.ok(js.includes("window.dispatchEvent(new CustomEvent('koktur-core-status'"));
});


test('landing adds a restrictive public-site Content Security Policy', () => {
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /connect-src 'self' https:\/\/koktur-core\.vendatelogames\.workers\.dev/);
  for (const url of ['https://t.me/koktur_bot','https://t.me/vendatelostudios','https://t.me/koktur_ai']) {
    const start = html.lastIndexOf('<a', html.indexOf(url));
    const end = html.indexOf('>', html.indexOf(url)) + 1;
    const anchor = html.slice(start, end);
    assert.match(anchor, /rel="noopener noreferrer"/);
  }
});
