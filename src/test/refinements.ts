import {
  type RecipeRefinement,
  type RecipeRefineRequest,
  recipeRefinementSchema,
  recipeRefineResponseSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { RECEPTURKO_ID } from '../api/client';
import { server } from './msw';
import { chickenWithPesto, stepPhotoId } from './recipe-edit';

// Фикстури за „Подобри рецептата“ (GLOSSARY на family: Подобряване на рецепта) върху „Пиле с песто“ от `./recipe-edit`.
// Отговорите минават през schema-ите от @family/shared.

/** Подобрението: по-подробни стъпки (снимката на рецептата остава на втората), време и нова подготовка. */
export const refinement: RecipeRefinement = recipeRefinementSchema.parse({
  steps: [
    { text: 'Овкуси пилето със сол и го остави 10 минути.' },
    {
      text: 'Изпечи пилето 25 минути на 200 °C, докато стане златисто.',
      photoId: stepPhotoId,
    },
    { text: 'Залей с песто точно преди сервиране.' },
  ],
  prepMinutes: 45,
  preparation: [
    { kind: 'fridge', text: 'извади пилето от хладилника', minutesBefore: 30 },
  ],
  changes:
    'Стъпките са по-подробни, а подготовката казва кога да извадиш пилето.',
  source: 'read',
  droppedPhotos: 0,
});

/** Заявката за подобряване на „Пиле с песто“, докато чака. */
export const pendingRefinement: RecipeRefineRequest =
  recipeRefineResponseSchema.parse({
    request: {
      id: 'cccccccc-0000-4000-8000-000000000011',
      recipeId: chickenWithPesto.id,
      status: 'pending',
      requestedBy: RECEPTURKO_ID,
      createdAt: '2026-11-07T10:00:00.000Z',
    },
  }).request;

/**
 * `POST /api/recipes/:id/refinements` и `GET /api/recipes/refinements/:id`: заявката е `pending` при първите
 * `pendingPolls` четения, после `finished` (по подразбиране — готова с `refinement`). Връща колко пъти е пусната.
 */
export function serveRefinement(
  finished: Partial<RecipeRefineRequest> = { status: 'done', refinement },
  pendingPolls = 0,
): { posts: number } {
  const calls = { posts: 0 };
  let polls = 0;
  server.use(
    http.post(`/api/recipes/${chickenWithPesto.id}/refinements`, () => {
      calls.posts += 1;
      return HttpResponse.json({ request: pendingRefinement }, { status: 202 });
    }),
    http.get(`/api/recipes/refinements/${pendingRefinement.id}`, () => {
      polls += 1;
      const request =
        polls <= pendingPolls
          ? pendingRefinement
          : {
              ...pendingRefinement,
              finishedAt: '2026-11-07T10:00:40.000Z',
              ...finished,
            };
      return HttpResponse.json(recipeRefineResponseSchema.parse({ request }));
    }),
  );
  return calls;
}
