const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sharp = require('sharp');

const { prepareWechatImage, cleanupPreparedImages } = require('../../tools/wechat/image-prep');

test('prepareWechatImage converts thumb uploads to small jpg files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-image-prep-'));
  const input = path.join(dir, 'cover.webp');
  await sharp({
    create: {
      width: 1600,
      height: 900,
      channels: 3,
      background: '#5b8def'
    }
  }).webp().toFile(input);

  const prepared = await prepareWechatImage(input, { kind: 'thumb' });

  assert.equal(path.extname(prepared.path), '.jpg');
  assert.ok(fs.statSync(prepared.path).size <= 64 * 1024);

  cleanupPreparedImages([prepared]);
  assert.equal(fs.existsSync(prepared.path), false);
});

test('prepareWechatImage keeps supported inline png files unchanged', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-image-prep-'));
  const input = path.join(dir, 'inline.png');
  await sharp({
    create: {
      width: 20,
      height: 20,
      channels: 3,
      background: '#ffffff'
    }
  }).png().toFile(input);

  const prepared = await prepareWechatImage(input, { kind: 'image' });

  assert.equal(prepared.path, input);
  assert.equal(prepared.temporary, false);
});
