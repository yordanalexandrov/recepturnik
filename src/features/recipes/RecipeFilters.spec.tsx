import { type Recipe, recipeSchema } from '@family/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { chickenWithRice, omelette, serveRecipes } from '../../test/recipes';
import { renderApp } from '../../test/render';
import { setViewport } from '../../test/viewport';

const moussaka: Recipe = recipeSchema.parse({
  ...chickenWithRice,
  id: 'bbbbbbbb-0000-4000-8000-000000000003',
  title: 'Мусака',
  prepMinutes: 90,
  tags: ['dinner', 'kid_friendly'],
  rating: 5,
});

const tarator: Recipe = recipeSchema.parse({
  ...omelette,
  id: 'bbbbbbbb-0000-4000-8000-000000000004',
  title: 'Таратор',
  prepMinutes: 10,
  tags: ['lunch', 'quick'],
  archivedAt: '2026-10-01T00:00:00.000Z',
});

const registry = [chickenWithRice, omelette, moussaka, tarator];

/** Заглавията на картите в регистъра, по ред. */
function shownTitles() {
  return screen
    .getAllByRole('listitem')
    .map((item) => within(item).getByRole('link').firstChild?.textContent);
}

describe('Филтри на регистъра на телефон', () => {
  it('„Филтри“ отваря лист; таг стеснява регистъра веднага', async () => {
    const user = userEvent.setup();
    setViewport('narrow');
    const searches = serveRecipes(registry);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });
    expect(screen.queryByRole('group', { name: 'Таг' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Филтри' }));
    const sheet = screen.getByRole('dialog', { name: 'Филтри' });
    await user.click(within(sheet).getByRole('button', { name: 'вечеря' }));
    await user.click(within(sheet).getByRole('button', { name: 'Готово' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      await screen.findByRole('button', { name: 'Филтри (1)' }),
    ).toBeVisible();
    await expect.poll(shownTitles).toEqual(['Мусака']);
    expect(searches.at(-1)?.toString()).toBe('tag=dinner');
  });

  it('„Изчисти“ до „Филтри“ маха всички филтри и подредбата', async () => {
    const user = userEvent.setup();
    setViewport('narrow');
    serveRecipes(registry);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });
    expect(screen.queryByRole('button', { name: 'Изчисти' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Филтри' }));
    await user.click(screen.getByRole('button', { name: 'обяд' }));
    await user.click(screen.getByRole('button', { name: '30–45 мин' }));
    await user.click(screen.getByRole('radio', { name: 'по оценка' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Покажи архивираните' }),
    );
    await user.click(screen.getByRole('button', { name: 'Готово' }));
    await expect.poll(shownTitles).toEqual(['Пиле с ориз']);

    await user.click(screen.getByRole('button', { name: 'Изчисти' }));

    await expect.poll(shownTitles).toEqual(['Мусака', 'Омлет', 'Пиле с ориз']);
    expect(screen.getByRole('button', { name: 'Филтри' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Изчисти' })).toBeNull();
  });
});

describe('Филтри на регистъра', () => {
  it('„Изчисти“ в панела маха всички филтри', async () => {
    const user = userEvent.setup();
    setViewport('wide');
    serveRecipes(registry);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });
    const panel = screen.getByRole('complementary', { name: 'Филтри' });
    expect(within(panel).queryByRole('button', { name: 'Изчисти' })).toBeNull();

    await user.click(within(panel).getByRole('button', { name: 'закуска' }));
    await expect.poll(shownTitles).toEqual(['Омлет']);
    await user.click(within(panel).getByRole('button', { name: 'Изчисти' }));

    await expect.poll(shownTitles).toEqual(['Мусака', 'Омлет', 'Пиле с ориз']);
    expect(
      within(panel).getByRole('button', { name: 'закуска' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('„Време“ показва рецептите в който и да е от избраните интервали', async () => {
    const user = userEvent.setup();
    setViewport('wide');
    const searches = serveRecipes(registry);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });

    const time = screen.getByRole('group', { name: 'Време' });
    await user.click(within(time).getByRole('button', { name: 'до 15 мин' }));
    await user.click(within(time).getByRole('button', { name: 'над 60 мин' }));

    await expect.poll(shownTitles).toEqual(['Мусака', 'Омлет']);
    expect(searches.at(-1)?.getAll('time')).toEqual(['0-15', '60+']);
  });

  it('„по оценка“ подрежда първо най-харесваните, „по име“ връща азбучния ред', async () => {
    const user = userEvent.setup();
    setViewport('wide');
    const searches = serveRecipes(registry);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });
    const sort = screen.getByRole('group', { name: 'Подреди' });
    expect(within(sort).getByRole('radio', { name: 'по име' })).toBeChecked();

    await user.click(within(sort).getByRole('radio', { name: 'по оценка' }));
    await expect.poll(shownTitles).toEqual(['Мусака', 'Пиле с ориз', 'Омлет']);
    expect(searches.at(-1)?.get('sort')).toBe('rating');

    await user.click(within(sort).getByRole('radio', { name: 'по име' }));
    await expect.poll(shownTitles).toEqual(['Мусака', 'Омлет', 'Пиле с ориз']);
  });
});

describe('Брояч на регистъра', () => {
  it('е „N рецепти“ без филтри и „N от M“ с филтър или търсене', async () => {
    const user = userEvent.setup();
    setViewport('wide');
    serveRecipes(registry);
    renderApp('/recipes');

    expect(await screen.findByText('3 рецепти')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'вечеря' }));
    expect(await screen.findByText('1 от 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'вечеря' }));
    expect(await screen.findByText('3 рецепти')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Търси' }), 'пиле');
    expect(await screen.findByText('1 от 3')).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Търси' }));

    // Архивираните разширяват регистъра, не го стесняват.
    await user.click(
      screen.getByRole('checkbox', { name: 'Покажи архивираните' }),
    );
    expect(await screen.findByText('4 рецепти')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'обяд' }));
    expect(await screen.findByText('2 от 4')).toBeInTheDocument();
  });

  it('за една рецепта казва „1 рецепта“', async () => {
    serveRecipes([omelette]);
    renderApp('/recipes');

    expect(await screen.findByText('1 рецепта')).toBeInTheDocument();
  });
});

describe('Архивирани рецепти', () => {
  it('са скрити, докато не се включи „Покажи архивираните“, и тогава са отбелязани', async () => {
    const user = userEvent.setup();
    setViewport('wide');
    const searches = serveRecipes(registry);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });
    expect(screen.queryByRole('link', { name: /Таратор/ })).toBeNull();

    await user.click(
      screen.getByRole('checkbox', { name: 'Покажи архивираните' }),
    );

    const card = await screen.findByRole('link', { name: /Таратор/ });
    expect(card).toHaveTextContent('архивирана');
    expect(screen.getByRole('link', { name: /Мусака/ })).not.toHaveTextContent(
      'архивирана',
    );
    expect(searches.at(-1)?.get('includeArchived')).toBe('true');
  });
});

describe('Филтри на регистъра на широк екран', () => {
  it('са в страничен панел до списъка, без „Филтри“ и лист', async () => {
    const user = userEvent.setup();
    setViewport('wide');
    serveRecipes(registry);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });

    const panel = screen.getByRole('complementary', { name: 'Филтри' });
    expect(screen.queryByRole('button', { name: /^Филтри/ })).toBeNull();
    await user.click(
      within(panel).getByRole('button', { name: 'подходящо за дете' }),
    );

    await expect.poll(shownTitles).toEqual(['Мусака', 'Пиле с ориз']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Запазени филтри', () => {
  it('остават след отваряне на рецепта и връщане назад', async () => {
    const user = userEvent.setup();
    setViewport('wide');
    serveRecipes(registry);
    const { router } = renderApp('/recipes');
    await screen.findByRole('link', { name: /Мусака/ });
    await user.click(screen.getByRole('button', { name: 'подходящо за дете' }));
    await user.click(screen.getByRole('radio', { name: 'по оценка' }));
    await expect.poll(shownTitles).toEqual(['Мусака', 'Пиле с ориз']);

    await user.click(screen.getByRole('link', { name: /Мусака/ }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/recipes/${moussaka.id}`),
    );
    act(() => router.history.back());

    await screen.findByRole('link', { name: /Мусака/ });
    expect(
      screen.getByRole('button', { name: 'подходящо за дете' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('radio', { name: 'по оценка' })).toBeChecked();
    expect(shownTitles()).toEqual(['Мусака', 'Пиле с ориз']);
  });

  it('при четене невалидните стойности отпадат, а валидните остават', async () => {
    setViewport('wide');
    sessionStorage.setItem(
      'recepturnik.recipeFilters',
      JSON.stringify({
        tags: ['dinner', 'dessert'],
        times: ['5-10', '60+'],
        includeArchived: 'yes',
        sort: 'random',
      }),
    );
    const searches = serveRecipes(registry);
    renderApp('/recipes');

    await expect.poll(shownTitles).toEqual(['Мусака']);
    // Списъкът и целият регистър (за брояча); нито една заявка не носи отпадналите стойности.
    expect(searches.map(String).sort()).toEqual([
      'includeArchived=true',
      'tag=dinner&time=60%2B',
    ]);
    expect(screen.getByRole('radio', { name: 'по име' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Покажи архивираните' }),
    ).not.toBeChecked();
  });

  it('повреден запис значи без филтри', async () => {
    setViewport('wide');
    sessionStorage.setItem('recepturnik.recipeFilters', '{не е json');
    serveRecipes(registry);
    renderApp('/recipes');

    await expect.poll(shownTitles).toEqual(['Мусака', 'Омлет', 'Пиле с ориз']);
    expect(screen.queryByRole('button', { name: 'Изчисти' })).toBeNull();
  });
});
