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

function markdownToWechatHtml(markdown, options = {}) {
  const withoutCover = stripLeadingCover(markdown, options.cover);
  const html = marked.parse(withoutCover, {
    async: false,
    breaks: false,
    gfm: true
  });
  return styleWechatHtml(sanitizeWechatHtml(html)).trim();
}

module.exports = {
  markdownToWechatHtml,
  sanitizeWechatHtml,
  stripLeadingCover,
  styleWechatHtml
};
