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
  assert.match(html, /<p style="[^"]*">Paragraph with link\.<\/p>/);
  assert.doesNotMatch(html, /<a\b/);
  assert.match(html, /<blockquote style="[^"]*">/);
  assert.match(html, /<ul style="[^"]*">/);
  assert.match(html, /<p style="[^"]*">code<\/p>/);
  assert.doesNotMatch(html, /<pre\b/);
  assert.doesNotMatch(html, /class="language-text"/);
});

test('markdownToWechatHtml removes the leading cover image when it matches post cover', () => {
  const html = markdownToWechatHtml('![cover](/images/post/cover.webp)\n\n## Start', {
    cover: '/images/post/cover.webp'
  });

  assert.doesNotMatch(html, /cover\.webp/);
  assert.match(html, /<h2 style="[^"]*">Start<\/h2>/);
});

test('markdownToWechatHtml keeps link text and normalizes code blocks for drafts', () => {
  const html = markdownToWechatHtml(`Reference: [relative](/tbblog/post/) and [external](https://example.com).

\`\`\`text
first line
second line
\`\`\`
`);

  assert.match(html, /Reference: relative and external\./);
  assert.doesNotMatch(html, /href=/);
  assert.doesNotMatch(html, /\/tbblog\/post\//);
  assert.match(html, /<p style="[^"]*">first line<br>second line<\/p>/);
  assert.doesNotMatch(html, /<code/);
});

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

test('markdownToWechatHtml highlights prompt and related reading sections', () => {
  const html = markdownToWechatHtml(`## 我的固定提示词

你是我的新闻整理助手。

请基于材料完成任务。

## 相关阅读

- 世界观察 002：为什么我们越来越难相信新闻？
- 我如何用 AI 理解世界？
`);

  assert.match(html, /<section style="[^"]*background: #f8fbff[^"]*" data-wechat-block="prompt"/);
  assert.match(html, /<section style="[^"]*background: #fbfaf7[^"]*" data-wechat-block="related"/);
  assert.match(html, /你是我的新闻整理助手。/);
  assert.match(html, /世界观察 002：为什么我们越来越难相信新闻？/);
  assert.doesNotMatch(html, /<a\b/);
});
