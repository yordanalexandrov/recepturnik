import {
  approvedSuggestionResponseSchema,
  type ContractFailure,
  type Recipe,
  type RecipeSuggestion,
  type RecipeSuggestParams,
  recipeSchema,
  recipeSuggestionResponseSchema,
  recipeSuggestionSchema,
  type SuggestionRequest,
  type SuggestionRequestDetail,
  suggestionRequestDetailSchema,
  suggestionRequestResponseSchema,
  suggestionRequestSchema,
  suggestionRequestsResponseSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { RECEPTURKO_ID } from '../api/client';
import { server } from './msw';
import { chickenWithRice } from './recipes';

// Фикстури за AI предложенията: заявка (`recipe.suggest`) и предложенията ѝ. Минават през schema-ите от
// @family/shared, за да не се разминават с договора.

export const requestId = 'cccccccc-0000-4000-8000-000000000001';

export const pendingRequest: SuggestionRequest = suggestionRequestSchema.parse({
  id: requestId,
  slots: ['dinner'],
  times: ['15-30'],
  tags: ['quick'],
  hint: 'нещо с пиле',
  status: 'pending',
  requestedBy: RECEPTURKO_ID,
  createdAt: '2026-10-25T18:00:00.000Z',
});

export const doneRequest: SuggestionRequest = suggestionRequestSchema.parse({
  ...pendingRequest,
  status: 'done',
  finishedAt: '2026-10-25T18:01:00.000Z',
});

export function failedRequest(error: ContractFailure): SuggestionRequest {
  return suggestionRequestSchema.parse({
    ...pendingRequest,
    status: 'failed',
    error,
    finishedAt: '2026-10-25T18:03:00.000Z',
  });
}

/** Предложение, което чака решение: „пилешко филе“ и „сол“ са в регистъра, „сумак“ е нов продукт. */
export const skewersSuggestion: RecipeSuggestion = recipeSuggestionSchema.parse(
  {
    id: 'dddddddd-0000-4000-8000-000000000001',
    origin: 'suggest',
    requestId,
    status: 'proposed',
    payload: {
      title: 'Пилешки шишчета',
      sourceUrl: 'https://recepti.example/pileshki-shishcheta',
      why: 'Бързо е и децата го обичат.',
      prepMinutes: 25,
      servings: 4,
      tags: ['dinner', 'quick'],
      ingredients: [
        {
          name: 'пилешко филе',
          isNew: false,
          quantity: 0.6,
          unit: 'kg',
          component: null,
        },
        {
          name: 'сумак',
          isNew: true,
          quantity: 1,
          unit: 'tsp',
          component: null,
        },
        {
          name: 'сол',
          isNew: false,
          quantity: null,
          unit: 'pinch',
          component: null,
        },
      ],
      steps: [{ text: 'Нарежи пилето.' }, { text: 'Нанижи и изпечи.' }],
      preparation: [],
      components: [],
    },
  },
);

export const soupSuggestion: RecipeSuggestion = recipeSuggestionSchema.parse({
  id: 'dddddddd-0000-4000-8000-000000000002',
  origin: 'suggest',
  requestId,
  status: 'rejected',
  decidedBy: RECEPTURKO_ID,
  decidedAt: '2026-10-25T18:05:00.000Z',
  payload: {
    title: 'Леща чорба',
    sourceUrl: 'https://supichki.example/leshta',
    why: 'Топло и сито за вечер.',
    prepMinutes: 30,
    servings: 6,
    tags: ['dinner'],
    ingredients: [
      { name: 'леща', isNew: false, quantity: 300, unit: 'g', component: null },
      { name: 'лук', isNew: false, quantity: 1, unit: 'pcs', component: null },
    ],
    steps: [{ text: 'Запържи лука.' }, { text: 'Свари лещата с лука.' }],
    preparation: [],
    components: [],
  },
});

export const approvedRecipeId = 'bbbbbbbb-0000-4000-8000-000000000009';

const omeletteSuggestionApproved: RecipeSuggestion =
  recipeSuggestionSchema.parse({
    id: 'dddddddd-0000-4000-8000-000000000003',
    origin: 'suggest',
    requestId,
    status: 'approved',
    recipeId: approvedRecipeId,
    decidedBy: RECEPTURKO_ID,
    decidedAt: '2026-10-25T18:06:00.000Z',
    payload: {
      title: 'Омлет с билки',
      sourceUrl: 'https://www.zakuski.example/omlet',
      why: 'Става за десет минути.',
      prepMinutes: 10,
      servings: 2,
      tags: ['dinner', 'quick'],
      ingredients: [
        {
          name: 'яйце',
          isNew: false,
          quantity: 4,
          unit: 'pcs',
          component: null,
        },
        {
          name: 'сол',
          isNew: false,
          quantity: null,
          unit: 'pinch',
          component: null,
        },
      ],
      steps: [{ text: 'Разбий яйцата.' }, { text: 'Изпечи ги в тиган.' }],
      preparation: [],
      components: [],
    },
  });

export const suggestions = [
  skewersSuggestion,
  soupSuggestion,
  omeletteSuggestionApproved,
];

/** `GET /api/recipe-suggestions/requests?limit=`: тези заявки, най-новите първи. */
export function serveRecentRequests(requests: SuggestionRequest[] = []) {
  const body = suggestionRequestsResponseSchema.parse({ requests });
  server.use(
    http.get('/api/recipe-suggestions/requests', () => HttpResponse.json(body)),
  );
}

/**
 * `POST /api/recipe-suggestions/requests` → 202 с `pending` заявка (с id `id`) по входа. Връща телата на заявките.
 */
export function serveRequestSuggestions(id = requestId) {
  const bodies: RecipeSuggestParams[] = [];
  server.use(
    http.post('/api/recipe-suggestions/requests', async ({ request }) => {
      const params = (await request.json()) as RecipeSuggestParams;
      bodies.push(params);
      return HttpResponse.json(
        suggestionRequestResponseSchema.parse({
          request: {
            ...pendingRequest,
            id,
            slots: params.slots,
            times: params.times ?? [],
            tags: params.tags ?? [],
            hint: params.hint,
          },
        }),
        { status: 202 },
      );
    }),
  );
  return bodies;
}

/**
 * `GET /api/recipe-suggestions/requests/:id` с поредните състояния; последното се повтаря. Връща брояча на заявките.
 */
export function serveDetail(...states: SuggestionRequestDetail[]) {
  let calls = 0;
  const parsed = states.map((state) =>
    suggestionRequestDetailSchema.parse(state),
  );
  server.use(
    http.get(`/api/recipe-suggestions/requests/${requestId}`, () => {
      const state = parsed[Math.min(calls, parsed.length - 1)];
      calls += 1;
      return HttpResponse.json(state);
    }),
  );
  return () => calls;
}

/** Рецептата, която одобрението на „Пилешки шишчета“ записва в регистъра. */
export const approvedRecipe: Recipe = recipeSchema.parse({
  ...chickenWithRice,
  id: approvedRecipeId,
  title: 'Пилешки шишчета',
});

/**
 * Заявката `detail` (`GET …/requests/:id`) и решенията по предложенията ѝ, както в api-то: `reject`/`restore` сменят
 * статуса, `approve` го прави `approved` с `approvedRecipe`. Връща решенията по ред („reject <id>“) и телата на
 * одобренията.
 */
export function serveDecisions(detail: SuggestionRequestDetail) {
  let current = suggestionRequestDetailSchema.parse(detail);
  const decisions: string[] = [];
  const approvals: unknown[] = [];

  function decide(id: string, patch: Partial<RecipeSuggestion>) {
    current = {
      ...current,
      suggestions: current.suggestions.map((s) =>
        s.id === id ? recipeSuggestionSchema.parse({ ...s, ...patch }) : s,
      ),
    };
    return current.suggestions.find((s) => s.id === id);
  }

  server.use(
    http.get(`/api/recipe-suggestions/requests/${current.request.id}`, () =>
      HttpResponse.json(current),
    ),
    http.post<{ id: string; action: string }>(
      '/api/recipe-suggestions/:id/:action',
      async ({ params, request }) => {
        const { id, action } = params;
        decisions.push(`${action} ${id}`);
        if (action === 'approve') {
          approvals.push(await request.json());
          const suggestion = decide(id, {
            status: 'approved',
            recipeId: approvedRecipe.id,
            decidedBy: RECEPTURKO_ID,
            decidedAt: '2026-10-25T18:10:00.000Z',
          });
          return HttpResponse.json(
            approvedSuggestionResponseSchema.parse({
              recipe: approvedRecipe,
              suggestion,
            }),
            { status: 201 },
          );
        }
        const suggestion =
          action === 'reject'
            ? decide(id, {
                status: 'rejected',
                decidedBy: RECEPTURKO_ID,
                decidedAt: '2026-10-25T18:10:00.000Z',
              })
            : decide(id, {
                status: 'proposed',
                decidedBy: undefined,
                decidedAt: undefined,
              });
        return HttpResponse.json(
          recipeSuggestionResponseSchema.parse({ suggestion }),
        );
      },
    ),
  );
  return { decisions, approvals };
}
