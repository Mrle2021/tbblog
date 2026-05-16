# WeChat Draft Typography Design

## Goal

Improve the visual quality of generated WeChat drafts without changing the Hexo blog output or the Markdown authoring workflow.

The first pass uses a conservative "balanced" style: normal body text stays restrained, while section headings, quotes, prompt blocks, images, and related reading receive light visual treatment.

## Scope

In scope:

- Add a WeChat-only HTML styling layer after Markdown conversion.
- Use inline CSS because WeChat draft content does not preserve external stylesheets.
- Keep generated HTML compatible with the current draft API flow.
- Preserve the existing safety rules: no external links, no `<pre>`, no `<code>`, and no site-relative link URLs in article content.
- Add tests for the key typography and sanitization rules.

Out of scope:

- Changing Hexo theme output.
- Adding per-category visual themes.
- Automatically publishing WeChat articles.
- Restoring clickable related-reading links.
- Building a full visual editor or template system.

## Typography Rules

The renderer should apply these rules to the WeChat draft HTML:

- `h2`: chapter heading with stronger weight, larger top spacing, and a subtle left accent line.
- `p`: readable line height, restrained dark-gray text, and consistent paragraph spacing.
- `blockquote`: light background callout with a left border for important statements.
- `ul` and `li`: readable spacing and indentation for scan-friendly lists.
- `img`: full-width responsive images with vertical spacing and subtle rounded corners.
- "我的固定提示词" section: style the following prompt content as a light card so it is easy to read and copy.
- "相关阅读" section: style the list as a lightweight recommendation block, preserving only text titles.

## Data Flow

1. Parse the Markdown post.
2. Remove the leading cover image from the body if it matches the post cover.
3. Convert Markdown to HTML with `marked`.
4. Sanitize risky structures:
   - unwrap links and keep link text;
   - normalize code blocks into plain paragraph content;
   - remove generated class attributes.
5. Apply WeChat typography styles with inline CSS.
6. Upload cover and inline images to WeChat.
7. Rewrite local image sources to uploaded WeChat image URLs.
8. Submit the draft through the WeChat draft API.

## Components

- `tools/wechat/html-converter.js`
  - Keep `markdownToWechatHtml()` as the public conversion entrypoint.
  - Add or extend small helpers for sanitization and inline typography.
  - Keep the module deterministic so tests can assert exact style behavior.

- `test/wechat/html-converter.test.js`
  - Verify that links remain unwrapped.
  - Verify that code blocks remain normalized.
  - Verify representative inline styles for headings, body paragraphs, quotes, lists, images, prompt cards, and related reading.

## Error Handling

The typography layer should not call external services and should not introduce new runtime configuration.

If the input Markdown does not contain the special sections "我的固定提示词" or "相关阅读", normal heading and paragraph styling still applies.

If future posts use different section titles, they will receive the default heading and body styles until we explicitly add new section detection rules.

## Testing

Run:

```bash
npm run test:wechat
npm run build
POST=source/_posts/ai-reading-world-weekly-news-workflow.md npm run wechat:draft -- --dry-run
```

Expected checks:

- WeChat tests pass.
- Hexo build passes.
- Dry-run content still contains no `<a>`, `<pre>`, `<code>`, or `/tbblog/` link remnants.
- Dry-run content includes inline styles for the major typography elements.

## Rollout

After implementation:

1. Push the change to `main`.
2. Run `npm run deploy:vps`.
3. Run one real WeChat draft sync from the VPS container.
4. Review the generated draft visually in the WeChat backend.
5. Adjust typography constants only if the first draft is too dense, too decorative, or hard to scan.
