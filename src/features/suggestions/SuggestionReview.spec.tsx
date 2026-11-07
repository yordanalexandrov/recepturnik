import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { chicken, salt, serveRecipe } from '../../test/recipe-detail';
import { serveAppliances, serveIngredientSearch } from '../../test/recipe-form';
import { renderApp } from '../../test/render';
import {
  approvedRecipe,
  doneRequest,
  requestId,
  serveDecisions,
  skewersSuggestion,
  soupSuggestion,
} from '../../test/suggestions';

/** Редовете в списъка „Продукти“ на формата, в реда, в който се виждат. */
function ingredientLines() {
  return within(screen.getByRole('list', { name: 'Продукти' }))
    .getAllByRole('listitem')
    .map((line) => line.textContent);
}

describe('Приемане на предложение', () => {
  it('„Приеми“ отваря формата с предложението, а „Запази“ го прави рецепта', async () => {
    const user = userEvent.setup();
    serveAppliances();
    serveIngredientSearch();
    serveRecipe(approvedRecipe);
    const { decisions, approvals } = serveDecisions({
      request: doneRequest,
      suggestions: [skewersSuggestion],
    });

    renderApp(`/recipes/suggest/${requestId}`);

    const card = await screen.findByRole('article', {
      name: 'Пилешки шишчета',
    });
    await user.click(within(card).getByRole('link', { name: 'Приеми' }));

    expect(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
    ).toHaveValue('Пилешки шишчета');
    expect(screen.getByRole('textbox', { name: 'Порции' })).toHaveValue('4');
    expect(screen.getByRole('textbox', { name: 'Време (мин)' })).toHaveValue(
      '25',
    );
    expect(screen.getByText('Бързо е и децата го обичат.')).toBeInTheDocument();
    // Познатите продукти са свързани с регистъра; новият („сумак“) чака свързване и е отгоре.
    expect(await screen.findAllByRole('img', { name: 'Свързан' })).toHaveLength(
      2,
    );
    expect(ingredientLines()[0]).toContain('сумак');

    // Несвързаният ред спира записа и отваря листа си; тук го махаме.
    await user.click(
      within(screen.getByRole('group', { name: 'Действия' })).getByRole(
        'button',
        { name: 'Запази' },
      ),
    );
    const sheet = within(
      await screen.findByRole('dialog', { name: 'Продукт' }),
    );
    await user.click(sheet.getByRole('button', { name: 'Премахни ред' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Действия' })).getByRole(
        'button',
        { name: 'Запази' },
      ),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пилешки шишчета' }),
    ).toBeInTheDocument();
    expect(decisions).toEqual([`approve ${skewersSuggestion.id}`]);
    expect(approvals).toEqual([
      expect.objectContaining({
        title: 'Пилешки шишчета',
        servings: 4,
        prepMinutes: 25,
        sourceUrl: 'https://recepti.example/pileshki-shishcheta',
        tags: ['dinner', 'quick'],
        appliance: null,
        steps: [{ text: 'Нарежи пилето.' }, { text: 'Нанижи и изпечи.' }],
        ingredients: [
          {
            ingredientId: chicken.id,
            quantity: 0.6,
            unit: 'kg',
            component: null,
          },
          {
            ingredientId: salt.id,
            quantity: null,
            unit: 'pinch',
            component: null,
          },
        ],
      }),
    ]);
  });

  it('решено предложение не се приема пак: отхвърленото има „Върни“', async () => {
    const user = userEvent.setup();
    serveAppliances();
    serveIngredientSearch();
    const { decisions } = serveDecisions({
      request: doneRequest,
      suggestions: [soupSuggestion],
    });

    renderApp(`/recipes/suggest/${requestId}/${soupSuggestion.id}`);

    expect(
      await screen.findByText('Предложението е отхвърлено.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Заглавие' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Върни' }));

    expect(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
    ).toHaveValue('Леща чорба');
    expect(decisions).toEqual([`restore ${soupSuggestion.id}`]);
  });
});
