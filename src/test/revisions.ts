import {
  type RecipeRevision,
  type RecipeRevisionRequest,
  recipeRevisionResponseSchema,
  recipeRevisionSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { RECEPTURKO_ID } from '../api/client';
import { apiError, server } from './msw';
import { chicken, salt } from './recipe-detail';
import { basil, chickenWithPesto, stepPhotoId } from './recipe-edit';

// Фикстури за „Поправи с AI“ (GLOSSARY на family: Поправка на рецепта) върху „Пиле с песто“ от `./recipe-edit`.
// Отговорите минават през schema-ите от @family/shared.

export const INSTRUCTION =
  'пилето иска още 10 минути и никъде не пише черен пипер';

/** Поправката: повече пиле, по-дълго печене и черен пипер като нов продукт; песто-то остава. */
export const revision: RecipeRevision = recipeRevisionSchema.parse({
  changes: 'Пилето се пече 10 минути повече, а черният пипер е нов продукт.',
  servings: 2,
  prepMinutes: 50,
  ingredients: [
    { ingredient: chicken, quantity: 500, unit: 'g', component: null },
    {
      newProduct: { name: 'черен пипер', unit: 'g', aisle: 'spices' },
      quantity: null,
      unit: 'pinch',
      component: null,
    },
    { ingredient: basil, quantity: 50, unit: 'g', component: 0 },
    { ingredient: salt, quantity: null, unit: 'pinch', component: 0 },
  ],
  components: [{ name: 'Песто', servings: 5 }],
  steps: [
    { text: 'Изпечи пилето 35 минути с черен пипер.', photoId: stepPhotoId },
    { text: 'Залей с песто.' },
  ],
  preparation: [{ kind: 'oven', degrees: 200, fan: 'fan' }],
  droppedPhotos: 0,
});

/** Поправката на „Пиле с песто“, докато чака. */
export const pendingRevision: RecipeRevisionRequest =
  recipeRevisionResponseSchema.parse({
    request: {
      id: 'dddddddd-0000-4000-8000-000000000001',
      recipeId: chickenWithPesto.id,
      instruction: INSTRUCTION,
      applied: [],
      status: 'pending',
      requestedBy: RECEPTURKO_ID,
      createdAt: '2026-11-07T10:00:00.000Z',
      stale: false,
    },
  }).request;

/** Поправката, както я връща api-то: `pendingRevision` с `finished` отгоре. */
export function revisionRequest(
  finished: Partial<RecipeRevisionRequest>,
): RecipeRevisionRequest {
  return recipeRevisionResponseSchema.parse({
    request: {
      ...pendingRevision,
      finishedAt: '2026-11-07T10:00:40.000Z',
      ...finished,
    },
  }).request;
}

export interface RevisionCalls {
  /** Телата на `POST …/revisions`. */
  posts: unknown[];
  /** Id-тата на отхвърлените поправки. */
  rejected: string[];
}

/**
 * `POST /api/recipes/:id/revisions`, `GET /api/recipes/revisions/:id` и „Отхвърли“: поправката е `pending` при първите
 * `pendingPolls` четения след всеки `POST`, после `finished` (по подразбиране — готова с `revision`).
 */
export function serveRevision(
  finished: Partial<RecipeRevisionRequest> = { status: 'done', revision },
  pendingPolls = 0,
): RevisionCalls {
  const calls: RevisionCalls = { posts: [], rejected: [] };
  let polls = 0;
  let current = (): RecipeRevisionRequest =>
    polls <= pendingPolls ? pendingRevision : revisionRequest(finished);
  server.use(
    http.post(
      `/api/recipes/${chickenWithPesto.id}/revisions`,
      async ({ request }) => {
        calls.posts.push(await request.json());
        polls = 0;
        current = () =>
          polls <= pendingPolls
            ? pendingRevision
            : revisionRequest({ ...finished, stale: false });
        return HttpResponse.json({ request: pendingRevision }, { status: 202 });
      },
    ),
    http.get(`/api/recipes/revisions/${pendingRevision.id}`, () => {
      polls += 1;
      return HttpResponse.json({ request: current() });
    }),
    http.post(`/api/recipes/revisions/${pendingRevision.id}/reject`, () => {
      calls.rejected.push(pendingRevision.id);
      const rejected = revisionRequest({ ...finished, decision: 'rejected' });
      current = () => rejected;
      return HttpResponse.json({ request: rejected });
    }),
  );
  return calls;
}

/** Следващият `PUT` на рецептата с поправка е `409 revision_stale`: рецептата е записана след поправката. */
export function refuseStaleSave() {
  server.use(
    http.put(
      `/api/recipes/${chickenWithPesto.id}`,
      () =>
        apiError(
          409,
          'conflict',
          'The recipe was saved after the revision',
          'revision_stale',
        ),
      { once: true },
    ),
  );
}
