# Deploy — tracker-frontend

Built and pushed to `ghcr.io/<owner>/tracker-frontend` on every push to `main`,
then pulled on the server over SSH.

Service name on the server: **`frontend`** (used by `docker compose pull/up`).

The image contains the static Vite bundle served by `nginx:1.27-alpine` on
**port 80**. Caddy in front terminates TLS and reverse-proxies `/` to it.

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

    # Backend routes go to the Spring Boot container
    reverse_proxy /api/* backend:8080
    reverse_proxy /actuator/* backend:8080
    # Everything else goes to the nginx-served SPA
    reverse_proxy frontend:80
}
```

## API URL configuration

`src/api/client.ts:5` reads `BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'`.
Vite inlines `import.meta.env.*` **at build time**, so the API origin is baked into the
static bundle — it can't be changed at container runtime. The `VITE_API_BASE_URL` value is
passed as a Docker **`build-arg`** (the Dockerfile re-exports it as `ENV` before `npm run build`);
the workflow's `build-args:` sets it to `https://api.tracker.xasanboy.dev/api/v1`, and
`.env.production` mirrors it for local `npm run build`. When the var is **unset**, the SPA falls
back to the relative `/api/v1` and calls the same origin it's served from (Caddy then routes
`/api/*` to the backend container). To point a build at a different API origin, change the
`build-args:` value in the workflow (and `.env.production` if you build locally).

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
