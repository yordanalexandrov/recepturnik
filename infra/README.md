# Инфраструктура

Рецептурникът на homesrv е един контейнер: Caddy със статиката ([Dockerfile](../Dockerfile),
[Caddyfile](caddy/Caddyfile)), compose проект `recepturnik` ([docker-compose.yml](../docker-compose.yml)). Няма база
и secrets: данните са в api-то на family (ADR-0001).

| Порт | Кой | Бележка |
|---|---|---|
| `127.0.0.1:18092` | `web` на `recepturnik` (host мрежа) | входът: cloudflared → `http://localhost:18092`; статика, `/api/*` и `/healthz` → api |
| `127.0.0.1:18091` | `api` на стека `family` | `API_PORT` в средата на compose мести upstream-а на Caddy |

Caddy: `/assets/*` (hashed bundle-ите на Vite) с `Cache-Control: public, max-age=31536000, immutable`, липсващ asset е
404; всеки друг път е файлът или `index.html` (SPA fallback), а `/` и `index.html` са с `Cache-Control: no-cache`.

## Deploy

[deploy.yml](../.github/workflows/deploy.yml) тръгва при push в `master` или ръчно (`workflow_dispatch`, само от
`master`) на self-hosted runner-а с label `recepturnik`: `docker compose -p recepturnik up -d --build`, после
[smoke.sh](smoke.sh) през `127.0.0.1:18092` (`/healthz` с `"db":"ok"` и `/` с `<div id="root">`, до 60 s).
Никой друг workflow не ползва self-hosted runner; [check-workflows.sh](../.github/scripts/check-workflows.sh) в
`ci.yml` го проверява.

## Проверка локално

```sh
git submodule update --init
sh infra/check-image.sh   # build на образа, стек `recepturnik-check` с фалшиво api на 127.0.0.1:18991
sh infra/smoke.sh         # срещу вече вдигнат стек на 127.0.0.1:18092
```

`check-image.sh` (пуска се и в `ci.yml`) иска свободни 18092 и 18991 и проверява проксито, SPA fallback-а,
кеширането, 404 за липсващ asset и че Caddy слуша само на `127.0.0.1:18092`.

Целият път локално, срещу истинското api на family (`AUTH_MODE=dev`, README.md → „api-то на family“):

```sh
docker compose -p recepturnik up -d --build
sh infra/smoke.sh
docker compose -p recepturnik down
```

## Ръчни стъпки (еднократно)

Агентите не ги правят: те са в GitHub, на homesrv и в Cloudflare.

### 1. GitHub

| Settings → | Какво |
|---|---|
| Actions → General | *Approval for running fork pull request workflows from contributors*: *Require approval for all external contributors*. PR от fork може да смени всеки workflow, вкл. `runs-on`; без одобрение би пуснал чужд код на homesrv с правата на групата `docker` (на практика root). |
| Environments → `production` | Създай го. *Deployment branches and tags*: само `master`. Secrets не трябват. |
| Rules → Rulesets | (по избор, както във family) за `master`: *Require a pull request*, *Require status checks* с check `ci`, *Block force pushes*. |

### 2. Runner на homesrv

Отделен runner за това repo (runner-ът на family е само за family). На homesrv, като потребителя на runner-а на family
(в група `docker`):

1. GitHub → recepturnik → Settings → Actions → Runners → *New self-hosted runner* → Linux x64; оттам са URL-ът за
   изтегляне и токенът за регистрация (важи 1 час).
2. ```sh
   mkdir ~/actions-runner-recepturnik && cd ~/actions-runner-recepturnik
   # curl … && tar xzf …   (командите от страницата в т. 1)
   ./config.sh --url https://github.com/yordanalexandrov/recepturnik --token <TOKEN> \
     --name homesrv-recepturnik --labels recepturnik,homesrv --unattended
   sudo ./svc.sh install && sudo ./svc.sh start
   ```
3. Провери в Settings → Actions → Runners: `homesrv-recepturnik` е *Idle*, с labels `self-hosted`, `Linux`, `X64`,
   `recepturnik`, `homesrv`. `deploy.yml` го иска с `runs-on: [self-hosted, linux, recepturnik]`.
4. Actions → deploy → *Run workflow* на `master`; стъпката *Smoke test* трябва да мине. На homesrv:
   `curl -s 127.0.0.1:18092/healthz` дава `{"status":"ok","db":"ok",…}`.

Workspace-ът е `~/actions-runner-recepturnik/_work/recepturnik/recepturnik`; оттам се пускат ръчни
`docker compose -p recepturnik …`.

### 3. Cloudflare Tunnel: recipe.yo-po.eu

Zero Trust → Networks → Tunnels → tunnel-ът на homesrv (същият, през който е family) → *Public hostnames* → *Add a
public hostname*:

- Subdomain `recipe`, Domain `yo-po.eu`, Path празно;
- Service: Type `HTTP`, URL `localhost:18092`.

Ако tunnel-ът е с локален `config.yml` вместо от таблото, добави в `ingress` преди последното правило
`- hostname: recipe.yo-po.eu` / `service: http://localhost:18092` и рестартирай cloudflared. DNS записът (CNAME към
tunnel-а) се създава сам от таблото.

### 4. Cloudflare Access: същото приложение като family

ADR-0001: api-то на family приема един AUD, затова recipe.yo-po.eu влиза в **същото** Access приложение, не в ново.

Zero Trust → Access → Applications → приложението на family → *Edit* → *Configure* (Basic information / Public
hostnames) → *Add public hostname*: Subdomain `recipe`, Domain `yo-po.eu` → *Save*. Политиката (имейл PIN, позволените
имейли) остава същата; AUD tag-ът не се сменя, затова secrets на family не се пипат.

Провери: в частен прозорец https://recipe.yo-po.eu иска имейл PIN; след вход се отваря регистърът рецепти, а
`https://recipe.yo-po.eu/healthz` дава `{"status":"ok","db":"ok",…}`.
