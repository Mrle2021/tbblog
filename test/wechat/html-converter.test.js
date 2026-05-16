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
  assert.match(html, /<p[^>]*>Paragraph with link\.<\/p>/);
  assert.doesNotMatch(html, /<a\b/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<p>code<\/p>/);
  assert.doesNotMatch(html, /<pre\b/);
  assert.doesNotMatch(html, /class="language-text"/);
});

test('markdownToWechatHtml removes the leading cover image when it matches post cover', () => {
  const html = markdownToWechatHtml('![cover](/images/post/cover.webp)\n\n## Start', {
    cover: '/images/post/cover.webp'
  });

  assert.doesNotMatch(html, /cover\.webp/);
  assert.match(html, /<h2[^>]*>Start<\/h2>/);
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
  assert.match(html, /<p>first line<br>second line<\/p>/);
  assert.doesNotMatch(html, /<code/);
});
