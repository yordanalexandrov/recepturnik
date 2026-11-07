#!/bin/sh
# Проверка на образа и на docker-compose.yml без homesrv: вдига стека под друг compose проект с фалшиво api
# (caddy respond на 127.0.0.1:$API_PORT) и проверява през 127.0.0.1:18092 това, което иска Caddyfile-ът:
# прокси на /healthz и /api/*, SPA fallback, кеширане, 404 за липсващ asset и слушане само на loopback.
# Накрая пуска smoke.sh, който deploy.yml ползва след deploy.
# Нужни са docker (с compose) и curl; портовете 18092 и $API_PORT (по подразбиране 18991) трябва да са свободни.
# Usage: sh infra/check-image.sh  (с инициализиран submodule)
set -eu

cd "$(dirname "$0")/.."
project=recepturnik-check
export API_PORT="${API_PORT:-18991}"
base=http://127.0.0.1:18092
stub=$project-api
tmp=$(mktemp -d)
status=0

cleanup() {
  docker compose -p "$project" down --rmi local >/dev/null 2>&1 || true
  docker rm -f "$stub" >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*"
  status=1
}

# get <path>: тялото в $tmp/body, headers в $tmp/headers, HTTP кодът на stdout.
get() {
  curl -sS --max-time 5 -o "$tmp/body" -D "$tmp/headers" -w '%{http_code}' "$base$1" || true
}

header() {
  grep -i "^$1:" "$tmp/headers" | tr -d '\r' | cut -d' ' -f2-
}

docker run -d --rm --name "$stub" --network host caddy:2-alpine \
  caddy respond --listen "127.0.0.1:$API_PORT" --header 'Content-Type: application/json' \
  '{"status":"ok","db":"ok","stub":true}' >/dev/null
docker compose -p "$project" up -d --build --wait

# /healthz и /api/* отиват към api-то.
{ [ "$(get /healthz)" = 200 ] && grep -q '"stub":true' "$tmp/body"; } || fail '/healthz is not proxied to the api'
{ [ "$(get /api/recipes)" = 200 ] && grep -q '"stub":true' "$tmp/body"; } || fail '/api/* is not proxied to the api'

# / и пътищата на приложението са index.html, който винаги се проверява.
for path in / /index.html /recipes /recipes/abc/edit; do
  { [ "$(get "$path")" = 200 ] && grep -q '<div id="root">' "$tmp/body"; } || fail "$path is not index.html"
  [ "$(header cache-control)" = no-cache ] || fail "$path: Cache-Control is '$(header cache-control)', want no-cache"
done

# Hashed assets се кешират дълго; липсващ asset е 404, не index.html.
get / >/dev/null
asset=$(grep -oE '/assets/[^"]+\.js' "$tmp/body" | head -n 1 || true)
if [ -z "$asset" ]; then
  fail 'index.html references no /assets/*.js'
else
  [ "$(get "$asset")" = 200 ] || fail "$asset is not served"
  case "$(header cache-control)" in
    *max-age=31536000*immutable*) ;;
    *) fail "$asset: Cache-Control is '$(header cache-control)', want a year and immutable" ;;
  esac
fi
[ "$(get /assets/missing-0000.js)" = 404 ] || fail '/assets/missing-0000.js is not a 404'

# Само 127.0.0.1:18092, никой друг адрес.
listeners=$(docker compose -p "$project" exec -T web netstat -ltn | awk '$4 ~ /:18092$/ {print $4}')
[ "$listeners" = 127.0.0.1:18092 ] || fail "listens on '$listeners', want only 127.0.0.1:18092"

SMOKE_ATTEMPTS=3 sh infra/smoke.sh || fail 'smoke.sh failed'

[ "$status" != 0 ] || echo 'check-image: ok'
exit "$status"
