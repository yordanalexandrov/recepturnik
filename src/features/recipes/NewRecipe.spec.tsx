import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { RECEPTURKO_ID } from '../../api/client';
import { networkFailure, recordRequests, server } from '../../test/msw';
import { chicken } from '../../test/recipe-detail';
import { mint, serveForm, serveIngredientSearch } from '../../test/recipe-form';
import { renderApp } from '../../test/render';

/** Редовете в списъка „Продукти“, в реда, в който се виждат. */
function ingredientLines() {
  return within(screen.getByRole('list', { name: 'Продукти' })).queryAllByRole(
    'listitem',
  );
}

/** Листът за един ред продукт. */
function lineSheet() {
  return within(screen.getByRole('dialog', { name: 'Продукт' }));
}

/** Редовете в списъка „Стъпки“, в реда, в който се виждат. */
function stepLines() {
  return within(screen.getByRole('list', { name: 'Стъпки' }))
    .queryAllByRole('listitem')
    .map((line) => line.textContent);
}

/** Листът за една стъпка. */
function stepSheet() {
  return within(screen.getByRole('dialog', { name: 'Стъпка' }));
}

/** Лентата с основното действие на екрана. */
function actionBar() {
  return within(screen.getByRole('group', { name: 'Действия' }));
}

/** „Добави стъпка“ с този текст и „Готово“. */
async function addStep(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(screen.getByRole('button', { name: 'Добави стъпка' }));
  await user.type(stepSheet().getByRole('textbox', { name: /^Стъпка/ }), text);
  await user.click(stepSheet().getByRole('button', { name: 'Готово' }));
}

