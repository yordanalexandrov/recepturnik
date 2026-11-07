# syntax=docker/dockerfile:1
# Образът на Рецептурника: Caddy със статиката (docker-compose.yml, infra/caddy/Caddyfile).
# @family/shared се build-ва от изходния код в submodule-а vendor/family (ADR-0002), затова build-ът иска
# checkout със submodules.

# Само зависимостите: `pnpm fetch` пълни store-а от lockfile-а, така че слоят остава в кеша,
# докато не се смени manifest или lockfile.
FROM node:24-alpine AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm fetch

FROM deps AS build
COPY . .
RUN test -f vendor/family/packages/shared/src/index.ts \
  || { echo 'vendor/family is empty: git submodule update --init' >&2; exit 1; }
RUN pnpm install --frozen-lockfile --offline
RUN pnpm build

FROM caddy:2-alpine AS web
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/dist /srv
