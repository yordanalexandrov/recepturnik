# Договорите идват от family чрез git submodule, а UI-то е копие

`@family/shared` (Zod schema-ите и типовете на API-то) се ползва директно от изходния код: family е git submodule в `vendor/family`, а Vite, Vitest и tsconfig имат alias `@family/shared` → `vendor/family/packages/shared/src`. Submodule-ът е закован на commit и се вдига съзнателно, заедно с проверка на Рецептурника. Екраните за рецепти се копират еднократно от `apps/web` на family и се преправят за desktop и мобилен браузър. Копират се логиката и разметката, без CSS-а и дизайн token-ите на family: началният вид е семпъл и собствен. Не се внасят от submodule-а, защото зависят от режима на устройството, действащия потребител, офлайн кеша и навигацията на family.

## Considered Options

- pnpm git dependency към `packages/shared`: пакетът изнася `dist`, който се build-ва, а pnpm не build-ва поддиректория на git зависимост надеждно.
- Публикуван пакет в GitHub Packages: нужни са версии и публикуване при всяка промяна на договор, а потребителят е един.
- Общ UI пакет във family: голям рефакторинг на family преди MVP-то.
- Рецептурникът като `apps/recepturnik` в monorepo-то на family: потребителят иска отделно repo.

## Consequences

- Двете копия на UI-то за рецепти се разминават с времето. Промяна в поведението на рецептите се прави и на двете места, когато има смисъл.
