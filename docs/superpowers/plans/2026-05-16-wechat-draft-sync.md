# WeChat Draft Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local command that turns one Hexo Markdown post into a WeChat Official Account draft.

**Architecture:** Keep the feature as a focused Node.js tool under `tools/wechat/`, with separate modules for parsing posts, converting HTML, resolving assets, calling WeChat APIs, and storing sync state. The first working path is explicit single-post sync via `POST=... npm run wechat:draft`; no automatic publish integration is included in this plan.

**Tech Stack:** Node.js 18+, built-in `node:test`, existing Hexo Markdown renderer dependencies, `dotenv` for local secrets, and WeChat Official Account HTTP APIs.

---

## File Structure

- Create `tools/wechat/post-parser.js`: parse frontmatter, derive slug, expose post metadata and Markdown body.
- Create `tools/wechat/html-converter.js`: convert Markdown to article HTML and normalize site-only constructs.
- Create `tools/wechat/assets.js`: resolve local `/images/...` paths, extract image references, and rewrite uploaded image URLs.
- Create `tools/wechat/wechat-client.js`: fetch access tokens, upload images, add drafts, and update drafts.
- Create `tools/wechat/sync-state.js`: read and write `.wechat-drafts.json`.
- Create `tools/wechat-draft-sync.js`: CLI entrypoint for dry-run and live sync.
- Create `test/wechat/*.test.js`: parser, asset, state, and HTML conversion tests.
- Modify `package.json`: add `wechat:draft` and focused test scripts.
- Modify `.gitignore`: ignore `.wechat-drafts.json` if not already ignored.

## Task 1: Add Post Parser

**Files:**
- Create: `tools/wechat/post-parser.js`
- Create: `test/wechat/post-parser.test.js`

- [ ] **Step 1: Write the failing parser tests**

Create `test/wechat/post-parser.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wechat/post-parser.test.js`

Expected: FAIL with `Cannot find module '../../tools/wechat/post-parser'`.

- [ ] **Step 3: Implement the parser**

Create `tools/wechat/post-parser.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function parseScalar(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) {
    throw new Error('Post must start with YAML frontmatter');
  }

  const end = raw.indexOf('\n---', 4);
  if (end === -1) {
    throw new Error('Post frontmatter is not closed');
  }

  const frontmatterText = raw.slice(4, end).split(/\r?\n/);
  const body = raw.slice(end + 4).replace(/^\r?\n/, '');
  const data = {};
  let currentKey = null;

  for (const line of frontmatterText) {
    if (!line.trim()) continue;

    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(parseScalar(listItem[1]));
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;

    currentKey = pair[1];
    data[currentKey] = pair[2] === '' ? [] : parseScalar(pair[2]);
  }

  return { data, body };
}

function parsePostFile(sourcePath) {
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const missing = [];

  if (!data.title) missing.push('title');
  if (!data.cover) missing.push('cover');
  if (missing.length > 0) {
    throw new Error(`Missing required frontmatter: ${missing.join(', ')}`);
  }

  const slug = data.slug || path.basename(sourcePath, path.extname(sourcePath));

  return {
    sourcePath,
    title: data.title,
    slug,
    date: data.date || '',
    cover: data.cover,
    digest: data.description || data.excerpt || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    body
  };
}

module.exports = {
  parseFrontmatter,
  parsePostFile
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wechat/post-parser.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/wechat/post-parser.js test/wechat/post-parser.test.js
git commit -m "feat: parse posts for wechat drafts"
```

## Task 2: Add HTML Converter

**Files:**
- Create: `tools/wechat/html-converter.js`
- Create: `test/wechat/html-converter.test.js`

- [ ] **Step 1: Write the failing converter tests**

Create `test/wechat/html-converter.test.js`:

```js
const assert = require('node:assert/strict');
const test = require('node:test');

const { markdownToWechatHtml } = require('../../tools/wechat/html-converter');

test('markdownToWechatHtml renders common article structures', () => {
  const html = markdownToWechatHtml(`# Title

