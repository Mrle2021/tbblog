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
