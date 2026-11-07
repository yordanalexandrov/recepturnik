import {
  type Recipe,
  type RecipeSummary,
  recipeSchema,
  recipeSummarySchema,
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
 * `GET /api/recipes` с тези рецепти. Търсенето `q` стеснява по заглавие (без значение от главни букви), както
 * api-то. Връща query низовете на заявките по ред, за проверка на параметрите.
 */
export function serveRecipes(recipes: Recipe[]): URLSearchParams[] {
  const searches: URLSearchParams[] = [];
  server.use(
    http.get('/api/recipes', ({ request }) => {
      const search = new URL(request.url).searchParams;
      searches.push(search);
      const q = search.get('q')?.toLocaleLowerCase('bg') ?? '';
      const found = recipes.filter((recipe) =>
        recipe.title.toLocaleLowerCase('bg').includes(q),
      );
      return HttpResponse.json({ recipes: found.map(toSummary) });
    }),
  );
  return searches;
}
