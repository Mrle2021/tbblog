# WeChat Draft Sync Design

## Goal

Add a safe publishing bridge from this Hexo blog to a WeChat Official Account. When a blog post is ready, the system should create or update a WeChat draft for that post. It must not publish the article automatically.

The first implementation should support a single explicit post command. After that path is reliable, it can be attached to the existing local `npm run publish` workflow.

## Current Project Context

- Blog engine: Hexo 7.
- Posts live in `source/_posts`.
- Static images live in `source/images`.
- Post frontmatter already includes fields that map well to WeChat drafts: `title`, `date`, `slug`, `cover`, `description`, `excerpt`, `tags`, and `categories`.
- Existing local publish entrypoint is `npm run publish`, implemented by `tools/git-auto-push.js`.
- GitHub Actions deploys the blog on pushes to `main`.
- WeChat API prerequisites are available for local testing: `AppID`, `AppSecret`, and an API IP whitelist entry for the current public IP.

## Scope

### In Scope

- Create a command that syncs one local Markdown post to the WeChat draft box.
- Read post frontmatter and Markdown content.
- Convert Markdown to WeChat-compatible HTML.
- Upload the cover image and inline images to WeChat.
- Replace local image paths in the generated HTML with WeChat-hosted image URLs.
- Create a WeChat draft with title, author, digest, cover, and HTML content.
- Store local sync state so the same post can be updated instead of blindly creating duplicate drafts when possible.
- Keep credentials out of git.

### Out of Scope

- Automatic group publishing.
- Browser automation against the WeChat editor.
- Multi-article WeChat messages.
- Rich visual editor parity with the WeChat web editor.
- Server deployment for always-on syncing.

## Recommended Rollout

1. Add an explicit single-post command:

   ```bash
   POST=source/_posts/example.md npm run wechat:draft
   ```

2. Use that command to validate credentials, IP whitelist, image upload, HTML conversion, and draft creation.
3. Once stable, call the same sync module from the existing publish flow after the blog deployment succeeds.
4. Later, move the command to a fixed-IP server if full unattended automation is required.

## Configuration

Use environment variables loaded from `.env` during local runs:

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `WECHAT_AUTHOR`, optional, defaults to the Hexo author or empty string.

Do not print the full AppSecret in logs. Do not commit `.env`.

## Components

### CLI Entrypoint

Add a Node.js script under `tools/`, for example `tools/wechat-draft-sync.js`.

Responsibilities:

- Validate `POST`.
- Load `.env`.
- Parse the target Markdown file.
- Call the conversion and WeChat client modules.
- Write sync state after a successful draft create or update.
- Exit non-zero on API or conversion errors.

### Post Parser

Responsibilities:

- Parse YAML frontmatter and Markdown body.
- Resolve `slug` from frontmatter or filename.
- Resolve `title`, `description` or `excerpt`, `cover`, and `date`.
- Fail with a clear error if required values are missing.

### HTML Converter

Responsibilities:

- Convert Markdown to HTML with the same broad behavior as Hexo where practical.
- Remove or rewrite site-only constructs that WeChat cannot render reliably.
- Normalize headings, paragraphs, blockquotes, lists, code blocks, and links.
- Preserve article structure without depending on the blog theme CSS.

### Asset Uploader

Responsibilities:

- Resolve local image paths such as `/images/<slug>/cover.webp`.
- Upload the cover image as a permanent material or compatible thumb material and return `thumb_media_id`.
- Upload inline images with the WeChat image upload endpoint that returns usable URLs for article content.
- Replace local `src` values with returned WeChat URLs.

### WeChat Client

Responsibilities:

- Fetch `access_token`.
- Add a new draft.
- Update an existing draft when local state has a prior draft `media_id`.
- Normalize API errors into readable messages that include `errcode` and `errmsg`.

### Sync State

Store state in a local JSON file, for example `.wechat-drafts.json`:

```json
{
  "ai-reading-world-weekly-news-workflow": {
    "post": "source/_posts/ai-reading-world-weekly-news-workflow.md",
    "draftMediaId": "MEDIA_ID",
    "syncedAt": "2026-05-16T00:00:00.000Z",
    "title": "AI 读世界：我如何让 AI 帮我整理一周新闻？"
  }
}
```

This file should be ignored by git unless there is a later reason to share sync metadata across machines.

## Data Flow

1. User runs `POST=... npm run wechat:draft`.
2. Script loads config and validates WeChat credentials.
3. Script parses the target post.
4. Converter generates WeChat HTML.
5. Asset uploader uploads cover and inline images.
6. WeChat client creates or updates a draft.
7. Script records the returned draft `media_id`.
8. User reviews and publishes the draft manually in the WeChat backend.

## Error Handling

- Missing credentials: stop before any network request.
- Public IP not whitelisted: show the WeChat error and remind the user to update the API IP whitelist.
- Missing local images: fail before creating a draft, so the draft is not incomplete.
- Unsupported image format: convert or fail clearly. WebP may need conversion if a WeChat endpoint rejects it.
- Draft update failure due to missing or expired `media_id`: fall back to creating a new draft only if the user explicitly passes a future `--create-if-missing` flag.
- API rate or permission errors: fail with `errcode`, `errmsg`, endpoint name, and suggested next check.

## Testing

Use a layered verification path:

- Unit test frontmatter parsing and image path resolution.
- Unit test Markdown-to-HTML conversion on a representative post.
- Dry-run mode that prints the draft payload without calling WeChat.
- Live smoke test against one real post after `.env` and IP whitelist are configured.

## Security

- Keep `WECHAT_APP_SECRET` only in `.env` or deployment secrets.
- Ensure `.env` is ignored by git.
- Avoid logging raw API tokens and secrets.
- Treat `.wechat-drafts.json` as local state because draft IDs are operational metadata.

## Open Implementation Choice

The implementation can stay in JavaScript to match the existing Hexo toolchain and `package.json` scripts. Python is possible because the repo already has Python image tools, but JavaScript is the better first choice for direct integration with the current `npm run publish` flow.
