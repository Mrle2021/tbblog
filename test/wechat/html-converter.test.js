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
