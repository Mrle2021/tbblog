#!/usr/bin/env python3
"""Search free stock photos, crop them, and optionally patch a Hexo Markdown post."""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


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


def request_json(url: str, headers: dict[str, str]) -> dict:
    headers = {
        "User-Agent": "tbblog-stock-image-workflow/1.0",
        "Accept": "application/json",
        **headers,
    }
    req = urllib.request.Request(url, headers=headers)
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Stock API request failed: {exc.code} {detail}") from exc
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(2 * attempt)
    raise SystemExit(f"Stock API request failed after retries: {last_error}")


def search_pexels(query: str, orientation: str, per_page: int) -> list[dict]:
    api_key = os.environ.get("PEXELS_API_KEY")
    if not api_key:
        raise SystemExit("PEXELS_API_KEY is required for STOCK_PROVIDER=pexels.")
    params = urllib.parse.urlencode(
        {
            "query": query,
            "orientation": orientation,
            "per_page": per_page,
            "locale": os.environ.get("PEXELS_LOCALE", "zh-CN"),
        }
    )
    data = request_json(f"https://api.pexels.com/v1/search?{params}", {"Authorization": api_key})
    results = []
    for photo in data.get("photos", []):
        src = photo.get("src", {})
        results.append(
            {
                "id": str(photo.get("id")),
                "download_url": src.get("large2x") or src.get("large") or src.get("original"),
                "source_url": photo.get("url"),
                "photographer": photo.get("photographer"),
                "provider": "pexels",
                "alt": photo.get("alt"),
            }
        )
    return [item for item in results if item.get("download_url")]


def search_unsplash(query: str, orientation: str, per_page: int) -> list[dict]:
    api_key = os.environ.get("UNSPLASH_ACCESS_KEY")
    if not api_key:
        raise SystemExit("UNSPLASH_ACCESS_KEY is required for STOCK_PROVIDER=unsplash.")
    params = urllib.parse.urlencode(
        {
            "query": query,
            "orientation": orientation,
            "per_page": per_page,
            "content_filter": "high",
        }
    )
    headers = {"Authorization": f"Client-ID {api_key}", "Accept-Version": "v1"}
    data = request_json(f"https://api.unsplash.com/search/photos?{params}", headers)
    results = []
    for photo in data.get("results", []):
        raw = photo.get("urls", {}).get("raw")
        if raw:
            raw = raw + "&" + urllib.parse.urlencode({"w": 1800, "fit": "max", "fm": "jpg", "q": 90})
        user = photo.get("user", {})
        results.append(
            {
                "id": photo.get("id"),
                "download_url": raw,
                "source_url": photo.get("links", {}).get("html"),
                "download_location": photo.get("links", {}).get("download_location"),
                "photographer": user.get("name"),
                "provider": "unsplash",
                "alt": photo.get("alt_description") or photo.get("description"),
            }
        )
    return [item for item in results if item.get("download_url")]


def track_unsplash_download(photo: dict) -> None:
    location = photo.get("download_location")
    api_key = os.environ.get("UNSPLASH_ACCESS_KEY")
    if not location or not api_key:
        return
    separator = "&" if "?" in location else "?"
    request_json(f"{location}{separator}client_id={api_key}", {"Accept-Version": "v1"})


def choose_photo(query: str, orientation: str, used_ids: set[str], per_page: int) -> dict:
    provider = os.environ.get("STOCK_PROVIDER", "pexels").lower()
    if provider == "unsplash":
        results = search_unsplash(query, orientation, per_page)
    elif provider == "pexels":
        results = search_pexels(query, orientation, per_page)
    else:
        raise SystemExit("STOCK_PROVIDER must be pexels or unsplash.")
    for photo in results:
        key = f"{photo['provider']}:{photo['id']}"
        if key not in used_ids:
            used_ids.add(key)
            return photo
    raise SystemExit(f"No unused stock photo found for query: {query}")


def collect_used_ids() -> set[str]:
    used: set[str] = set()
    for credits_path in (ROOT / "source" / "images").glob("*/credits.json"):
        try:
            credits = json.loads(credits_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for item in credits:
            provider = item.get("provider")
            photo_id = item.get("id")
            if provider and photo_id:
                used.add(f"{provider}:{photo_id}")
    return used


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "tbblog-stock-image-workflow/1.0"})
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                return response.read()
        except urllib.error.URLError as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(2 * attempt)
    raise SystemExit(f"Image download failed after retries: {last_error}")


