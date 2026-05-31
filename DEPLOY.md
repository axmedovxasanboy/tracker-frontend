# Deploy — tracker-frontend

Built and pushed to `ghcr.io/<owner>/tracker-frontend` on every push to `main`,
then pulled on the server over SSH.

Service name on the server: **`frontend`** (used by `docker compose pull/up`).

The image contains the static Vite bundle served by nginx-unprivileged on
**port 8080**. Caddy in front terminates TLS and reverse-proxies `/` to it.

---

## GitHub Actions secrets

| Secret           | Purpose                                                |
| ---------------- | ------------------------------------------------------ |
| `SERVER_HOST`    | Hetzner VPS hostname or IP                             |
| `SERVER_USER`    | SSH user — `deploy`                                    |
| `SERVER_SSH_KEY` | Private SSH key (full PEM including header/footer)     |

`GITHUB_TOKEN` is provided automatically and is used to push to ghcr.io.

## Server prerequisites

- Docker + Compose v2 installed.
- `~/app/docker-compose.yml` has a `frontend` service (see below).
- The server is logged in to ghcr.io if the package is **private**:
  ```bash
  echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin
  ```

## Compose entry (server-side, in `~/app/docker-compose.yml`)

```yaml
services:
  frontend:
    image: ghcr.io/<owner>/tracker-frontend:latest
    container_name: frontend
    restart: unless-stopped
    networks: [app-network]
    # No env vars at runtime — the SPA is a static bundle. The Caddy reverse
    # proxy reaches it at http://frontend:8080.

networks:
  app-network:
    external: true
```

Caddy reverse-proxy snippet (already in your Caddyfile, just adjust the upstream port):

```caddyfile
your.public.domain {
    encode zstd gzip

    # SPA — proxied to the unprivileged nginx in the frontend container
    reverse_proxy /api/* backend:8080
    reverse_proxy /actuator/* backend:8080
    reverse_proxy frontend:8080
}
```

> **Port note.** The container listens on 8080, not 80 — `nginxinc/nginx-unprivileged`
> runs as a non-root user and can't bind privileged ports. Caddy proxies to
> `frontend:8080` accordingly.

## API URL configuration

`src/api/client.ts:5` hard-codes `BASE_URL = '/api/v1'`. The browser sends API
calls to the same origin it's served from; Caddy routes `/api/*` to the backend
container. There is **no `VITE_API_URL` env var** — if you ever need one, add
it to source first, then expose it as a `build-args:` entry in the workflow.

## Manual trigger

```bash
gh workflow run build-and-deploy.yml --ref main
```

## Roll back

Every build pushes both `:latest` and `:<short-sha>`. To roll back, pin the
image in `~/app/docker-compose.yml` on the server:

```yaml
    image: ghcr.io/<owner>/tracker-frontend:a1b2c3d   # ← previous short SHA
```

then:

```bash
cd ~/app
docker compose pull frontend
docker compose up -d frontend
```

List recent tags:

```bash
gh api /users/<owner>/packages/container/tracker-frontend/versions \
  --jq '.[] | {tags: .metadata.container.tags, created: .created_at}'
```
