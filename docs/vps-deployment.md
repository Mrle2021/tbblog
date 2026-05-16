# VPS Blog Deployment

This document records the current production setup for Trailblaze Blog.

## Public URLs

- Blog: `https://blog.trailblazeblog.dpdns.org`
- Image host: `https://trailblazeblog.dpdns.org` remains bound to Cloudflare R2.

## VPS

- Provider: RackNerd
- Public IP: `192.210.213.108`
- Blog deployment root: `/opt/tbblog`
- Blog source checkout: `/opt/tbblog/repo`
- Generated static site: `/opt/tbblog/site`
- VPS deploy script: `/opt/tbblog/deploy.sh`

## Architecture

The VPS runs the blog with Docker Compose:

- `builder`: `node:20-alpine`
  - Mounts `./repo` as `/work`
  - Mounts `./site` as `/site`
  - Runs `npm ci`, `hexo clean`, `hexo generate`, then copies `public/` to `/site`
- `web`: `caddy:2-alpine`
  - Serves `/srv`, mounted from `/opt/tbblog/site`
  - Publishes only host port `80`

Caddy does not bind host port `443`.

## DNS And HTTPS

Cloudflare DNS:

- `A blog -> 192.210.213.108`
- Proxy status: enabled, orange cloud

Cloudflare SSL/TLS:

- Mode: Flexible
- Always Use HTTPS: enabled

Traffic path:

```text
Visitor HTTPS -> Cloudflare -> HTTP port 80 on VPS -> Caddy -> static Hexo files
```

This is intentional because VPS port `443` is already used by Xray.

## Port Ownership

Current important ports on the VPS:

- `80`: Caddy blog origin for Cloudflare
- `443`: Xray
- `2087`: 3x-ui panel

Check with:

```bash
ss -ltnp | grep -E ':80|:443|:2087'
```

Do not bind Caddy to `443` unless Xray is moved or a deliberate SNI routing design is added.

## Deployment

From the local Mac:

```bash
git add -A
git commit -m "update blog"
git push origin main
npm run deploy:vps
```

`npm run deploy:vps` runs:

```bash
ssh root@192.210.213.108 /opt/tbblog/deploy.sh
```

The SSH key from the Mac must be present in `/root/.ssh/authorized_keys` on the VPS.

The VPS deploy script performs:

1. `git fetch origin main`
2. `git reset --hard origin/main`
3. `git submodule sync --recursive`
4. `git submodule update --init --recursive`
5. `docker compose run --rm builder`
6. `docker compose up -d web`
7. `curl -fsSI http://127.0.0.1/`

Expected final line:

```text
Deploy finished: http://blog.trailblazeblog.dpdns.org
```

## Verification

Local verification:

```bash
npm run build
npm run deploy:vps
curl -I https://blog.trailblazeblog.dpdns.org
curl -I http://blog.trailblazeblog.dpdns.org
```

Expected HTTPS response includes:

```text
HTTP/2 200
server: cloudflare
```

Expected HTTP response redirects to HTTPS:

```text
HTTP/1.1 301 Moved Permanently
Location: https://blog.trailblazeblog.dpdns.org/
```

VPS verification:

```bash
cd /opt/tbblog
docker compose ps
docker compose logs --tail=80 web
curl -I http://127.0.0.1/
```

## Notes

- The root domain `trailblazeblog.dpdns.org` is used by Cloudflare R2 and should not be replaced with a VPS `A` record unless the image host is migrated first.
- The blog uses the `blog.trailblazeblog.dpdns.org` subdomain to avoid breaking existing image URLs.
- `themes/next` is a submodule pointing at `https://github.com/Mrle2021/hexo-theme-next.git`, branch `trailblaze-next`.
- `themes/next-backup` is a submodule pointing at the same repository, branch `master`.
- The current HTTPS design is Cloudflare Flexible HTTPS, not end-to-end origin HTTPS.