def crop_image(raw: bytes, output: Path, width: int, height: int, quality: int) -> None:
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:
        raise SystemExit("Pillow is required for cropping. Install it with: python3 -m pip install Pillow") from exc

    with Image.open(BytesIO(raw)) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image = ImageOps.fit(image, (width, height), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        image.save(output, format="WEBP", quality=quality, method=6)


def target_size(aspect: str) -> tuple[int, int]:
    if aspect == "16:9":
        return (int(os.environ.get("STOCK_COVER_WIDTH", "1600")), int(os.environ.get("STOCK_COVER_HEIGHT", "900")))
    return (int(os.environ.get("STOCK_FIGURE_WIDTH", "1200")), int(os.environ.get("STOCK_FIGURE_HEIGHT", "900")))


def split_frontmatter(markdown: str) -> tuple[str, str]:
    if not markdown.startswith("---\n"):
        return "", markdown
    end = markdown.find("\n---", 4)
    if end == -1:
        return "", markdown
    return markdown[4:end].strip(), markdown[end + 4 :].lstrip()


def upsert_cover(frontmatter: str, cover_path: str) -> str:
    if re.search(r"^cover:\s*.*$", frontmatter, flags=re.MULTILINE):
        return re.sub(r"^cover:\s*.*$", f"cover: {cover_path}", frontmatter, flags=re.MULTILINE)
    lines = frontmatter.splitlines()
    for index, line in enumerate(lines):
        if line.startswith("slug:"):
            lines.insert(index + 1, f"cover: {cover_path}")
            return "\n".join(lines)
    lines.append(f"cover: {cover_path}")
    return "\n".join(lines)


def frontmatter_value(frontmatter: str, key: str) -> str:
    match = re.search(rf"^{re.escape(key)}:\s*(.+)$", frontmatter, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def replace_leading_cover_image(body: str, cover_path: str, title: str) -> str:
    pattern = re.compile(
        r"^(\s*(?:<!--.*?-->\s*)*)(!\[[^\]]*\]\([^)]+\))\s*",
        flags=re.DOTALL,
    )
    replacement = f"![{title} 封面图]({cover_path})\n\n"
    if pattern.search(body):
        return pattern.sub(lambda match: f"{match.group(1)}{replacement}", body, count=1)
    return replacement + body


def insert_figure(body: str, heading: str, markdown_image: str) -> str:
    if markdown_image in body:
        return body
    pattern = re.compile(rf"^({re.escape(heading.strip())})\s*$", flags=re.MULTILINE)
    match = pattern.search(body)
    if not match:
        return body.rstrip() + "\n\n" + markdown_image + "\n"
    return body[: match.end()] + "\n\n" + markdown_image + body[match.end() :]


def updated_markdown(original: str, plan: dict) -> str:
    frontmatter, body = split_frontmatter(original)
    slug = plan["slug"]
    cover_path = f"/images/{slug}/{plan['cover']['filename']}"
    title = frontmatter_value(frontmatter, "title") or slug
    if frontmatter:
        frontmatter = upsert_cover(frontmatter, cover_path)
        result = f"---\n{frontmatter}\n---\n{body}"
    else:
        result = original
    frontmatter, body = split_frontmatter(result)
    body = replace_leading_cover_image(body, cover_path, title)
    for figure in plan.get("figures", []):
        image = f"![{figure.get('alt', '')}](/images/{slug}/{figure['filename']})"
        body = insert_figure(body, figure.get("insert_after_heading", ""), image)
    return f"---\n{frontmatter}\n---\n{body.rstrip()}\n" if frontmatter else body.rstrip() + "\n"


def print_diff(path: Path, before: str, after: str) -> None:
    sys.stdout.writelines(
        difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=str(path),
            tofile=str(path),
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("plan", type=Path)
    parser.add_argument("--post", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--regenerate", help="Only fetch one filename such as cover.webp or fig-02.webp.")
    parser.add_argument("--per-page", type=int, default=10)
    args = parser.parse_args()

    load_env()
    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    post_path = args.post or ROOT / plan["post"]
    if not post_path.is_absolute():
        post_path = ROOT / post_path

    image_dir = ROOT / "source" / "images" / plan["slug"]
    image_dir.mkdir(parents=True, exist_ok=True)
    credits_path = image_dir / "credits.json"
    credits = json.loads(credits_path.read_text(encoding="utf-8")) if credits_path.exists() else []
    planned_filenames = {item["filename"] for item in [plan["cover"], *plan.get("figures", [])]}
    if args.overwrite or args.regenerate:
        target_filenames = {args.regenerate} if args.regenerate else planned_filenames
        credits = [item for item in credits if item.get("filename") not in target_filenames]
    used_ids = collect_used_ids()
    quality = int(os.environ.get("STOCK_IMAGE_QUALITY", "84"))
    request_delay = float(os.environ.get("STOCK_REQUEST_DELAY", "1.5"))

    for item in [plan["cover"], *plan.get("figures", [])]:
        filename = item["filename"]
        if args.regenerate and filename != args.regenerate:
            continue
        output = image_dir / filename
        query = item.get("search_query") or item.get("prompt")
        if not query:
            raise SystemExit(f"Missing search_query for {filename}")
        width, height = target_size(item.get("aspect", "4:3"))
        if output.exists() and not args.overwrite and not args.regenerate:
            print(f"skip existing {output}")
            continue
        if args.dry_run:
            print(f"dry-run stock search: {filename} query={query!r} size={width}x{height}")
            continue
        photo = choose_photo(query, item.get("orientation", "landscape"), used_ids, args.per_page)
        raw = download(photo["download_url"])
        crop_image(raw, output, width, height, quality)
        if photo["provider"] == "unsplash":
            track_unsplash_download(photo)
        photo_record = {**photo, "filename": filename, "query": query, "local_path": str(output.relative_to(ROOT))}
        credits.append(photo_record)
        print(output)
        time.sleep(request_delay)

    if not args.dry_run:
        credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    before = post_path.read_text(encoding="utf-8")
    after = updated_markdown(before, plan)
    print_diff(post_path, before, after)
    if args.apply and before != after:
        post_path.write_text(after, encoding="utf-8")
        print(f"updated {post_path}")
    elif before != after:
        print("Markdown not written. Re-run with --apply after reviewing the diff.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
