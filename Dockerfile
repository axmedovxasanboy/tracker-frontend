# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Lockfile first → deps layer cached unless package*.json changes
COPY package.json package-lock.json ./
RUN npm ci

# Now the source
COPY . .

# Vite + tsc → static bundle in /app/dist
# (No VITE_* env vars are read in src/. The app calls the API at /api/v1,
#  which Caddy reverse-proxies to the backend container at runtime.)
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────────
# Official non-root nginx variant — same nginx 1.27 line, runs as uid 101,
# listens on 8080 by default (rootless can't bind <1024).
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
