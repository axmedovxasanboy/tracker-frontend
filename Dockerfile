# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20.18-alpine AS build
WORKDIR /app

# Lockfile first → deps layer cached unless package*.json changes
COPY package.json package-lock.json ./
RUN npm ci

# Now the source
COPY . .

# Vite + tsc → static bundle in /app/dist.
# VITE_API_BASE_URL is baked into the bundle here (Vite inlines import.meta.env
# at build time). Passed in via build-args from CI; unset → src/api/client.ts
# falls back to the relative '/api/v1' (reverse-proxied at runtime).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────────
# Standard nginx — master starts as root to bind port 80, then forks workers
# that drop to the unprivileged "nginx" user. Inside a container this is the
# canonical secure setup; nothing in our conf.d/default.conf needs adjustment.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
