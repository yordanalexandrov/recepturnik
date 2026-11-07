import { recipeRevisionResponseSchema } from '@family/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  doneDetail,
  importedSuggestion,
  importId,
  serveImport,
} from '../../test/imports';
import { server } from '../../test/msw';
import { chicken, salt } from '../../test/recipe-detail';
import { renderApp } from '../../test/render';
import { pendingRevision } from '../../test/revisions';

const INSTRUCTION = 'без сумак, и пилето да се пече 35 минути';

/** Поправката на черновата „Пилешко филе със сумак“: без сумака и по-дълго печене. */
const draftRevision = {
  changes: 'Сумакът е махнат, а пилето се пече 35 минути.',
  servings: 4,
  prepMinutes: 45,
  ingredients: [
    { ingredient: chicken, quantity: 600, unit: 'g', component: null },
    { ingredient: salt, quantity: null, unit: 'pinch', component: null },
  ],
  components: [],
  steps: [{ text: 'Овкусете пилето.' }, { text: 'Изпечете го 35 минути.' }],
  preparation: [],
  droppedPhotos: 0,
};

/** `POST …/recipe-suggestions/:id/revisions` за черновата и поправката, веднага готова. Връща телата на `POST`. */
function serveDraftRevision() {
  const posts: unknown[] = [];
  const { recipeId: _recipeId, ...revisionOfRecipe } = pendingRevision;
  const request = {
    ...revisionOfRecipe,
    suggestionId: importedSuggestion.id,
    instruction: INSTRUCTION,
  };
  server.use(
    http.post(
      `/api/recipe-suggestions/${importedSuggestion.id}/revisions`,
      async ({ request: body }) => {
        posts.push(await body.json());
        return HttpResponse.json(
          recipeRevisionResponseSchema.parse({ request }),
          { status: 202 },
        );
      },
    ),
    http.get(`/api/recipes/revisions/${pendingRevision.id}`, () =>
      HttpResponse.json(
        recipeRevisionResponseSchema.parse({
          request: {
            ...request,
            status: 'done',
            revision: draftRevision,
            finishedAt: '2026-11-07T10:00:40.000Z',
          },
        }),
      ),
    ),
  );
  return posts;
}

describe('„Поправи с AI“ на чернова от внасяне', () => {
  it('поправя черновата във формата, както е, а „Запази“ я одобрява с поправката', async () => {
    const user = userEvent.setup();
    const api = serveImport(doneDetail);
    const posts = serveDraftRevision();
    renderApp(`/recipes/import/${importId}`);

    const title = await screen.findByRole('textbox', { name: 'Заглавие' });
    await user.clear(title);
    await user.type(title, 'Пиле на фурна');
    await user.click(screen.getByRole('button', { name: 'Поправи с AI' }));
    const sheet = within(
      await screen.findByRole('dialog', { name: 'Поправи с AI' }),
    );
    await user.type(sheet.getByLabelText('Какво да се промени?'), INSTRUCTION);
    await user.click(sheet.getByRole('button', { name: 'Изпрати' }));

    expect(await sheet.findByText(draftRevision.changes)).toBeInTheDocument();
    expect(posts).toEqual([
      {
        instruction: INSTRUCTION,
        recipe: expect.objectContaining({
          title: 'Пиле на фурна',
          servings: 4,
          steps: [
            { text: 'Овкусете пилето.' },
            { text: 'Изпечете го 30 минути.' },
          ],
        }),
      },
    ]);

    await user.click(sheet.getByRole('button', { name: 'Приеми' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Време (мин)' })).toHaveValue(
      '45',
    );
    expect(screen.getByRole('textbox', { name: 'Заглавие' })).toHaveValue(
      'Пиле на фурна',
    );

    await user.click(screen.getByRole('button', { name: 'Запази' }));
    await screen.findByRole('heading', { level: 1 });
    expect(api.approved).toEqual([
      expect.objectContaining({
        revisionId: pendingRevision.id,
        title: 'Пиле на фурна',
        prepMinutes: 45,
        steps: [
          { text: 'Овкусете пилето.' },
          { text: 'Изпечете го 35 минути.' },
        ],
      }),
    ]);
  });
});
