const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('wechat-draft-sync dry run prints draft payload without credentials', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-cli-'));
  const imageDir = path.join(root, 'source/images/post');
  const postDir = path.join(root, 'source/_posts');
  fs.mkdirSync(imageDir, { recursive: true });
  fs.mkdirSync(postDir, { recursive: true });
  fs.writeFileSync(path.join(imageDir, 'cover.webp'), 'image');
  fs.writeFileSync(path.join(postDir, 'post.md'), `---
title: CLI Title
slug: cli-title
cover: /images/post/cover.webp
description: CLI digest
---
Body text.
`);

  const result = spawnSync(process.execPath, [
    path.join(process.cwd(), 'tools/wechat-draft-sync.js'),
    '--dry-run'
  ], {
    cwd: root,
    env: { ...process.env, POST: 'source/_posts/post.md' },
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CLI Title/);
  assert.match(result.stdout, /thumb_media_id/);
});
