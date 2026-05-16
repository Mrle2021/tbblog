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
