# Рецептурник

Уеб клиент за регистъра рецепти на family, за desktop и мобилен браузър (recipe.yo-po.eu). Няма собствен backend:
чете и пише през API-то на family (ADR-0001). Термините са в `GLOSSARY.md`, решенията в `docs/adr/`.

## Локална разработка

Нужни са Node 24 (`.nvmrc`) и pnpm 10 (`corepack enable`).

```sh
git clone --recurse-submodules git@github.com:yordanalexandrov/recepturnik.git
# или в съществуващ checkout:
git submodule update --init
pnpm install
```

### api-то на family

Рецептурникът говори с локалното api на family в `AUTH_MODE=dev` (без Cloudflare). В checkout на family:

```sh
cp .env.example .env            # AUTH_MODE=dev, DEV_USER_EMAIL
docker compose up -d postgres
pnpm --filter api dev           # http://127.0.0.1:18091, миграциите (и Рецептурко) се пускат при старт
curl 127.0.0.1:18091/healthz
```

Без Рецептурко (миграция `0040_seed_app_user.sql`) всяка заявка, която иска действащ потребител, връща 400
`unknown_acting_user`. С празен `OPENCLAW_GATEWAY_PASSWORD` AI заявките връщат 503 „AI не е на разположение“.

### Рецептурникът

```sh
pnpm dev        # http://localhost:5174; /api и /healthz отиват към 127.0.0.1:${API_PORT:-18091}
pnpm lint       # Biome (lint:fix поправя)
pnpm typecheck  # tsc -b
pnpm test       # Vitest + jsdom + Testing Library + msw
pnpm build
```

CI (`.github/workflows/ci.yml`) пуска същите четири проверки на всеки PR и push в `master`, плюс проверката на
workflow-ите (actionlint, `.github/scripts/check-workflows.sh`) и на образа (`infra/check-image.sh`).

## Deploy

Всеки push в `master` се deploy-ва сам на homesrv (`.github/workflows/deploy.yml`, self-hosted runner с label
`recepturnik`): Caddy със статиката на `127.0.0.1:18092`, `/api/*` и `/healthz` към api-то на family. Подробности,
локална проверка и ръчните стъпки (runner, Cloudflare tunnel, Access) са в [infra/README.md](infra/README.md).

## Устройство

- `vendor/family` — family като git submodule на закован commit. `@family/shared` (Zod schema-ите и типовете на
  API-то) се внася с alias направо от `vendor/family/packages/shared/src` във `vite.config.ts` (и за Vitest) и в
  `tsconfig.app.json`. Вдигане: `git -C vendor/family fetch && git -C vendor/family checkout <sha>`, после всички
  проверки и commit на новия pointer.
- `src/api/client.ts` — единственият път до api-то (Biome забранява `fetch` другаде). `apiFetch(path, schema, init)`
  добавя `X-Acting-User` с `RECEPTURKO_ID` (ADR-0003), проверява отговора със schema от `@family/shared` и хвърля
  `NetworkError` или `ApiError`. `failureKind(error)` дава вида: `network`, `session_expired`, `ai_unavailable`,
  `server`, `client`; `refusalOf(error, code)` чете отказ с под-код.
- `src/components/ErrorBox.tsx` — грешка на екрана с действие според вида („Опитай пак“, „Влез отново“);
  `errorText(error)` е същият текст за toast.
- `src/app/` — `router.tsx` (code-based routes, същите пътища като във family; нов екран = `createRoute` +
  `addChildren`), `Layout.tsx` (горната навигация), `query-client.ts` (повтаря само мрежа и 5xx).
  `Placeholder.tsx` пази местата на екраните от следващите задачи.
- `src/components/Sheet.tsx` — лист („Готово“, Escape, фон); `src/lib/use-media-query.ts:useWideScreen()` —
  широк екран (48rem) в JS, когато екранът се различава не само по CSS.
- `src/features/<feature>/` — екраните и заявките им (`queries.ts` с ключовете на TanStack Query). Филтрите на
  регистъра (`features/recipes/filters.ts`) се пазят в sessionStorage под `recepturnik.recipeFilters` и минават през
  `recipeFiltersSchema` при четене.
- `src/styles/global.css` — целият CSS: системен шрифт, CSS променливите на `:root`, тъмна тема по
  `prefers-color-scheme`, една граница за широк екран (48rem). Без стиловете на family.

## Тестове

Тестваме видимо поведение през шева „екран + msw“ (спец #1, Testing Decisions):

- `renderApp(path)` от `src/test/render.tsx` рендерира цялото приложение с истинския router (history в паметта) и
  query client без повторни опити.
- `src/test/msw.ts` — `server` с handler-ите по подразбиране (празен регистър), `apiError(...)`,
  `accessRedirect()` (изтекла сесия), `networkFailure()`, `recordRequests()` (headers на всяка заявка).
  Заявка без handler проваля теста.
- `src/test/recipes.ts` — фикстури, минали през schema-ите от `@family/shared`, и `serveRecipes(recipes)`, който
  филтрира и подрежда като api-то (`q`, `tag`, `time`, `includeArchived`, `sort`).
- `src/test/viewport.ts` — `setViewport('wide' | 'narrow')` имитира `matchMedia` (jsdom я няма); без него екранът
  е тесен. Нужно е за екрани, които се различават по ширина (напр. филтрите: панел или лист).
- `src/test/recipe-detail.ts` — продукти, рецепта с редове и `serveRecipe(recipe)` (`GET /api/recipes/:id`).
- Търси по роля и достъпно име; сменяй отговорите със `server.use(...)` в самия тест.
