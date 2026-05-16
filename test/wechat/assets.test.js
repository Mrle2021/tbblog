const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  extractImageSources,
  resolveSiteImagePath,
  rewriteImageSources
} = require('../../tools/wechat/assets');

test('extractImageSources returns unique local image sources', () => {
  const html = '<p><img src="/images/a.webp"></p><img src="/images/a.webp"><img src="https://x.test/a.png">';
  assert.deepEqual(extractImageSources(html), ['/images/a.webp']);
});

test('resolveSiteImagePath maps /images paths into source/images', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-assets-'));
  const file = path.join(root, 'source/images/post/cover.webp');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'image');

  assert.equal(
    resolveSiteImagePath(root, '/images/post/cover.webp'),
    file
  );
});

test('rewriteImageSources replaces uploaded URLs', () => {
  const html = '<img src="/images/a.webp"><img src="/images/b.webp">';
  const rewritten = rewriteImageSources(html, new Map([
    ['/images/a.webp', 'https://mmbiz.qpic.cn/a'],
    ['/images/b.webp', 'https://mmbiz.qpic.cn/b']
  ]));

  assert.match(rewritten, /https:\/\/mmbiz\.qpic\.cn\/a/);
  assert.match(rewritten, /https:\/\/mmbiz\.qpic\.cn\/b/);
});
