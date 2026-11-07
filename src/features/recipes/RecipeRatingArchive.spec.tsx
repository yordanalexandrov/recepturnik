import {
  type Recipe,
  recipeResponseSchema,
  recipesResponseSchema,
} from '@family/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiError, server } from '../../test/msw';
import { chickenWithRiceDetail, serveRecipe } from '../../test/recipe-detail';
import { omelette, toSummary } from '../../test/recipes';
import { renderApp } from '../../test/render';

const recipe = { ...chickenWithRiceDetail, rating: null };

interface RatingCall {
  method: string;
  rating: number | null;
}

/** `PUT`/`DELETE /api/recipes/:id/rating`: отговаря с рецептата с новата оценка и записва заявките. */
function serveRating(): RatingCall[] {
  const calls: RatingCall[] = [];
  const answer = (rating: number | null) => {
    calls.push({ method: rating === null ? 'DELETE' : 'PUT', rating });
    return HttpResponse.json(
      recipeResponseSchema.parse({ recipe: { ...recipe, rating } }),
    );
  };
  server.use(
    http.put<never, { rating: number }>(
      `/api/recipes/${recipe.id}/rating`,
      async ({ request }) => answer((await request.json()).rating),
    ),
    http.delete(`/api/recipes/${recipe.id}/rating`, () => answer(null)),
  );
  return calls;
}

describe('Оценка на рецептата', () => {
  it('„4 от 5“ поставя оценката, а повторното натискане я маха', async () => {
    const user = userEvent.setup();
    serveRecipe(recipe);
    const calls = serveRating();

    renderApp(`/recipes/${recipe.id}`);
    const rating = await screen.findByRole('group', { name: 'Оценка' });
    const four = within(rating).getByRole('button', { name: '4 от 5' });
    expect(four).toHaveAttribute('aria-pressed', 'false');

    await user.click(four);

    await expect.poll(() => calls).toEqual([{ method: 'PUT', rating: 4 }]);
    expect(four).toHaveAttribute('aria-pressed', 'true');

    await user.click(four);

    await expect
      .poll(() => calls.at(-1))
      .toEqual({ method: 'DELETE', rating: null });
    for (const star of within(rating).getAllByRole('button')) {
      expect(star).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('оценката се вижда веднага, а при грешка се връща със съобщение', async () => {
    const user = userEvent.setup();
    serveRecipe({ ...recipe, rating: 3 });
    let fail: () => void = () => {};
    server.use(
      http.put(
        `/api/recipes/${recipe.id}/rating`,
        () =>
          new Promise<Response>((resolve) => {
            fail = () =>
              resolve(apiError(404, 'not_found', 'Няма такава рецепта'));
          }),
      ),
    );

    renderApp(`/recipes/${recipe.id}`);
    const rating = await screen.findByRole('group', { name: 'Оценка' });
    await user.click(within(rating).getByRole('button', { name: '5 от 5' }));

    // Сървърът още не е отговорил, а оценката вече е 5.
    expect(
      within(rating).getByRole('button', { name: '5 от 5' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(rating).toHaveAccessibleDescription('5 от 5');

    fail();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Няма такава рецепта',
    );
    expect(
      within(rating).getByRole('button', { name: '3 от 5' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(rating).toHaveAccessibleDescription('3 от 5');
  });
});

/**
 * Регистърът и рецептата над едно общо състояние, както api-то: `GET /api/recipes` крие архивираните без
 * `includeArchived=true`, а `archive`/`unarchive` сменят `archivedAt`.
 */
function serveArchive(): { archiveCalls: string[] } {
  let current: Recipe = recipe;
  const archiveCalls: string[] = [];
  const respond = () =>
    HttpResponse.json(recipeResponseSchema.parse({ recipe: current }));
  server.use(
    http.get('/api/recipes', ({ request }) => {
      const includeArchived =
        new URL(request.url).searchParams.get('includeArchived') === 'true';
      const recipes = [current, omelette].filter(
        (item) => includeArchived || item.archivedAt === null,
      );
      return HttpResponse.json(
        recipesResponseSchema.parse({ recipes: recipes.map(toSummary) }),
      );
    }),
    http.get(`/api/recipes/${recipe.id}`, respond),
    http.post(`/api/recipes/${recipe.id}/archive`, () => {
      archiveCalls.push('archive');
      current = { ...current, archivedAt: '2026-11-07T10:00:00.000Z' };
      return respond();
    }),
    http.post(`/api/recipes/${recipe.id}/unarchive`, () => {
      archiveCalls.push('unarchive');
      current = { ...current, archivedAt: null };
      return respond();
    }),
  );
  return { archiveCalls };
}

describe('Архив на рецептата', () => {
  it('„Архивирай“ показва „Архивирана“ и „Върни“, а рецептата изчезва от регистъра', async () => {
    const user = userEvent.setup();
    const { archiveCalls } = serveArchive();

    renderApp('/recipes');
    await user.click(await screen.findByRole('link', { name: /Пиле с ориз/ }));
    await user.click(await screen.findByRole('button', { name: 'Архивирай' }));

    expect(
      await screen.findByRole('button', { name: 'Върни' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Архивирана')).toBeInTheDocument();
    expect(archiveCalls).toEqual(['archive']);

    await user.click(screen.getByRole('link', { name: '← Рецепти' }));

    expect(
      await screen.findByRole('link', { name: /Омлет/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Пиле с ориз/ })).toBeNull();
  });

  it('„Върни“ възстановява архивираната рецепта в регистъра', async () => {
    const user = userEvent.setup();
    const { archiveCalls } = serveArchive();

    renderApp(`/recipes/${recipe.id}`);
    await user.click(await screen.findByRole('button', { name: 'Архивирай' }));
    await user.click(await screen.findByRole('button', { name: 'Върни' }));

    expect(
      await screen.findByRole('button', { name: 'Архивирай' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Архивирана')).toBeNull();
    expect(archiveCalls).toEqual(['archive', 'unarchive']);

    await user.click(screen.getByRole('link', { name: '← Рецепти' }));

    expect(
      await screen.findByRole('link', { name: /Пиле с ориз/ }),
    ).toBeInTheDocument();
  });

  it('при грешка архивът показва съобщение, а рецептата остава', async () => {
    const user = userEvent.setup();
    serveRecipe(recipe);
    server.use(
      http.post(`/api/recipes/${recipe.id}/archive`, () =>
        apiError(404, 'not_found', 'Няма такава рецепта'),
      ),
    );

    renderApp(`/recipes/${recipe.id}`);
    await user.click(await screen.findByRole('button', { name: 'Архивирай' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Няма такава рецепта',
    );
    expect(screen.getByRole('button', { name: 'Архивирай' })).toBeEnabled();
    expect(screen.queryByText('Архивирана')).toBeNull();
  });
});
