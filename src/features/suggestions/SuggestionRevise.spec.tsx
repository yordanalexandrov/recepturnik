import { recipeRevisionResponseSchema } from '@family/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/msw';
import { chicken, salt, serveRecipe } from '../../test/recipe-detail';
import { serveAppliances, serveIngredientSearch } from '../../test/recipe-form';
import { renderApp } from '../../test/render';
import { pendingRevision } from '../../test/revisions';
import {
  approvedRecipe,
  doneRequest,
  requestId,
  serveDecisions,
  skewersSuggestion,
} from '../../test/suggestions';

const INSTRUCTION = 'без сумак, и шишчетата да се пекат на скара';

/** Поправката на „Пилешки шишчета“: без сумака и със скара. */
const suggestionRevision = {
  changes: 'Сумакът е махнат, а шишчетата се пекат на скара.',
  servings: 4,
  prepMinutes: 30,
  ingredients: [
    { ingredient: chicken, quantity: 0.6, unit: 'kg', component: null },
    { ingredient: salt, quantity: null, unit: 'pinch', component: null },
  ],
  components: [],
  steps: [{ text: 'Нарежи пилето.' }, { text: 'Нанижи и изпечи на скара.' }],
  preparation: [],
  droppedPhotos: 0,
};

/** `POST …/recipe-suggestions/:id/revisions` и поправката, веднага готова. Връща телата на `POST`. */
function serveSuggestionRevision() {
  const posts: unknown[] = [];
  const { recipeId: _recipeId, ...revisionOfRecipe } = pendingRevision;
  const request = {
    ...revisionOfRecipe,
    suggestionId: skewersSuggestion.id,
    instruction: INSTRUCTION,
  };
  server.use(
    http.post(
      `/api/recipe-suggestions/${skewersSuggestion.id}/revisions`,
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
            revision: suggestionRevision,
            finishedAt: '2026-11-07T10:00:40.000Z',
          },
        }),
      ),
    ),
  );
  return posts;
}

function listTexts(name: string) {
  return within(screen.getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

describe('„Поправи с AI“ на предложение', () => {
  it('от картата отваря листа над формата, сравнява с нея, а „Приеми“ слага поправката във формата и я одобрява с нея', async () => {
    const user = userEvent.setup();
    serveAppliances();
    serveIngredientSearch();
    serveRecipe(approvedRecipe);
    const { approvals } = serveDecisions({
      request: doneRequest,
      suggestions: [skewersSuggestion],
    });
    const posts = serveSuggestionRevision();
    renderApp(`/recipes/suggest/${requestId}`);

    const card = await screen.findByRole('article', {
      name: 'Пилешки шишчета',
    });
    await user.click(within(card).getByRole('link', { name: 'Поправи с AI' }));
    const sheet = within(
      await screen.findByRole('dialog', { name: 'Поправи с AI' }),
    );
    await user.type(sheet.getByLabelText('Какво да се промени?'), INSTRUCTION);
    await user.click(sheet.getByRole('button', { name: 'Изпрати' }));

    expect(
      await sheet.findByText(suggestionRevision.changes),
    ).toBeInTheDocument();
    expect(posts).toEqual([
      {
        instruction: INSTRUCTION,
        recipe: expect.objectContaining({
          title: 'Пилешки шишчета',
          servings: 4,
          steps: [{ text: 'Нарежи пилето.' }, { text: 'Нанижи и изпечи.' }],
        }),
      },
    ]);
    expect(listTexts('Продукти: сега')).toEqual([
      'пилешко филе · 0,6 кг',
      'сумак · 1 ч.л. (нов продукт)',
      'сол · по вкус',
    ]);
    expect(listTexts('Продукти: с поправката')).toEqual([
      'пилешко филе · 0,6 кг',
      'сол · по вкус',
    ]);

    await user.click(sheet.getByRole('button', { name: 'Приеми' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Време (мин)' })).toHaveValue(
      '30',
    );
    expect(screen.getByRole('textbox', { name: 'Заглавие' })).toHaveValue(
      'Пилешки шишчета',
    );

    await user.click(
      within(screen.getByRole('group', { name: 'Действия' })).getByRole(
        'button',
        { name: 'Запази' },
      ),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пилешки шишчета' }),
    ).toBeInTheDocument();
    expect(approvals).toEqual([
      expect.objectContaining({
        revisionId: pendingRevision.id,
        prepMinutes: 30,
        steps: [
          { text: 'Нарежи пилето.' },
          { text: 'Нанижи и изпечи на скара.' },
        ],
      }),
    ]);
  });
});
