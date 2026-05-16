#!/usr/bin/env python3
"""Create a structured stock image search plan for one Hexo Markdown post."""

from __future__ import annotations

import argparse
import json
import os
import re
import textwrap
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STYLE_GUIDE = ROOT / "tools" / "style_guide.md"
PROMPT_DIR = ROOT / "tools" / "image_prompts"


def load_env() -> None:
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def split_frontmatter(markdown: str) -> tuple[dict[str, str], str]:
    if not markdown.startswith("---\n"):
        return {}, markdown
    end = markdown.find("\n---", 4)
    if end == -1:
        return {}, markdown
    frontmatter = markdown[4:end].strip()
    body = markdown[end + 4 :].lstrip()
    data: dict[str, str] = {}
    for line in frontmatter.splitlines():
        if ":" in line and not line.startswith((" ", "\t", "-")):
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip().split(" #", 1)[0].strip().strip('"').strip("'")
    return data, body


def heading_list(body: str) -> list[str]:
    headings = re.findall(r"^##\s+(.+?)\s*$", body, flags=re.MULTILINE)
    return [f"## {h.strip()}" for h in headings]


def extract_json(text: str) -> dict:
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", cleaned, flags=re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1:
        cleaned = cleaned[first : last + 1]
    return json.loads(cleaned)


def call_chat_completion(article: str, style: str, figures: int, headings: list[str]) -> dict:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is required. Add it to .env or run with --dry-run.")

    model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You create stock photo search plans for a Chinese Hexo blog. "
                    "Return strict JSON only. Search queries must be concise English; alt text must be Chinese."
                ),
            },
            {
                "role": "user",
                "content": textwrap.dedent(
                    f"""
                    Visual style guide:
                    {style}

                    Available H2 headings:
                    {json.dumps(headings, ensure_ascii=False)}

                    Create one cover image search query and {figures} figure image search queries for this Markdown article.
                    The JSON schema must be:
                    {{
                      "cover": {{"search_query": "...", "alt": "...", "filename": "cover.webp", "aspect": "16:9", "orientation": "landscape"}},
                      "figures": [
                        {{"search_query": "...", "alt": "...", "filename": "fig-01.webp", "insert_after_heading": "## ...", "aspect": "4:3", "orientation": "landscape"}}
                      ]
                    }}

                    Article:
                    {article[:18000]}
                    """
                ).strip(),
            },
        ],
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"OpenAI text request failed: {exc.code} {detail}") from exc
    return extract_json(data["choices"][0]["message"]["content"])


def english_slug_words(frontmatter: dict[str, str]) -> str:
    slug = frontmatter.get("slug", "")
    words = re.sub(r"[^a-zA-Z0-9]+", " ", slug).strip()
    if words:
        return words
    return "editorial concept"


def dry_run_plan(frontmatter: dict[str, str], body: str, style: str, figures: int) -> dict:
    title = frontmatter.get("title", "Untitled post")
    headings = heading_list(body)
    selected = headings[:figures] or ["## 正文"]
    base_query = english_slug_words(frontmatter)
    motifs = [
        "quiet editorial photo",
        "city reflection editorial photo",
        "workspace documents editorial photo",
        "person silhouette screen editorial photo",
        "newspaper table morning light",
        "abstract technology editorial photo",
        "library archive documents photo",
    ]
    return {
        "cover": {
            "search_query": f"{base_query} {motifs[0]}",
            "alt": f"{title} 的概念封面图",
            "filename": "cover.webp",
            "aspect": "16:9",
            "orientation": "landscape",
        },
        "figures": [
            {
                "search_query": f"{base_query} {motifs[index % len(motifs)]}",
                "alt": f"{heading.removeprefix('## ')} 章节配图",
                "filename": f"fig-{index:02d}.webp",
                "insert_after_heading": heading,
                "aspect": "4:3",
                "orientation": "landscape",
            }
            for index, heading in enumerate(selected, 1)
        ],
    }


def normalize_plan(plan: dict, style: str, figures: int) -> dict:
    plan.setdefault("figures", [])
    plan["figures"] = plan["figures"][:figures]
    plan.setdefault("cover", {})
    plan["cover"].setdefault("filename", "cover.webp")
    plan["cover"].setdefault("aspect", "16:9")
    plan["cover"].setdefault("orientation", "landscape")
    if "search_query" not in plan["cover"] and "prompt" in plan["cover"]:
        plan["cover"]["search_query"] = plan["cover"]["prompt"]
    for index, item in enumerate(plan["figures"], 1):
        item.setdefault("filename", f"fig-{index:02d}.webp")
        item.setdefault("aspect", "4:3")
        item.setdefault("orientation", "landscape")
        if "search_query" not in item and "prompt" in item:
            item["search_query"] = item["prompt"]
    return plan


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("post", type=Path)
    parser.add_argument("--figures", type=int, default=3)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="Create a heuristic plan without calling an LLM.")
    args = parser.parse_args()

    load_env()
    post_path = args.post if args.post.is_absolute() else ROOT / args.post
    markdown = post_path.read_text(encoding="utf-8")
    frontmatter, body = split_frontmatter(markdown)
    style = STYLE_GUIDE.read_text(encoding="utf-8")
    slug = frontmatter.get("slug") or post_path.stem

    if args.dry_run:
        plan = dry_run_plan(frontmatter, body, style, args.figures)
    else:
        plan = call_chat_completion(markdown, style, args.figures, heading_list(body))
    plan = normalize_plan(plan, style, args.figures)
    plan["post"] = str(post_path.relative_to(ROOT))
    plan["slug"] = slug

    output_path = args.output or PROMPT_DIR / f"{slug}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
