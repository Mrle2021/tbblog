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
