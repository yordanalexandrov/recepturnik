import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { RECEPTURKO_ID } from '../../api/client';
import {
  apiError,
  networkFailure,
  recordRequests,
  server,
} from '../../test/msw';
import { chickenWithRiceDetail, serveRecipe } from '../../test/recipe-detail';
import { serveRecipes } from '../../test/recipes';
import { renderApp } from '../../test/render';

const recipe = chickenWithRiceDetail;

describe('Преглед на рецепта', () => {
  it('показва заглавието, порциите, времето, таговете и оценката', async () => {
    serveRecipe();

    renderApp(`/recipes/${recipe.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пиле с ориз' }),
    ).toBeInTheDocument();
    expect(screen.getByText('4 порции')).toBeInTheDocument();
    expect(screen.getByText('45 мин')).toBeInTheDocument();
    expect(screen.getByText('обяд')).toBeInTheDocument();
    expect(screen.getByText('подходящо за дете')).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Оценка' }),
    ).toHaveAccessibleDescription('4 от 5');
  });

  it('групира продуктите по щанд, с количество и единица', async () => {
    serveRecipe();

    renderApp(`/recipes/${recipe.id}`);

    const meat = await screen.findByRole('list', { name: 'Месо и колбаси' });
    expect(within(meat).getByRole('listitem')).toHaveTextContent(
      'пилешко филе500 г',
    );
    expect(
      within(screen.getByRole('list', { name: 'Плод и зеленчук' })).getByRole(
        'listitem',
      ),
    ).toHaveTextContent('лук2 бр.');
    expect(
      within(
        screen.getByRole('list', { name: 'Подправки, сосове и бакалия' }),
      ).getByRole('listitem'),
    ).toHaveTextContent('солпо вкус');
  });

  it('линкът към източника се отваря в нов раздел, а хранителната стойност е на 100 г', async () => {
    serveRecipe();

    renderApp(`/recipes/${recipe.id}`);

    const source = await screen.findByRole('link', { name: /Източник/ });
    expect(source).toHaveAttribute(
      'href',
      'https://recepti.example/pile-s-oriz',
    );
    expect(source).toHaveAttribute('target', '_blank');
    expect(source.getAttribute('rel')).toContain('noopener');
    expect(screen.getByText(/хранителна стойност на 100 г/)).toHaveTextContent(
      '≈ хранителна стойност на 100 г: 150 kcal · белтъчини 12 г · мазнини 5 г · въглехидрати 14 г',
    );
  });

  it('рецепта за уред показва краткото му име, а пълното е в подсказката', async () => {
    serveRecipe({
      ...recipe,
      appliance: 'air fryer (Philips XXL) — с решетка',
    });

    renderApp(`/recipes/${recipe.id}`);

    const badge = await screen.findByText(/air fryer$/);
    expect(badge).toHaveTextContent('Уред: air fryer');
    expect(badge).toHaveAttribute(
      'title',
      'air fryer (Philips XXL) — с решетка',
    );
  });

  it('рецепта без източник, уред и хранителна стойност не ги показва', async () => {
    serveRecipe({
      ...recipe,
      sourceUrl: undefined,
      nutritionPer100g: undefined,
    });

    renderApp(`/recipes/${recipe.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пиле с ориз' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Източник/ })).toBeNull();
    expect(screen.queryByText(/Уред:/)).toBeNull();
    expect(screen.queryByText(/хранителна стойност/)).toBeNull();
  });

  it('продуктите на компонент са под заглавие с името и порциите му', async () => {
    serveRecipe({
      ...recipe,
      components: [
        { name: 'Песто', servings: 5 },
        { name: 'Сос', servings: 1 },
      ],
      ingredients: recipe.ingredients.map((line, index) => ({
        ...line,
        component: index === 0 ? null : index - 1,
      })),
    });

    renderApp(`/recipes/${recipe.id}`);

    expect(
      await screen.findByRole('heading', { name: 'Песто · за 5 порции' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Песто · за 5 порции' }))
        .getAllByRole('listitem')
        .map((line) => line.textContent),
    ).toEqual(['лук2 бр.']);
    expect(
      within(screen.getByRole('list', { name: 'Сос · за 1 порция' }))
        .getAllByRole('listitem')
        .map((line) => line.textContent),
    ).toEqual(['солпо вкус']);
    // Щандовете са само за главните редове, без тези на компонентите.
    expect(
      within(screen.getByRole('list', { name: 'Месо и колбаси' }))
        .getAllByRole('listitem')
        .map((line) => line.textContent),
    ).toEqual(['пилешко филе500 г']);
    expect(
      screen.queryByRole('list', { name: 'Плод и зеленчук' }),
    ).not.toBeInTheDocument();
  });

  it('показва подготовката преди номерираните стъпки', async () => {
    serveRecipe({
      ...recipe,
      preparation: [
        { kind: 'oven', degrees: 200, fan: 'fan', rack: 'middle' },
        { kind: 'soak', text: 'накисни боба', minutesBefore: 720 },
      ],
    });

    renderApp(`/recipes/${recipe.id}`);

    const preparation = await screen.findByRole('list', { name: 'Подготовка' });
    const items = within(preparation).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '🔥200° · с вентилатор · средна скара',
      '💧накисни боба · от вечерта',
    ]);
    expect(
      within(items[0] as HTMLElement).getByRole('img', { name: 'Фурна' }),
    ).toBeInTheDocument();

    const steps = screen.getByRole('list', { name: 'Стъпки' });
    // Номерата идват от подредения списък.
    expect(steps.tagName).toBe('OL');
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((step) => step.textContent),
    ).toEqual(['Нарежи пилето.', 'Задуши с лука.']);
    expect(
      preparation.compareDocumentPosition(steps) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('стъпка със снимка има миниатюра, която се отваря в голям размер', async () => {
    const user = userEvent.setup();
    const photoId = 'eeeeeeee-1111-4000-8000-000000000001';
    serveRecipe({
      ...recipe,
      steps: [{ text: 'Нарежи пилето.' }, { text: 'Задуши с лука.', photoId }],
    });

    renderApp(`/recipes/${recipe.id}`);

    const steps = within(
      await screen.findByRole('list', { name: 'Стъпки' }),
    ).getAllByRole('listitem');
    expect(within(steps[0] as HTMLElement).queryByRole('img')).toBeNull();
    const thumbnail = within(steps[1] as HTMLElement).getByRole('img', {
      name: 'Снимката на стъпка 2',
    });
    expect(thumbnail.getAttribute('src')).toMatch(
      new RegExp(`^/api/step-photos/${photoId}\\?w=\\d+$`),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Снимката на стъпка 2 в голям размер',
      }),
    );
    const viewer = screen.getByRole('dialog', { name: 'Снимката на стъпка 2' });
    expect(within(viewer).getByRole('img')).toHaveAttribute(
      'src',
      `/api/step-photos/${photoId}`,
    );

    await user.click(within(viewer).getByRole('button', { name: 'Затвори' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Escape също я затваря.
    await user.click(
      screen.getByRole('button', {
        name: 'Снимката на стъпка 2 в голям размер',
      }),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('рецепта без подготовка няма раздел „Подготовка“', async () => {
    serveRecipe();

    renderApp(`/recipes/${recipe.id}`);

    expect(
      await screen.findByRole('list', { name: 'Стъпки' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Подготовка' }),
    ).not.toBeInTheDocument();
  });

  it('непозната рецепта показва „Няма такава рецепта“ и връзка към регистъра', async () => {
    const user = userEvent.setup();
    const id = 'bbbbbbbb-0000-4000-8000-0000000000ff';
    server.use(
      http.get(`/api/recipes/${id}`, () =>
        apiError(404, 'not_found', 'Recipe not found'),
      ),
    );
    serveRecipes([]);
    const { router } = renderApp(`/recipes/${id}`);

    expect(
      await screen.findByRole('heading', { name: 'Няма такава рецепта' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Към рецептите' }));
    expect(router.state.location.pathname).toBe('/recipes');
  });

  it('друга грешка показва съобщение и „Опитай пак“', async () => {
    server.use(http.get(`/api/recipes/${recipe.id}`, () => networkFailure()));

    renderApp(`/recipes/${recipe.id}`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Няма връзка със сървъра',
    );
    serveRecipe();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Опитай пак' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пиле с ориз' }),
    ).toBeInTheDocument();
  });

  it('„← Рецепти“ води обратно към регистъра', async () => {
    const user = userEvent.setup();
    serveRecipe();
    serveRecipes([recipe]);
    const { router } = renderApp(`/recipes/${recipe.id}`);

    await user.click(await screen.findByRole('link', { name: '← Рецепти' }));

    expect(router.state.location.pathname).toBe('/recipes');
    expect(
      await screen.findByRole('link', { name: /Пиле с ориз/ }),
    ).toBeInTheDocument();
  });

  it('заявката за рецептата е от името на Рецептурко', async () => {
    const requests = recordRequests();
    serveRecipe();

    renderApp(`/recipes/${recipe.id}`);

    await screen.findByRole('heading', { level: 1, name: 'Пиле с ориз' });
    const detail = requests.find((request) =>
      request.url.endsWith(`/api/recipes/${recipe.id}`),
    );
    expect(detail?.headers.get('X-Acting-User')).toBe(RECEPTURKO_ID);
  });
});
