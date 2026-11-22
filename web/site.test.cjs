const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const config = fs.readFileSync(path.join(root, 'site-config.js'), 'utf8');
const headers = fs.readFileSync(path.join(root, '_headers'), 'utf8');

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

test('attachment picker exposes camera, photo, file and plugin actions', () => {
  for (const id of ['attachHint','attachmentMenu','cameraAttachBtn','photoAttachBtn','fileAttachBtn','pluginAttachBtn','cameraInput','photoInput','fileInput','attachmentTray','cameraModal','pluginModal']) {
    assert.match(html, new RegExp('id="' + id + '"'), `Missing attachment control: ${id}`);
  }
  assert.match(js, /getUserMedia/);
  assert.match(js, /image:imageAttachment\.dataUrl/);
  assert.match(js, /attachmentText/);
  assert.match(js, /file\.text\(\)/);
  assert.match(headers, /Permissions-Policy: camera=\(self\)/);
  assert.match(css, /\.attachment-menu/);
  assert.match(css, /\.attachment-tray/);
});

test('attachments are sent to CORE only on explicit chat submission and metadata is rendered safely', () => {
  assert.match(js, /attachments:attachmentsToSend\.map\(attachmentMetadata\)/);
  assert.match(js, /renderMessageAttachments/);
  assert.match(js, /const requestBody=.*image:imageAttachment\.dataUrl/s);
  assert.match(html, /только после/);
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
