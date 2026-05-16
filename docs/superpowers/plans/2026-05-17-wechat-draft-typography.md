# WeChat Draft Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative inline-typography layer for WeChat draft HTML so generated drafts look cleaner while staying compatible with the WeChat draft API.

**Architecture:** Keep `tools/wechat/html-converter.js` as the single public conversion entrypoint. Add deterministic inline styling helpers after the existing sanitization step, using simple regex transformations that match the current `marked` output and preserve the existing safety rules.

**Tech Stack:** Node.js, `marked`, built-in `node:test`, existing `npm run test:wechat` and `npm run build` verification.

---

## File Structure

- Modify `tools/wechat/html-converter.js`
  - Keep `markdownToWechatHtml(markdown, options)` as the public API.
  - Keep `stripLeadingCover()` and `sanitizeWechatHtml()`.
  - Add `styleWechatHtml(html)` and small helpers for headings, paragraphs, quotes, lists, images, prompt card, and related reading styles.

- Modify `test/wechat/html-converter.test.js`
  - Update existing expectations for styled output.
  - Add focused tests for prompt-card styling and related-reading styling.
  - Preserve tests that reject `<a>`, `<pre>`, `<code>`, and `/tbblog/` remnants.

## Task 1: Add Base Inline Typography

**Files:**
- Modify: `test/wechat/html-converter.test.js`
- Modify: `tools/wechat/html-converter.js`

- [ ] **Step 1: Write failing tests for base typography**

Append this test to `test/wechat/html-converter.test.js`:

```js
test('markdownToWechatHtml applies conservative inline typography', () => {
  const html = markdownToWechatHtml(`## Section

Paragraph text.

> Important statement.

- First
- Second

![figure](/images/post/figure.webp)
`);

  assert.match(html, /<h2 style="[^"]*border-left: 4px solid #2f855a/);
  assert.match(html, /<p style="[^"]*line-height: 1\.85/);
  assert.match(html, /<blockquote style="[^"]*background: #f7faf7/);
  assert.match(html, /<ul style="[^"]*padding-left: 1\.2em/);
  assert.match(html, /<li style="[^"]*margin: 0 0 8px/);
  assert.match(html, /<img src="\/images\/post\/figure\.webp" alt="figure" style="[^"]*width: 100%/);
  assert.doesNotMatch(html, /<a\b/);
  assert.doesNotMatch(html, /<pre\b/);
  assert.doesNotMatch(html, /<code\b/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
node --test test/wechat/html-converter.test.js
```

Expected: FAIL because `markdownToWechatHtml()` currently returns unstyled `h2`, `p`, `blockquote`, `ul`, `li`, and `img` tags.

- [ ] **Step 3: Implement the base styling helper**

In `tools/wechat/html-converter.js`, add these constants and helpers above `markdownToWechatHtml()`:

```js
const STYLES = {
  h2: 'margin: 32px 0 14px; padding: 0 0 0 12px; border-left: 4px solid #2f855a; color: #1f2933; font-size: 18px; line-height: 1.45; font-weight: 700;',
  p: 'margin: 0 0 16px; color: #2d3748; font-size: 15px; line-height: 1.85;',
  blockquote: 'margin: 20px 0; padding: 14px 16px; background: #f7faf7; border-left: 4px solid #68a87d; color: #2d3748;',
  ul: 'margin: 0 0 18px; padding-left: 1.2em; color: #2d3748;',
  li: 'margin: 0 0 8px; line-height: 1.8; font-size: 15px;',
  img: 'display: block; width: 100%; height: auto; margin: 18px 0; border-radius: 6px;'
};

function appendStyle(tag, style) {
  return tag.endsWith('>')
    ? tag.replace(/>$/, ` style="${style}">`)
    : tag;
}

function styleImages(html) {
  return html.replace(/<img\b([^>]*)>/gi, (tag) => (
    /\sstyle=/.test(tag) ? tag : appendStyle(tag, STYLES.img)
  ));
}

function styleWechatHtml(html) {
  return styleImages(html)
    .replace(/<h2>/g, `<h2 style="${STYLES.h2}">`)
    .replace(/<p>/g, `<p style="${STYLES.p}">`)
    .replace(/<blockquote>/g, `<blockquote style="${STYLES.blockquote}">`)
    .replace(/<ul>/g, `<ul style="${STYLES.ul}">`)
    .replace(/<li>/g, `<li style="${STYLES.li}">`);
}
```