Paragraph with [link](https://example.com).

> Quote.

- One
- Two

\`\`\`text
code
\`\`\`
`);

  assert.match(html, /<h1[^>]*>Title<\/h1>/);
  assert.match(html, /<p[^>]*>Paragraph with <a href="https:\/\/example.com"/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<pre><code/);
});

test('markdownToWechatHtml removes the leading cover image when it matches post cover', () => {
  const html = markdownToWechatHtml('![cover](/images/post/cover.webp)\n\n## Start', {
    cover: '/images/post/cover.webp'
  });

  assert.doesNotMatch(html, /cover\.webp/);
  assert.match(html, /<h2[^>]*>Start<\/h2>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wechat/html-converter.test.js`

Expected: FAIL with `Cannot find module '../../tools/wechat/html-converter'`.

- [ ] **Step 3: Implement the converter**

Create `tools/wechat/html-converter.js`:

```js
const { marked } = require('marked');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingCover(markdown, cover) {
  if (!cover) return markdown;
  const pattern = new RegExp(`^\\s*!\\[[^\\]]*\\]\\(${escapeRegExp(cover)}\\)\\s*`, 'm');
  return markdown.replace(pattern, '');
}

function markdownToWechatHtml(markdown, options = {}) {
  const withoutCover = stripLeadingCover(markdown, options.cover);
  return marked.parse(withoutCover, {
    async: false,
    breaks: false,
    gfm: true,
    mangle: false,
    headerIds: false
  }).trim();
}

module.exports = {
  markdownToWechatHtml,
  stripLeadingCover
};
```

- [ ] **Step 4: Add direct dependency if needed**

If `node -e "require('marked')"` fails, add `marked` as a direct dependency:

Run: `npm install marked@^12.0.2`

Expected: `package.json` and `package-lock.json` are updated.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/wechat/html-converter.test.js`

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add tools/wechat/html-converter.js test/wechat/html-converter.test.js package.json package-lock.json
git commit -m "feat: convert posts to wechat html"
```

## Task 3: Add Asset Resolution and Rewriting

**Files:**
- Create: `tools/wechat/assets.js`
- Create: `test/wechat/assets.test.js`

- [ ] **Step 1: Write the failing asset tests**

Create `test/wechat/assets.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wechat/assets.test.js`

Expected: FAIL with `Cannot find module '../../tools/wechat/assets'`.

- [ ] **Step 3: Implement asset helpers**

Create `tools/wechat/assets.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function extractImageSources(html) {
  const sources = new Set();
  const imagePattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imagePattern.exec(html)) !== null) {
    const src = match[1];
    if (src.startsWith('/images/')) sources.add(src);
  }

  return [...sources];
}

function resolveSiteImagePath(projectRoot, src) {
  if (!src.startsWith('/images/')) {
    throw new Error(`Only local /images paths can be resolved: ${src}`);
  }

  const resolved = path.join(projectRoot, 'source', src);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Image file does not exist: ${src} -> ${resolved}`);
  }
  return resolved;
}

function rewriteImageSources(html, replacements) {
  let next = html;
  for (const [from, to] of replacements.entries()) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`src=["']${escaped}["']`, 'g'), `src="${to}"`);
  }
  return next;
}

module.exports = {
  extractImageSources,
  resolveSiteImagePath,
  rewriteImageSources
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wechat/assets.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/wechat/assets.js test/wechat/assets.test.js
git commit -m "feat: resolve wechat draft assets"
```

## Task 4: Add Sync State Store

**Files:**
- Create: `tools/wechat/sync-state.js`
- Create: `test/wechat/sync-state.test.js`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing state tests**

Create `test/wechat/sync-state.test.js`:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { loadState, saveState, upsertDraftState } = require('../../tools/wechat/sync-state');

test('loadState returns empty object when state file is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-state-'));
  assert.deepEqual(loadState(path.join(dir, '.wechat-drafts.json')), {});
});

test('upsertDraftState writes draft metadata by slug', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-state-'));
  const statePath = path.join(dir, '.wechat-drafts.json');

  const state = upsertDraftState({}, {
    slug: 'sample',
    post: 'source/_posts/sample.md',
    draftMediaId: 'MEDIA_ID',
    title: 'Sample'
  });
  saveState(statePath, state);

  const loaded = loadState(statePath);
  assert.equal(loaded.sample.draftMediaId, 'MEDIA_ID');
  assert.equal(loaded.sample.title, 'Sample');
  assert.match(loaded.sample.syncedAt, /^\d{4}-\d{2}-\d{2}T/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wechat/sync-state.test.js`

Expected: FAIL with `Cannot find module '../../tools/wechat/sync-state'`.

- [ ] **Step 3: Implement state helpers**

Create `tools/wechat/sync-state.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function loadState(statePath) {
  if (!fs.existsSync(statePath)) return {};
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function upsertDraftState(state, draft) {
  return {
    ...state,
    [draft.slug]: {
      post: draft.post,
      draftMediaId: draft.draftMediaId,
      syncedAt: new Date().toISOString(),
      title: draft.title
    }
  };
}

module.exports = {
  loadState,
  saveState,
  upsertDraftState
};
```

- [ ] **Step 4: Ignore local sync state**

Add this line to `.gitignore` if it is not present:

```gitignore
.wechat-drafts.json
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/wechat/sync-state.test.js`

Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add tools/wechat/sync-state.js test/wechat/sync-state.test.js .gitignore
git commit -m "feat: store wechat draft sync state"
```

## Task 5: Add WeChat API Client

**Files:**
- Create: `tools/wechat/wechat-client.js`
- Create: `test/wechat/wechat-client.test.js`

- [ ] **Step 1: Write the failing client tests**

Create `test/wechat/wechat-client.test.js`:

```js
const assert = require('node:assert/strict');
const test = require('node:test');

const { WeChatClient, WeChatApiError } = require('../../tools/wechat/wechat-client');

test('WeChatClient fetches and caches access token', async () => {
  const calls = [];
  const client = new WeChatClient({
    appId: 'APP',
    appSecret: 'SECRET',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ access_token: 'TOKEN', expires_in: 7200 })
      };
    }
  });

  assert.equal(await client.getAccessToken(), 'TOKEN');
  assert.equal(await client.getAccessToken(), 'TOKEN');
  assert.equal(calls.length, 1);
});

