import {
  inPrepTimeRanges,
  type Recipe,
  type RecipeSummary,
  type RecipesQuery,
  recipeSchema,
  recipeSummarySchema,
  recipesQuerySchema,
  slotSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { server } from './msw';

// Фикстури за регистъра рецепти. Минават през schema-ите от @family/shared, за да не се разминават с договора.

export const chickenWithRice: Recipe = recipeSchema.parse({
  id: 'bbbbbbbb-0000-4000-8000-000000000001',
  title: 'Пиле с ориз',
  servings: 4,
  prepMinutes: 45,
  tags: ['lunch', 'kid_friendly'],
  steps: [{ text: 'Нарежи пилето.' }, { text: 'Задуши с лука.' }],
  sourceUrl: 'https://recepti.example/pile-s-oriz',
  preparation: [],
  components: [],
  ingredients: [],
  archivedAt: null,
  rating: 4,
  createdAt: '2026-10-20T10:00:00.000Z',
  updatedAt: '2026-10-20T10:00:00.000Z',
  openRevision: null,
});

export const omelette: Recipe = recipeSchema.parse({
  id: 'bbbbbbbb-0000-4000-8000-000000000002',
  title: 'Омлет',
  servings: 2,
  prepMinutes: 10,
  tags: ['breakfast', 'quick'],
  steps: [{ text: 'Разбий яйцата.' }, { text: 'Изпържи.' }],
  preparation: [],
  components: [],
  ingredients: [],
  archivedAt: null,
  rating: null,
  createdAt: '2026-10-21T10:00:00.000Z',
  updatedAt: '2026-10-21T10:00:00.000Z',
  openRevision: null,
});

/** Картата в регистъра: каквото връща `GET /api/recipes` за рецептата. */
export function toSummary(recipe: Recipe): RecipeSummary {
  return recipeSummarySchema.parse(recipe);
}

/**
 * `GET /api/recipes` с тези рецепти, филтрирани като в api-то на family: `q` по заглавие (без значение от главни
 * букви), `tag` (от слотовете — който и да е, от другите — всички), `time` (интервал; рецепта без време не влиза),
 * архивираните само с `includeArchived=true`, `sort=rating` (по оценка, неоценените накрая) или по заглавие.
 * Връща query низовете на заявките по ред, за проверка на параметрите.
 */
export function serveRecipes(recipes: Recipe[]): URLSearchParams[] {
  const searches: URLSearchParams[] = [];
  server.use(
    http.get('/api/recipes', ({ request }) => {
      const search = new URL(request.url).searchParams;
      searches.push(search);
      const query = recipesQuerySchema.parse({
        ...Object.fromEntries(search),
        tag: search.getAll('tag'),
        time: search.getAll('time'),
      });
      const found = recipes.filter((recipe) => matches(recipe, query));
      found.sort(
        (a, b) =>
          (query.sort === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) : 0) ||
          a.title.localeCompare(b.title, 'bg'),
      );
      return HttpResponse.json({ recipes: found.map(toSummary) });
    }),
  );
  return searches;
}

function matches(recipe: Recipe, query: RecipesQuery): boolean {
  const q = query.q?.toLocaleLowerCase('bg') ?? '';
  const slots = query.tag.filter((tag) => slotSchema.safeParse(tag).success);
  const others = query.tag.filter((tag) => !slots.includes(tag));
  return (
    recipe.title.toLocaleLowerCase('bg').includes(q) &&
    (query.includeArchived || recipe.archivedAt === null) &&
    (slots.length === 0 || slots.some((tag) => recipe.tags.includes(tag))) &&
    others.every((tag) => recipe.tags.includes(tag)) &&
    (query.time.length === 0 ||
      (recipe.prepMinutes !== undefined &&
        inPrepTimeRanges(recipe.prepMinutes, query.time)))
  );
}
