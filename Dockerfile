# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20.18-alpine AS build
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
# Standard nginx — master starts as root to bind port 80, then forks workers
# that drop to the unprivileged "nginx" user. Inside a container this is the
# canonical secure setup; nothing in our conf.d/default.conf needs adjustment.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