test('WeChatClient throws readable API errors', async () => {
  const client = new WeChatClient({
    appId: 'APP',
    appSecret: 'SECRET',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ errcode: 40164, errmsg: 'invalid ip' })
    })
  });

  await assert.rejects(
    () => client.getAccessToken(),
    (error) => error instanceof WeChatApiError && /40164/.test(error.message)
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wechat/wechat-client.test.js`

Expected: FAIL with `Cannot find module '../../tools/wechat/wechat-client'`.

- [ ] **Step 3: Implement WeChat client**

Create `tools/wechat/wechat-client.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

class WeChatApiError extends Error {
  constructor(endpoint, payload) {
    super(`${endpoint} failed: errcode=${payload.errcode} errmsg=${payload.errmsg}`);
    this.name = 'WeChatApiError';
    this.endpoint = endpoint;
    this.payload = payload;
  }
}

class WeChatClient {
  constructor({ appId, appSecret, fetchImpl = fetch }) {
    if (!appId) throw new Error('WECHAT_APP_ID is required');
    if (!appSecret) throw new Error('WECHAT_APP_SECRET is required');

    this.appId = appId;
    this.appSecret = appSecret;
    this.fetchImpl = fetchImpl;
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  async requestJson(endpoint, url, options) {
    const response = await this.fetchImpl(url, options);
    const payload = await response.json();
    if (payload.errcode && payload.errcode !== 0) {
      throw new WeChatApiError(endpoint, payload);
    }
    return payload;
  }

  async getAccessToken() {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', this.appId);
    url.searchParams.set('secret', this.appSecret);

    const payload = await this.requestJson('getAccessToken', url);
    this.token = payload.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(0, payload.expires_in - 300) * 1000;
    return this.token;
  }

  async uploadDraftImage(filePath) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/media/uploadimg');
    url.searchParams.set('access_token', token);

    const form = new FormData();
    const bytes = fs.readFileSync(filePath);
    const blob = new Blob([bytes]);
    form.set('media', blob, path.basename(filePath));

    const payload = await this.requestJson('uploadDraftImage', url, {
      method: 'POST',
      body: form
    });
    return payload.url;
  }

  async uploadThumb(filePath) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/material/add_material');
    url.searchParams.set('access_token', token);
    url.searchParams.set('type', 'thumb');

    const form = new FormData();
    const bytes = fs.readFileSync(filePath);
    const blob = new Blob([bytes]);
    form.set('media', blob, path.basename(filePath));

    const payload = await this.requestJson('uploadThumb', url, {
      method: 'POST',
      body: form
    });
    return payload.media_id;
  }

  async addDraft(article) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/draft/add');
    url.searchParams.set('access_token', token);

    const payload = await this.requestJson('addDraft', url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ articles: [article] })
    });
    return payload.media_id;
  }

  async updateDraft(mediaId, article) {
    const token = await this.getAccessToken();
    const url = new URL('https://api.weixin.qq.com/cgi-bin/draft/update');
    url.searchParams.set('access_token', token);

    await this.requestJson('updateDraft', url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ media_id: mediaId, index: 0, articles: article })
    });
    return mediaId;
  }
}

