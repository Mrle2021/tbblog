const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { parsePostFile } = require('../../tools/wechat/post-parser');

test('parsePostFile reads frontmatter, slug, digest, cover, and body', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-post-'));
  const post = path.join(dir, 'sample-post.md');
  fs.writeFileSync(post, `---
title: Sample Title
date: 2026-05-16 10:00:00
slug: sample-slug
cover: /images/sample/cover.webp
description: Short digest
tags:
  - AI
categories:
  - Notes
---
# Heading

Body text.
`);

  const parsed = parsePostFile(post);

  assert.equal(parsed.title, 'Sample Title');
  assert.equal(parsed.slug, 'sample-slug');
  assert.equal(parsed.cover, '/images/sample/cover.webp');
  assert.equal(parsed.digest, 'Short digest');
  assert.equal(parsed.body.trim(), '# Heading\n\nBody text.');
  assert.equal(parsed.sourcePath, post);
});

test('parsePostFile falls back to filename slug and excerpt digest', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-post-'));
  const post = path.join(dir, 'fallback-name.md');
  fs.writeFileSync(post, `---
title: Fallback Title
excerpt: Excerpt digest
cover: /images/fallback/cover.webp
---
Body.
`);

  const parsed = parsePostFile(post);

  assert.equal(parsed.slug, 'fallback-name');
  assert.equal(parsed.digest, 'Excerpt digest');
});

test('parsePostFile fails clearly when required fields are missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-post-'));
  const post = path.join(dir, 'missing.md');
  fs.writeFileSync(post, `---
title: Missing Cover
---
Body.
`);

  assert.throws(() => parsePostFile(post), /Missing required frontmatter: cover/);
});
