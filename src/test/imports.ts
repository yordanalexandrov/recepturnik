import {
  type ApproveSuggestionInput,
  type ImportedSuggestion,
  type Ingredient,
  importedSuggestionSchema,
  ingredientSchema,
  type RecipeImportDetail,
  type RecipeImportRequest,
  recipeImportDetailSchema,
  recipeImportRequestSchema,
  recipeImportsResponseSchema,
  recipeResponseSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { RECEPTURKO_ID } from '../api/client';
import { server } from './msw';
import { chicken, salt } from './recipe-detail';
import { serveAppliances } from './recipe-form';
import { omelette } from './recipes';

// Фикстури за внасянето: поставен текст на рецепта, заявката и предложението от нея. Минават през schema-ите от
// @family/shared, за да не се разминават с договора.

export const importId = 'eeeeeeee-0000-4000-8000-000000000001';

export const importText = `Пилешки гърди със сумак

Продукти:
- 600 г пилешки гърди
- 1 ч.л. смлян сумак
- сол на вкус

Начин на приготвяне:
Овкусете пилето. Изпечете го 30 минути.`;

export const importUrl = 'https://blog.example/pile-sumak';

export const pendingImport: RecipeImportRequest =
  recipeImportRequestSchema.parse({
    id: importId,
    status: 'pending',
    source: 'text',
    url: importUrl,
    requestedBy: RECEPTURKO_ID,
    createdAt: '2026-10-27T18:00:00.000Z',
  });

/** Продукт, който го няма в регистъра: внасянето го предлага като нов. */
export const sumac: Ingredient = ingredientSchema.parse({
  id: 'aaaaaaaa-0000-4000-8000-000000000010',
  name: 'сумак',
  unit: 'g',
  aisle: 'spices',
});

export const importedSuggestion: ImportedSuggestion =
  importedSuggestionSchema.parse({
    id: 'dddddddd-0000-4000-8000-000000000020',
    origin: 'import',
    importRequestId: importId,
    status: 'proposed',
    payload: {
      title: 'Пилешко филе със сумак',
      servings: 4,
      prepMinutes: 40,
      tags: ['dinner'],
      assumptions: 'Порциите не са дадени: по количествата са 4.',
      ingredients: [
        {
          ingredientId: chicken.id,
          newProduct: null,
          quantity: 600,
          unit: 'g',
          note: 'пилешки гърди',
          component: null,
        },
        {
          ingredientId: null,
          newProduct: { name: 'сумак', unit: 'g', aisle: 'spices' },
          quantity: 1,
          unit: 'tsp',
          note: 'смлян',
          component: null,
        },
        {
          ingredientId: salt.id,
          newProduct: null,
          quantity: null,
          unit: 'pinch',
          note: null,
          component: null,
        },
      ],
      steps: [{ text: 'Овкусете пилето.' }, { text: 'Изпечете го 30 минути.' }],
      preparation: [],
      components: [],
    },
  });

export const doneImport: RecipeImportRequest = recipeImportRequestSchema.parse({
  ...pendingImport,
  status: 'done',
  finishedAt: '2026-10-27T18:01:00.000Z',
  suggestionId: importedSuggestion.id,
  title: importedSuggestion.payload.title,
});

/** Готовото внасяне: текстът, предложението и продуктите от регистъра, с които редовете му са свързани. */
export const doneDetail: RecipeImportDetail = recipeImportDetailSchema.parse({
  request: doneImport,
  text: importText,
  suggestion: importedSuggestion,
  ingredients: [chicken, salt],
});

export const pendingDetail: RecipeImportDetail = recipeImportDetailSchema.parse(
  { request: pendingImport, text: importText, ingredients: [] },
);

/** Id-то на рецептата, която одобрението създава. */
export const approvedRecipeId = 'bbbbbbbb-0000-4000-8000-000000000020';

/** `GET /api/recipe-imports?limit=`: последните внасяния. */
export function serveRecentImports(requests: RecipeImportRequest[] = []) {
  const body = recipeImportsResponseSchema.parse({ requests });
  server.use(http.get('/api/recipe-imports', () => HttpResponse.json(body)));
}

/**
 * API-то на едно внасяне: списъкът, `POST` (връща чакащото внасяне), `GET /:id` в дадените състояния (последното се
 * повтаря), уредите, търсенето на продукти (сумак го няма), създаване на продукт, одобрение и отхвърляне. Връща какво
 * е стигнало до api-то.
 */
export function serveImport(...states: RecipeImportDetail[]) {
  const posted: unknown[] = [];
  const created: unknown[] = [];
  const approved: ApproveSuggestionInput[] = [];
  const rejected: string[] = [];
  let detailCalls = 0;
  const recipe = (title: string) =>
    recipeResponseSchema.parse({
      recipe: { ...omelette, id: approvedRecipeId, title, ingredients: [] },
    }).recipe;
  serveRecentImports();
  serveAppliances();
  server.use(
    // Снимките (multipart) не стигат до msw с тялото си: виж `recordForms` в `./form-data`.
    http.post('/api/recipe-imports', async ({ request }) => {
      posted.push(await request.json().catch(() => undefined));
      return HttpResponse.json({ request: pendingImport }, { status: 202 });
    }),
    http.get(`/api/recipe-imports/${importId}`, () => {
      const state = states[Math.min(detailCalls, states.length - 1)];
      detailCalls += 1;
      return HttpResponse.json(recipeImportDetailSchema.parse(state));
    }),
    http.get('/api/ingredients', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? '';
      return HttpResponse.json({
        ingredients: [chicken, salt].filter((i) => i.name.includes(q)),
      });
    }),
    http.post('/api/ingredients', async ({ request }) => {
      created.push(await request.json());
      return HttpResponse.json({ ingredient: sumac }, { status: 201 });
    }),
    http.post(
      `/api/recipe-suggestions/${importedSuggestion.id}/approve`,
      async ({ request }) => {
        const input = (await request.json()) as ApproveSuggestionInput;
        approved.push(input);
        return HttpResponse.json(
          {
            recipe: recipe(input.title),
            suggestion: {
              ...importedSuggestion,
              status: 'approved',
              recipeId: approvedRecipeId,
            },
          },
          { status: 201 },
        );
      },
    ),
    http.post(`/api/recipe-suggestions/${importedSuggestion.id}/reject`, () => {
      rejected.push(importedSuggestion.id);
      return HttpResponse.json({
        suggestion: { ...importedSuggestion, status: 'rejected' },
      });
    }),
    http.get(`/api/recipes/${approvedRecipeId}`, () =>
      HttpResponse.json({
        recipe: recipe(importedSuggestion.payload.title),
      }),
    ),
  );
  return { posted, created, approved, rejected };
}
