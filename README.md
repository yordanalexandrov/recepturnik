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
- `src/components/ErrorBox.tsx` — грешка на екрана с действие според вида („Опитай пак“, „Влез отново“).
- `src/app/` — `router.tsx` (code-based routes, същите пътища като във family; нов екран = `createRoute` +
  `addChildren`), `Layout.tsx` (горната навигация), `query-client.ts` (повтаря само мрежа и 5xx).
- `src/features/ai/ai-requests.ts` — общото на AI заявките (предложения, внасяне, подобряване, поправка):
  `pollWhilePending` (`refetchInterval`: всяка заявка се пита отново на `POLL_INTERVAL_MS`, докато е `pending`),
  `REQUEST_STATUS_LABELS`, `failureMessage(kind, request)` (без кодове), `formatRequestTime`; `RecentAiRequests.tsx`
  — регионът с последните внасяния или заявки за предложения.
- `src/components/Sheet.tsx` — лист („Готово“, Escape, фон; `focusField` — фокус на първото поле);
  `ChoiceChips.tsx` (чипове за мулти избор), `Field.tsx` (етикет, поле, грешка), `ActionBar.tsx` (лентата със
  „Запази“/„Откажи“); `src/lib/use-media-query.ts:useWideScreen()` —
  широк екран (48rem) в JS, когато екранът се различава не само по CSS.
- `src/features/<feature>/` — екраните и заявките им (`queries.ts` с ключовете на TanStack Query). Филтрите на
  регистъра (`features/recipes/filters.ts`) се пазят в sessionStorage под `recepturnik.recipeFilters` и минават през
  `recipeFiltersSchema` при четене.
- Формата на рецепта: `features/recipes/RecipeForm.tsx` (`initialValues` — празна, `recipeToFormValues(recipe)` или
  чернова) с листовете `IngredientLineSheet` (`IngredientPicker`, `NewIngredientForm`), `ComponentSheet`,
  `StepSheet` (със `step-photos/StepPhotoField`) и `preparation/PreparationField` (`PreparationSheet`);
  `recipe-form-values.ts` е преобразуването форма ↔ `RecipeInput` от family (с проверката по `recipeInputSchema`).
  `RecipeEditor.tsx`: `NewRecipeScreen`, `EditRecipeScreen` (`/recipes/$id/edit`, `PUT`; `seed` дава началните
  стойности от рецептата, `parseEditRecipeSearch` чете `?revise`), `useSaveAndView(id?)` (запис и към прегледа).
- Снимка на стъпка: `step-photos/queries.ts:useUploadStepPhoto` смалява в браузъра (`lib/resize-photo.ts`, до
  2000 px, JPEG, както във family) и качва веднага; стъпката сочи към нея от „Запази“ нататък.
- AI предложения: `features/suggestions/` — `SuggestScreen` (`/recipes/suggest`: хранене, време, тагове,
  подсказка; уредите само за четене; последните заявки), `SuggestionRequestView` (`/recipes/suggest/$requestId`:
  докато е `pending`; картите или защо е неуспешна и „Опитай пак“), `SuggestionCard`
  (действията по статуса в `SuggestionActions`: „Приеми“, „Отхвърли“, „Върни“ — там влизат и следващите действия
  върху предложение) и `SuggestionReview` (`/recipes/suggest/$requestId/$suggestionId`: предложението в
  `RecipeForm`, „Запази“ = `approve`). Нищо не се записва в менюто на family.
- Внасяне: `features/recipe-import/` — `ImportScreen` (`/recipes/import`, табове „Текст“/„Линк“/„Снимка“,
  `?tab=&url=&text=`, „Последни внасяния“) и `ImportRequestView` (`/recipes/import/$requestId`: докато е `pending`
  — изчакване; черновата е във формата за нова рецепта, а „Запази“ одобрява предложението през
  `/api/recipe-suggestions/:id/approve` — `useApproveSuggestion` от `suggestions/queries.ts`). Без share target на family. Създаден „Нов продукт“ свързва и другите редове
  със същия предложен нов продукт.
- „Подобри рецептата“: бутонът на прегледа отваря `features/recipes/RefineSheet.tsx`, който пуска заявката
  (`refinements.ts`: `useRequestRefinement`, `useRefinement`) и показва сравнението.
  „Приеми“ води към `/recipes/$id/edit?refine=<id на заявката>`; формата започва с `refinedFormValues(recipe,
  refinement)` (стъпки, подготовка, време) и записът е обикновен `PUT`; подобрение, което не е готово, не влиза
  във формата, а бележка казва, че не е налично. Сравнението е `RecipeComparison` +
  `ComparisonColumn` (колони една под друга на телефон, една до друга от 48rem; ползва го и „Поправи с AI“), а
  съобщенията за неуспешна AI заявка — `features/ai/ai-requests.ts:failureMessage(kind, request)`.
- „Поправи с AI“: бутонът на прегледа и значката „Поправка чака преглед“ водят към `/recipes/$id/edit?revise`, където
  `features/recipes/ReviseSheet.tsx` (отваря се и с бутона над стъпките) иска указание, пуска поправката
  (`revisions.ts`: `useRequestRevision` праща `applied: []` и при `404 no_applied_change` пита пак без непознатите id;
  `useRevision`) и я сравнява със сегашната рецепта. Листът продължава `recipe.openRevision`, а `409
  revision_open` води към чакащата. „Приеми“ слага `revisedFormValues` в полетата на формата, както са сега
  (`aiReplacement` на `RecipeForm`), и записът е `PUT` с `revisionId` (`useSaveAndView`); `409 revision_stale` не
  записва и отваря листа с опреснената поправка, която няма „Приеми“, а „Пусни пак“; следващата приета поправка взима
  и полетата на по-новата рецепта, които формата не е променила (`rebaseKeptFields`). На предложение и чернова от внасяне поправката е върху незаписаната форма
  (`suggestions/RevisableSuggestionForm.tsx`, `POST /api/recipe-suggestions/:id/revisions`), а одобрението праща
  `revisionId`; „Поправи с AI“ на картата отваря прегледа с `?revise`.
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
- `src/test/recipe-form.ts` — `serveForm()` (уреди, търсене на продукти, `POST /api/recipes`; връща телата),
  `serveAppliances`, `serveIngredientSearch`, `mint` (продукт за „Нов продукт“).
- `src/test/suggestions.ts` — заявки и предложения; `serveRequestSuggestions` (POST, връща телата),
  `serveRecentRequests`, `serveDetail(...states)` (поредни състояния за проверката на `pending`) и
  `serveDecisions(detail)` (заявката с `approve`/`reject`/`restore`, които сменят статуса).
- `src/test/imports.ts` — внасяне, чернова и `serveImport(...states)` (`GET` на внасянето минава през състоянията);
  `src/test/form-data.ts:recordForms()` — снимките (multipart) не стигат до msw, затова формите се записват от fetch.
- `src/test/refinements.ts` — подобрение на „Пиле с песто“ и `serveRefinement(finished, pendingPolls)` (`POST` и
  четенето на заявката; брои пусканията).
- `src/test/revisions.ts` — поправка на „Пиле с песто“, `serveRevision(finished, pendingPolls)` (`POST`, четене и
  „Отхвърли“; връща телата и отхвърлените) и `refuseStaleSave()` (следващият `PUT` е `409 revision_stale`).
- Търси по роля и достъпно име; сменяй отговорите със `server.use(...)` в самия тест.
