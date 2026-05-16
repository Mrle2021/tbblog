const { marked } = require('marked');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingCover(markdown, cover) {
  if (!cover) return markdown;
  const pattern = new RegExp(`^\\s*!\\[[^\\]]*\\]\\(${escapeRegExp(cover)}\\)\\s*`, 'm');
  return markdown.replace(pattern, '');
}

function normalizeCodeBlock(_match, code) {
  const body = code.replace(/\n+$/g, '').replace(/\n/g, '<br>');
  return `<p>${body}</p>`;
}

function sanitizeWechatHtml(html) {
  return html
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<pre><code(?:\s[^>]*)?>([\s\S]*?)<\/code><\/pre>/gi, normalizeCodeBlock)
    .replace(/\sclass="[^"]*"/gi, '');
}

function markdownToWechatHtml(markdown, options = {}) {
  const withoutCover = stripLeadingCover(markdown, options.cover);
  const html = marked.parse(withoutCover, {
    async: false,
    breaks: false,
    gfm: true
  });
  return sanitizeWechatHtml(html).trim();
}

module.exports = {
  markdownToWechatHtml,
  sanitizeWechatHtml,
  stripLeadingCover
};
