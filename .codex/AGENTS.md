# Codex Blog Stock Image Workflow

This Hexo blog stores posts in `source/_posts` and static images in `source/images`.

## Goal

When asked to find images for a post, Codex should:

1. Read the target Markdown post and `tools/style_guide.md`.
2. Generate a structured stock image plan with one cover image and 2-4 section illustrations.
3. Save the plan to `tools/image_prompts/<slug>.json`.
4. Search free stock photo APIs, download selected images, crop them to the local standard, and save them into `source/images/<slug>/`.
5. Print a Markdown diff first. Only write Markdown changes when the command includes `--apply` or the user explicitly confirms.

## Naming

- Use the post frontmatter `slug` when present; otherwise use the Markdown filename without `.md`.
- Cover image: `cover.webp` by default.
- Figures: `fig-01.webp`, `fig-02.webp`, and so on.
- Metadata for downloaded stock photos should live in `source/images/<slug>/credits.json`.

## Markdown Rules

- The `cover` frontmatter field should point to `/images/<slug>/cover.webp`.
- Insert figures after the H2 heading selected by the image plan.
- Use semantic alt text, not empty alt text.
- Do not remove existing manually written images unless the user asks for replacement.
- Do not batch-modify unrelated posts.

## Image Defaults

- Source: Pexels by default; Unsplash is supported when `STOCK_PROVIDER=unsplash`.
- Cover: landscape crop, `1600x900`.
- Figures: landscape crop, `1200x900`.
- Output format: `webp`.
- Quality: `84` unless overridden.
- Prefer conceptual, non-literal photos without faces, logos, readable text, or news-specific brands.
- Store photographer/source metadata so attribution remains easy even when it is not legally required.

## Safety

- Keep `.env` out of git.
- Use `--dry-run` before spending API quota.
- Print diffs before Markdown writes.
- If image files already exist, do not overwrite them unless `--overwrite` or `--regenerate` is provided.
