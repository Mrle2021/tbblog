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
    gfm: true
  }).trim();
}

module.exports = {
  markdownToWechatHtml,
  stripLeadingCover
};