module.exports = {
  WeChatApiError,
  WeChatClient
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/wechat/wechat-client.test.js`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/wechat/wechat-client.js test/wechat/wechat-client.test.js
git commit -m "feat: add wechat api client"
```

## Task 6: Add CLI and Dry Run

**Files:**
- Create: `tools/wechat-draft-sync.js`
- Create: `test/wechat/cli-dry-run.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing dry-run test**

Create `test/wechat/cli-dry-run.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wechat/cli-dry-run.test.js`

Expected: FAIL because `tools/wechat-draft-sync.js` does not exist.

- [ ] **Step 3: Implement CLI**

Create `tools/wechat-draft-sync.js`:

```js
#!/usr/bin/env node

require('dotenv').config();

const path = require('node:path');

const { extractImageSources, resolveSiteImagePath, rewriteImageSources } = require('./wechat/assets');
const { markdownToWechatHtml } = require('./wechat/html-converter');
const { parsePostFile } = require('./wechat/post-parser');
const { loadState, saveState, upsertDraftState } = require('./wechat/sync-state');
const { WeChatClient } = require('./wechat/wechat-client');

function hasFlag(name) {
  return process.argv.includes(name);
}

async function main() {
  const projectRoot = process.cwd();
  const postPath = process.env.POST;
  const dryRun = hasFlag('--dry-run');

  if (!postPath) {
    throw new Error('POST is required, for example: POST=source/_posts/example.md npm run wechat:draft');
  }

  const post = parsePostFile(path.resolve(projectRoot, postPath));
  const initialHtml = markdownToWechatHtml(post.body, { cover: post.cover });
  const imageSources = extractImageSources(initialHtml);
  const coverPath = resolveSiteImagePath(projectRoot, post.cover);
  const inlineImagePaths = imageSources.map((src) => [src, resolveSiteImagePath(projectRoot, src)]);

  let thumbMediaId = 'DRY_RUN_THUMB_MEDIA_ID';
  let content = initialHtml;
  let draftMediaId = 'DRY_RUN_DRAFT_MEDIA_ID';

  if (!dryRun) {
    const client = new WeChatClient({
      appId: process.env.WECHAT_APP_ID,
      appSecret: process.env.WECHAT_APP_SECRET
    });

    thumbMediaId = await client.uploadThumb(coverPath);
    const replacements = new Map();
    for (const [src, filePath] of inlineImagePaths) {
      replacements.set(src, await client.uploadDraftImage(filePath));
    }
    content = rewriteImageSources(initialHtml, replacements);
  }

  const article = {
    title: post.title,
    author: process.env.WECHAT_AUTHOR || '',
    digest: post.digest.slice(0, 120),
    content,
    thumb_media_id: thumbMediaId,
    need_open_comment: 0,
    only_fans_can_comment: 0
  };

  const statePath = path.join(projectRoot, '.wechat-drafts.json');
  const state = loadState(statePath);
  const previous = state[post.slug];

  if (!dryRun) {
    const client = new WeChatClient({
      appId: process.env.WECHAT_APP_ID,
      appSecret: process.env.WECHAT_APP_SECRET
    });
    draftMediaId = previous?.draftMediaId
      ? await client.updateDraft(previous.draftMediaId, article)
      : await client.addDraft(article);

    saveState(statePath, upsertDraftState(state, {
      slug: post.slug,
      post: postPath,
      draftMediaId,
      title: post.title
    }));
  }

  console.log(JSON.stringify({
    dryRun,
    slug: post.slug,
    title: post.title,
    imageCount: inlineImagePaths.length,
    article,
    draftMediaId
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
```

- [ ] **Step 4: Add package scripts**

Modify `package.json` scripts to include:

```json
"wechat:draft": "node tools/wechat-draft-sync.js",
"test:wechat": "node --test test/wechat/*.test.js"
```

- [ ] **Step 5: Add dependency if needed**

If `node -e "require('dotenv')"` fails, add it:

Run: `npm install dotenv@^16.4.7`

Expected: `package.json` and `package-lock.json` are updated.

- [ ] **Step 6: Run dry-run test**

Run: `node --test test/wechat/cli-dry-run.test.js`

Expected: PASS, 1 test.

- [ ] **Step 7: Commit**

```bash
git add tools/wechat-draft-sync.js test/wechat/cli-dry-run.test.js package.json package-lock.json
git commit -m "feat: add wechat draft sync cli"
```

## Task 7: Verify Against a Real Local Post

**Files:**
- No planned source file changes unless verification reveals a concrete bug.

- [ ] **Step 1: Run all WeChat tests**

Run: `npm run test:wechat`

Expected: all tests pass.

- [ ] **Step 2: Run dry-run against a real post**

Run:

```bash
POST=source/_posts/ai-reading-world-weekly-news-workflow.md npm run wechat:draft -- --dry-run
```

Expected: JSON output includes the post title, non-empty `content`, `thumb_media_id`, and `imageCount`.

- [ ] **Step 3: Confirm `.env` shape without printing secrets**

Run:

```bash
node -e "require('dotenv').config(); console.log(Boolean(process.env.WECHAT_APP_ID), Boolean(process.env.WECHAT_APP_SECRET))"
```

Expected: `true true`.

- [ ] **Step 4: Run one live smoke test**

Run:

```bash
POST=source/_posts/ai-reading-world-weekly-news-workflow.md npm run wechat:draft
```

Expected: command exits 0, `.wechat-drafts.json` is written, and the article appears in the WeChat draft box.

- [ ] **Step 5: Commit any verification fixes**

If a bug fix was required, inspect the exact changed files first:

```bash
git status --short tools/wechat tools/wechat-draft-sync.js test/wechat package.json package-lock.json .gitignore
git add tools/wechat tools/wechat-draft-sync.js test/wechat package.json package-lock.json .gitignore
git commit -m "fix: stabilize wechat draft sync"
```

## Self-Review

- Spec coverage: single-post command, frontmatter parsing, Markdown conversion, image upload path, draft creation/update, local state, and secret handling are covered.
- Intentional deferral: automatic integration with `npm run publish` is deferred until the explicit single-post command is proven stable.
- Placeholder scan: no task relies on a future unspecified implementation; each task includes concrete file paths, test commands, expected outcomes, and code.
- Type consistency: shared names are `parsePostFile`, `markdownToWechatHtml`, `extractImageSources`, `resolveSiteImagePath`, `rewriteImageSources`, `WeChatClient`, `loadState`, `saveState`, and `upsertDraftState`.