Then update `markdownToWechatHtml()` to call `styleWechatHtml()` after sanitization:

```js
function markdownToWechatHtml(markdown, options = {}) {
  const withoutCover = stripLeadingCover(markdown, options.cover);
  const html = marked.parse(withoutCover, {
    async: false,
    breaks: false,
    gfm: true
  });
  return styleWechatHtml(sanitizeWechatHtml(html)).trim();
}
```

Update `module.exports`:

```js
module.exports = {
  markdownToWechatHtml,
  sanitizeWechatHtml,
  stripLeadingCover,
  styleWechatHtml
};
```

- [ ] **Step 4: Run focused tests and fix existing expectations**

Run:

```bash
node --test test/wechat/html-converter.test.js
```

Expected: Some older assertions may fail because tags now include inline styles.

Update older assertions only where they require exact unstyled tags. For example:

```js
assert.match(html, /<p style="[^"]*">Paragraph with link\.<\/p>/);
assert.match(html, /<p style="[^"]*">code<\/p>/);
assert.match(html, /<h2 style="[^"]*">Start<\/h2>/);
assert.match(html, /<p style="[^"]*">first line<br>second line<\/p>/);
```

- [ ] **Step 5: Run the full WeChat test suite**

Run:

```bash
npm run test:wechat
```

Expected: PASS.

- [ ] **Step 6: Commit base typography**

Run:

```bash
git add tools/wechat/html-converter.js test/wechat/html-converter.test.js
git commit -m "feat: style wechat draft html"
```

## Task 2: Add Prompt and Related Reading Blocks

**Files:**
- Modify: `test/wechat/html-converter.test.js`
- Modify: `tools/wechat/html-converter.js`

- [ ] **Step 1: Write failing tests for special sections**

Append this test to `test/wechat/html-converter.test.js`:

```js
test('markdownToWechatHtml highlights prompt and related reading sections', () => {
  const html = markdownToWechatHtml(`## 我的固定提示词

你是我的新闻整理助手。

请基于材料完成任务。

## 相关阅读

- 世界观察 002：为什么我们越来越难相信新闻？
- 我如何用 AI 理解世界？
`);

  assert.match(html, /<section style="[^"]*background: #f8fbff[^"]*data-wechat-block="prompt"/);
  assert.match(html, /<section style="[^"]*background: #fbfaf7[^"]*data-wechat-block="related"/);
  assert.match(html, /你是我的新闻整理助手。/);
  assert.match(html, /世界观察 002：为什么我们越来越难相信新闻？/);
  assert.doesNotMatch(html, /<a\b/);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node --test test/wechat/html-converter.test.js
```

Expected: FAIL because no prompt or related-reading section wrappers exist.

- [ ] **Step 3: Add special section wrapping**

In `tools/wechat/html-converter.js`, extend `STYLES` with:

```js
  promptSection: 'margin: 18px 0 24px; padding: 16px; background: #f8fbff; border: 1px solid #dbeafe; border-radius: 8px;',
  relatedSection: 'margin: 18px 0 24px; padding: 16px; background: #fbfaf7; border: 1px solid #eadfcb; border-radius: 8px;'
```

Add this helper above `styleWechatHtml()`:

```js
function wrapSpecialSections(html) {
  return html
    .replace(
      /(<h2 style="[^"]*">我的固定提示词<\/h2>\n)([\s\S]*?)(?=\n<h2 style="|$)/,
      `$1\n<section style="${STYLES.promptSection}" data-wechat-block="prompt">$2</section>`
    )
    .replace(
      /(<h2 style="[^"]*">相关阅读<\/h2>\n)([\s\S]*?)(?=\n<h2 style="|$)/,
      `$1\n<section style="${STYLES.relatedSection}" data-wechat-block="related">$2</section>`
    );
}
```

Update `styleWechatHtml()` so wrapping runs after base tag styling:

```js
function styleWechatHtml(html) {
  const styled = styleImages(html)
    .replace(/<h2>/g, `<h2 style="${STYLES.h2}">`)
    .replace(/<p>/g, `<p style="${STYLES.p}">`)
    .replace(/<blockquote>/g, `<blockquote style="${STYLES.blockquote}">`)
    .replace(/<ul>/g, `<ul style="${STYLES.ul}">`)
    .replace(/<li>/g, `<li style="${STYLES.li}">`);

  return wrapSpecialSections(styled);
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/wechat/html-converter.test.js
```

Expected: PASS.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run test:wechat
npm run build
POST=source/_posts/ai-reading-world-weekly-news-workflow.md npm run wechat:draft -- --dry-run
```

Expected:

- WeChat tests pass.
- Hexo build passes.
- Dry run exits 0 and prints JSON.

- [ ] **Step 6: Inspect dry-run content safety**

Run:

```bash
POST=source/_posts/ai-reading-world-weekly-news-workflow.md npm run wechat:draft -- --dry-run > /tmp/wechat-draft-dry-run.json
node -e "const fs=require('fs'); const raw=fs.readFileSync('/tmp/wechat-draft-dry-run.json','utf8'); const json=JSON.parse(raw.slice(raw.indexOf('{'))); const c=json.article.content; console.log(JSON.stringify({links:(c.match(/<a\\b/g)||[]).length, imgs:(c.match(/<img\\b/g)||[]).length, pre:(c.match(/<pre\\b/g)||[]).length, code:(c.match(/<code\\b/g)||[]).length, oldRootLinks:(c.match(/\\/tbblog\\//g)||[]).length, prompt:(c.match(/data-wechat-block=\"prompt\"/g)||[]).length, related:(c.match(/data-wechat-block=\"related\"/g)||[]).length}, null, 2));"
```

Expected:

```json
{
  "links": 0,
  "imgs": 5,
  "pre": 0,
  "code": 0,
  "oldRootLinks": 0,
  "prompt": 1,
  "related": 1
}
```

- [ ] **Step 7: Commit special sections**

Run:

```bash
git add tools/wechat/html-converter.js test/wechat/html-converter.test.js
git commit -m "feat: highlight wechat draft sections"
```

## Task 3: Deploy and Smoke Test

**Files:**
- No local source file changes expected.

- [ ] **Step 1: Check local git state**

Run:

```bash
git status --short
git log --oneline -3
```

Expected: clean working tree, with the typography commits at the top.

- [ ] **Step 2: Push changes**

Run:

```bash
git push
```

Expected: push to `origin/main` succeeds.

- [ ] **Step 3: Deploy to VPS**

Run:

```bash
npm run deploy:vps
```

Expected: deploy script reaches `[5/5] Check local HTTP` and prints `Deploy finished: http://blog.trailblazeblog.dpdns.org`.

- [ ] **Step 4: Create a fresh WeChat draft from VPS**

Run:

```bash
ssh root@192.210.213.108 'cd /opt/tbblog && docker compose run --rm builder sh -lc '\''POST=source/_posts/ai-reading-world-weekly-news-workflow.md npm run wechat:draft'\'''
```

Expected:

- command exits 0;
- output contains `"dryRun": false`;
- output contains `"draftMediaId": "..."`
- no `errcode` failure is printed.

- [ ] **Step 5: Report review checklist to the user**

Ask the user to check these visual points in the WeChat backend:

- section headings have a subtle left accent;
- body paragraphs are easier to read and not too spacious;
- quotes look like light callouts;
- images have reasonable vertical spacing;
- "我的固定提示词" is grouped as a light card;
- "相关阅读" is grouped as a recommendation block.

If the user reports the draft is too decorative or too dense, adjust only the constants in `STYLES` and rerun Task 2 verification plus Task 3 deploy/smoke test.

## Self-Review

- Spec coverage: The plan covers inline CSS, base typography, prompt card, related reading block, safety rules, tests, dry-run inspection, deployment, and real WeChat draft smoke test.
- Completeness scan: All implementation steps include concrete file paths, code, commands, and expected results.
- Type consistency: Public functions remain `markdownToWechatHtml`, `sanitizeWechatHtml`, and `stripLeadingCover`; new helper names are consistently `styleWechatHtml`, `styleImages`, `appendStyle`, and `wrapSpecialSections`.
