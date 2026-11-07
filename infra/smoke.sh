#!/bin/sh
# Smoke тест след deploy (deploy.yml) през Caddy, по пътя на cloudflared: /healthz стига api-то на family и базата му,
# / е index.html на Рецептурника. Опитва SMOKE_ATTEMPTS пъти (по подразбиране 30) през 2 s.
# Usage: sh infra/smoke.sh [base url, default http://127.0.0.1:18092]
set -eu

base=${1:-http://127.0.0.1:18092}
attempts=${SMOKE_ATTEMPTS:-30}

i=0
while [ "$i" -lt "$attempts" ]; do
  if curl -fsS --max-time 5 "$base/healthz" | grep -q '"db":"ok"' &&
    curl -fsS --max-time 5 "$base/" | grep -q '<div id="root">'; then
    echo "smoke: $base ok"
    exit 0
  fi
  i=$((i + 1))
  [ "$i" -ge "$attempts" ] || sleep 2
done

echo "::error::$base did not answer /healthz with db ok and / with index.html after $attempts attempts"
exit 1