describe('Нова рецепта', () => {
  it('попълнената форма праща POST /api/recipes и отива на прегледа', async () => {
    const user = userEvent.setup();
    const saved = serveForm();
    const requests = recordRequests();

    renderApp('/recipes/new');

    await user.type(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
      'Пилешка супа',
    );
    await user.clear(screen.getByRole('textbox', { name: 'Порции' }));
    await user.type(screen.getByRole('textbox', { name: 'Порции' }), '6');
    await user.type(screen.getByRole('textbox', { name: 'Време (мин)' }), '50');
    await user.type(
      screen.getByRole('textbox', { name: 'Източник (линк)' }),
      'https://recepti.example/supa',
    );
    await screen.findByRole('option', { name: 'sous vide' });
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Уред' }),
      'air fryer',
    );
    await user.click(screen.getByRole('button', { name: 'обяд' }));

    await user.click(screen.getByRole('button', { name: 'Добави стъпка' }));
    await user.type(
      stepSheet().getByRole('textbox', { name: 'Стъпка 1' }),
      'Свари пилето.',
    );
    await user.click(stepSheet().getByRole('button', { name: 'Готово' }));

    await user.click(screen.getByRole('button', { name: 'Добави продукт' }));
    const sheet = lineSheet();
    await user.type(sheet.getByRole('textbox', { name: 'Продукт' }), 'пил');
    await user.click(
      within(await sheet.findByRole('list', { name: 'Съвпадения' })).getByRole(
        'button',
        { name: 'пилешко филе' },
      ),
    );
    await user.type(sheet.getByRole('textbox', { name: 'Количество' }), '0,5');
    await user.selectOptions(
      sheet.getByRole('combobox', { name: 'Единица' }),
      'кг',
    );
    await user.click(sheet.getByRole('button', { name: 'Готово' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const [line] = ingredientLines();
    expect(
      within(line as HTMLElement).getByRole('button', {
        name: 'пилешко филе · 0,5 кг',
      }),
    ).toBeInTheDocument();
    expect(
      within(line as HTMLElement).getByRole('img', { name: 'Свързан' }),
    ).toBeInTheDocument();

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пилешка супа' }),
    ).toBeInTheDocument();
    expect(saved).toEqual([
      {
        title: 'Пилешка супа',
        servings: 6,
        prepMinutes: 50,
        sourceUrl: 'https://recepti.example/supa',
        appliance: 'air fryer (Cosori CAF-R121-KEU)',
        tags: ['lunch'],
        steps: [{ text: 'Свари пилето.' }],
        preparation: [],
        components: [],
        ingredients: [
          {
            ingredientId: chicken.id,
            quantity: 0.5,
            unit: 'kg',
            component: null,
          },
        ],
      },
    ]);
    expect(
      requests.map((request) => request.headers.get('X-Acting-User')),
    ).toEqual(requests.map(() => RECEPTURKO_ID));
  });

  it('„Нов продукт“ с щанд праща POST /api/ingredients и новият продукт застава в реда', async () => {
    const user = userEvent.setup();
    serveForm();
    const created: unknown[] = [];
    server.use(
      http.post('/api/ingredients', async ({ request }) => {
        created.push(await request.json());
        return HttpResponse.json({ ingredient: mint }, { status: 201 });
      }),
    );

    renderApp('/recipes/new');
    await user.click(
      await screen.findByRole('button', { name: 'Добави продукт' }),
    );
    const sheet = lineSheet();
    await user.type(sheet.getByRole('textbox', { name: 'Продукт' }), 'Джоджен');
    await user.click(await sheet.findByRole('button', { name: 'Нов продукт' }));
    const form = within(sheet.getByRole('group', { name: 'Нов продукт' }));
    expect(form.getByRole('textbox', { name: 'Име' })).toHaveValue('Джоджен');
    await user.click(form.getByRole('button', { name: 'Създай' }));
    // Без щанд не се създава.
    expect(
      form.getByRole('combobox', { name: 'Щанд' }),
    ).toHaveAccessibleDescription('Избери щанд');
    await user.selectOptions(
      form.getByRole('combobox', { name: 'Щанд' }),
      'Плод и зеленчук',
    );
    await user.click(form.getByRole('button', { name: 'Създай' }));

    expect(await sheet.findByRole('textbox', { name: 'Продукт' })).toHaveValue(
      'джоджен',
    );
    expect(
      sheet.queryByRole('group', { name: 'Нов продукт' }),
    ).not.toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Готово' }));
    expect(
      within(ingredientLines()[0] as HTMLElement).getByRole('img', {
        name: 'Свързан',
      }),
    ).toBeInTheDocument();
    // Каноничното име (малки букви) тръгва още от клиента.
    expect(created).toEqual([{ name: 'джоджен', unit: 'g', aisle: 'produce' }]);
  });

  it('409 за нов продукт: продуктът вече съществува и се избира', async () => {
    const user = userEvent.setup();
    serveForm();
    serveIngredientSearch([]);
    server.use(
      http.post('/api/ingredients', () =>
        HttpResponse.json(
          {
            error: 'conflict',
            message: 'Вече има такъв продукт',
            ingredient: chicken,
          },
          { status: 409 },
        ),
      ),
    );

    renderApp('/recipes/new');
    await user.click(
      await screen.findByRole('button', { name: 'Добави продукт' }),
    );
    const sheet = lineSheet();
    await user.type(
      sheet.getByRole('textbox', { name: 'Продукт' }),
      'Пилешко  филе',
    );
    await user.click(await sheet.findByRole('button', { name: 'Нов продукт' }));
    await user.selectOptions(
      sheet.getByRole('combobox', { name: 'Щанд' }),
      'Месо и колбаси',
    );
    await user.click(sheet.getByRole('button', { name: 'Създай' }));

    await vi.waitFor(() =>
      expect(sheet.getByRole('textbox', { name: 'Продукт' })).toHaveValue(
        'пилешко филе',
      ),
    );
    expect(sheet.queryByRole('group', { name: 'Нов продукт' })).toBeNull();
  });

  it('запис с несвързан продукт не минава, а отваря листа на първия такъв продукт', async () => {
    const user = userEvent.setup();
    const saved = serveForm();

    renderApp('/recipes/new');
    await user.type(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
      'Салата',
    );
    await addStep(user, 'Нарежи.');
    for (const name of ['сол', 'магданоз', 'копър']) {
      await user.click(screen.getByRole('button', { name: 'Добави продукт' }));
      await user.type(
        lineSheet().getByRole('textbox', { name: 'Продукт' }),
        name,
      );
      if (name === 'сол') {
        await user.click(
          within(
            await lineSheet().findByRole('list', { name: 'Съвпадения' }),
          ).getByRole('button', { name: 'сол' }),
        );
      }
      await user.click(lineSheet().getByRole('button', { name: 'Готово' }));
    }
    expect(
      screen.getByRole('button', { name: 'Свържи „магданоз“' }),
    ).toBeInTheDocument();

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    const field = lineSheet().getByRole('textbox', { name: 'Продукт' });
    expect(field).toHaveValue('магданоз');
    expect(field).toHaveAccessibleDescription(
      'Избери продукт от списъка или създай нов',
    );
    expect(saved).toEqual([]);
  });

  it('листът „Стъпка“ мести и маха стъпки, а празна стъпка отпада', async () => {
    const user = userEvent.setup();
    const saved = serveForm();

    renderApp('/recipes/new');
    await user.type(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
      'Супа',
    );
    await addStep(user, 'Първа.');
    await addStep(user, 'Втора.');
    await addStep(user, 'Трета.');
    expect(stepLines()).toEqual(['Първа.', 'Втора.', 'Трета.']);

    // Нова стъпка, затворена празна, не остава.
    await user.click(screen.getByRole('button', { name: 'Добави стъпка' }));
    await user.click(stepSheet().getByRole('button', { name: 'Готово' }));
    expect(stepLines()).toEqual(['Първа.', 'Втора.', 'Трета.']);

    await user.click(screen.getByRole('button', { name: 'Трета.' }));
    expect(
      stepSheet().getByRole('button', { name: 'По-надолу' }),
    ).toBeDisabled();
    await user.click(stepSheet().getByRole('button', { name: 'По-нагоре' }));
    // Листът следва стъпката.
    expect(stepSheet().getByRole('textbox', { name: 'Стъпка 2' })).toHaveValue(
      'Трета.',
    );
    await user.click(stepSheet().getByRole('button', { name: 'По-нагоре' }));
    expect(
      stepSheet().getByRole('button', { name: 'По-нагоре' }),
    ).toBeDisabled();
    await user.click(stepSheet().getByRole('button', { name: 'Готово' }));
    expect(stepLines()).toEqual(['Трета.', 'Първа.', 'Втора.']);

    await user.click(screen.getByRole('button', { name: 'Първа.' }));
    await user.click(
      stepSheet().getByRole('button', { name: 'Премахни стъпка' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Изпразнена стъпка също отпада.
    await user.click(screen.getByRole('button', { name: 'Втора.' }));
    await user.clear(stepSheet().getByRole('textbox', { name: 'Стъпка 2' }));
    await user.click(stepSheet().getByRole('button', { name: 'Готово' }));
    expect(stepLines()).toEqual(['Трета.']);

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));
    await screen.findByRole('heading', { level: 1, name: 'Супа' });
    expect(saved.map((body) => body.steps)).toEqual([[{ text: 'Трета.' }]]);
  });

  it('грешките са до полетата и изчезват, когато полето е поправено', async () => {
    const user = userEvent.setup();
    const saved = serveForm();

    renderApp('/recipes/new');
    const servings = await screen.findByRole('textbox', { name: 'Порции' });
    await user.clear(servings);
    await user.type(servings, '0');
    await user.type(
      screen.getByRole('textbox', { name: 'Източник (линк)' }),
      'не е линк',
    );
    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    const title = screen.getByRole('textbox', { name: 'Заглавие' });
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveAccessibleDescription('Въведи заглавие');
    expect(servings).toHaveAccessibleDescription(
      'Порциите са цяло число, поне 1',
    );
    expect(
      screen.getByRole('textbox', { name: 'Източник (линк)' }),
    ).toHaveAccessibleDescription('Невалиден линк');
    expect(screen.getByText('Добави поне една стъпка')).toBeInTheDocument();
    expect(actionBar().getByRole('alert')).toHaveTextContent(
      'Поправи отбелязаните полета.',
    );

    await user.type(title, 'Супа');
    expect(title).not.toHaveAccessibleDescription();
    expect(servings).toHaveAccessibleDescription(
      'Порциите са цяло число, поне 1',
    );
    expect(saved).toEqual([]);
  });

  it('Enter в поле праща формата', async () => {
    const user = userEvent.setup();
    const saved = serveForm();

    renderApp('/recipes/new');
    const title = await screen.findByRole('textbox', { name: 'Заглавие' });
    await addStep(user, 'Свари.');
    await user.type(title, 'Супа{Enter}');

    await screen.findByRole('heading', { level: 1, name: 'Супа' });
    expect(saved).toHaveLength(1);
  });

  it('„Откажи“ излиза към регистъра без запис', async () => {
    const user = userEvent.setup();
    const saved = serveForm();

    renderApp('/recipes/new');
    await user.type(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
      'Супа',
    );
    await user.click(actionBar().getByRole('button', { name: 'Откажи' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Рецепти' }),
    ).toBeInTheDocument();
    expect(saved).toEqual([]);
  });

  it('грешка от сървъра при запис остава на формата', async () => {
    const user = userEvent.setup();
    serveForm();
    server.use(http.post('/api/recipes', () => networkFailure()));

    renderApp('/recipes/new');
    const title = await screen.findByRole('textbox', { name: 'Заглавие' });
    await addStep(user, 'Свари.');
    await user.type(title, 'Супа');
    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    expect(await actionBar().findByRole('alert')).toHaveTextContent(
      'Няма връзка със сървъра',
    );
    expect(screen.getByRole('textbox', { name: 'Заглавие' })).toHaveValue(
      'Супа',
    );
  });

  it('търсенето на продукт чака да се спре с писането', async () => {
    const user = userEvent.setup();
    serveForm();
    const searches: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/api/ingredients') {
        searches.push(url.searchParams.get('q') ?? '');
      }
    });

    renderApp('/recipes/new');
    await user.click(
      await screen.findByRole('button', { name: 'Добави продукт' }),
    );
    await user.type(
      lineSheet().getByRole('textbox', { name: 'Продукт' }),
      'лук',
    );
    await lineSheet().findByRole('list', { name: 'Съвпадения' });

    expect(searches).toEqual(['лук']);
  });
});
