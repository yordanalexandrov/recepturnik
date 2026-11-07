import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { RECEPTURKO_ID } from '../../api/client';
import { apiError, recordRequests, server } from '../../test/msw';
import { chicken, salt } from '../../test/recipe-detail';
import {
  basil,
  chickenWithPesto,
  serveEdit,
  stepPhotoId,
} from '../../test/recipe-edit';
import { renderApp } from '../../test/render';
import {
  cameraPhoto,
  serveStepPhotoUploads,
  stepPhotoIds,
} from '../../test/step-photos';

/** Лентата с основното действие на екрана. */
function actionBar() {
  return within(screen.getByRole('group', { name: 'Действия' }));
}

/** Отваря редакцията на „Пиле с песто“ и чака формата. */
async function openEdit() {
  const rendered = renderApp(`/recipes/${chickenWithPesto.id}/edit`);
  await screen.findByRole('textbox', { name: 'Заглавие' });
  return rendered;
}

/** Листът с това име. */
function sheet(name: string) {
  return within(screen.getByRole('dialog', { name }));
}

/** Текстът на бутоните в списъка с това име, в реда, в който се виждат. */
function lines(name: string) {
  return within(screen.getByRole('list', { name }))
    .queryAllByRole('listitem')
    .map(
      (item) =>
        within(item).getAllByRole('button')[0]?.textContent ?? item.textContent,
    );
}

/** Тялото на `PUT`, което праща непроменената „Пиле с песто“. */
const unchanged = {
  title: 'Пиле с песто',
  servings: 2,
  prepMinutes: 40,
  sourceUrl: 'https://recepti.example/pile-s-pesto',
  appliance: 'sous vide',
  tags: ['dinner'],
  nutritionPer100g: { kcal: 180, proteinG: 20, fatG: 9, carbsG: 2.5 },
  steps: [
    { text: 'Изпечи пилето.', photoId: stepPhotoId },
    { text: 'Залей с песто.' },
  ],
  preparation: [{ kind: 'oven', degrees: 200, fan: 'fan' }],
  components: [{ name: 'Песто', servings: 5 }],
  ingredients: [
    { ingredientId: chicken.id, quantity: 400, unit: 'g', component: null },
    { ingredientId: basil.id, quantity: 50, unit: 'g', component: 0 },
    { ingredientId: salt.id, quantity: null, unit: 'pinch', component: 0 },
  ],
};

describe('Редакция на рецепта', () => {
  it('„Редактирай“ отваря попълнената форма, а запис без промени праща същата рецепта с PUT', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    const requests = recordRequests();

    const { router } = renderApp(`/recipes/${chickenWithPesto.id}`);
    await user.click(await screen.findByRole('link', { name: 'Редактирай' }));

    expect(router.state.location.pathname).toBe(
      `/recipes/${chickenWithPesto.id}/edit`,
    );
    expect(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
    ).toHaveValue('Пиле с песто');

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(
      `/recipes/${chickenWithPesto.id}`,
    );
    expect(saved).toEqual([unchanged]);
    expect(
      requests.map((request) => request.headers.get('X-Acting-User')),
    ).toEqual(requests.map(() => RECEPTURKO_ID));
  });

  it('компонентът е с продуктите си; нов компонент се добавя и ред минава в него', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    await openEdit();

    expect(lines('Продукти')).toEqual(['пилешко филе · 400 г']);
    expect(lines('Песто')).toEqual(['босилек · 50 г', 'сол · по вкус']);

    await user.click(
      screen.getByRole('button', { name: 'Песто · за 5 порции' }),
    );
    const servings = sheet('Компонент').getByRole('textbox', {
      name: 'Порции',
    });
    await user.clear(servings);
    await user.type(servings, '6');
    await user.click(
      sheet('Компонент').getByRole('button', { name: 'Готово' }),
    );

    await user.click(screen.getByRole('button', { name: '+ Компонент' }));
    await user.click(
      sheet('Компонент').getByRole('button', { name: 'Добави' }),
    );
    expect(
      sheet('Компонент').getByRole('textbox', { name: 'Име' }),
    ).toHaveAccessibleDescription('Въведи име, до 40 знака');
    await user.type(
      sheet('Компонент').getByRole('textbox', { name: 'Име' }),
      'Сос',
    );
    await user.type(
      sheet('Компонент').getByRole('textbox', { name: 'Порции' }),
      '4',
    );
    await user.click(
      sheet('Компонент').getByRole('button', { name: 'Добави' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'пилешко филе · 400 г' }),
    );
    await user.selectOptions(
      sheet('Продукт').getByRole('combobox', { name: 'Компонент' }),
      'Сос',
    );
    await user.click(sheet('Продукт').getByRole('button', { name: 'Готово' }));

    expect(lines('Продукти')).toEqual([]);
    expect(lines('Сос')).toEqual(['пилешко филе · 400 г']);

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' });
    expect(saved).toEqual([
      {
        ...unchanged,
        components: [
          { name: 'Песто', servings: 6 },
          { name: 'Сос', servings: 4 },
        ],
        ingredients: [
          { ingredientId: chicken.id, quantity: 400, unit: 'g', component: 1 },
          { ingredientId: basil.id, quantity: 50, unit: 'g', component: 0 },
          {
            ingredientId: salt.id,
            quantity: null,
            unit: 'pinch',
            component: 0,
          },
        ],
      },
    ]);
  });

  it('махнатият компонент връща продуктите си при главните; нов компонент, затворен без „Добави“, отпада', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    await openEdit();

    await user.click(screen.getByRole('button', { name: '+ Компонент' }));
    await user.type(
      sheet('Компонент').getByRole('textbox', { name: 'Име' }),
      'Сос',
    );
    await user.click(
      sheet('Компонент').getByRole('button', { name: 'Затвори' }),
    );
    expect(screen.queryByRole('list', { name: 'Сос' })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Песто · за 5 порции' }),
    );
    await user.click(
      sheet('Компонент').getByRole('button', { name: 'Премахни компонент' }),
    );

    expect(
      screen.queryByRole('list', { name: 'Песто' }),
    ).not.toBeInTheDocument();
    expect(lines('Продукти')).toEqual([
      'пилешко филе · 400 г',
      'босилек · 50 г',
      'сол · по вкус',
    ]);

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' });
    expect(saved).toEqual([
      {
        ...unchanged,
        components: [],
        ingredients: unchanged.ingredients.map((line) => ({
          ...line,
          component: null,
        })),
      },
    ]);
  });

  it('подготовката се поправя и допълва', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    await openEdit();

    await user.click(
      within(screen.getByRole('list', { name: 'Подготовка' })).getByRole(
        'button',
        { name: /200°/ },
      ),
    );
    const degrees = sheet('Подготовка').getByRole('textbox', {
      name: 'Градуси',
    });
    await user.clear(degrees);
    await user.type(degrees, '180');
    await user.click(
      sheet('Подготовка').getByRole('button', { name: 'Готово' }),
    );

    await user.click(screen.getByRole('button', { name: 'Добави подготовка' }));
    expect(
      sheet('Подготовка').getByRole('radio', { name: /Фурна/ }),
    ).toBeDisabled();
    await user.click(
      sheet('Подготовка').getByRole('radio', { name: /Накисни/ }),
    );
    await user.type(
      sheet('Подготовка').getByRole('textbox', { name: 'Какво' }),
      'Накисни ориза',
    );
    await user.selectOptions(
      sheet('Подготовка').getByRole('combobox', { name: 'Колко преди' }),
      '30 мин преди',
    );
    await user.click(
      sheet('Подготовка').getByRole('button', { name: 'Готово' }),
    );

    // Нов елемент, затворен без вид, отпада.
    await user.click(screen.getByRole('button', { name: 'Добави подготовка' }));
    await user.click(
      sheet('Подготовка').getByRole('button', { name: 'Готово' }),
    );

    expect(lines('Подготовка')).toHaveLength(2);

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' });
    expect(saved).toEqual([
      {
        ...unchanged,
        preparation: [
          { kind: 'oven', degrees: 180, fan: 'fan' },
          { kind: 'soak', text: 'Накисни ориза', minutesBefore: 30 },
        ],
      },
    ]);
  });

  it('хранителната стойност се поправя, а изчистена не се праща', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    await openEdit();

    const kcal = screen.getByRole('textbox', { name: 'Енергия (kcal)' });
    await user.clear(kcal);
    await user.type(kcal, '-1');
    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    expect(kcal).toHaveAccessibleDescription('Неотрицателно число');
    expect(saved).toEqual([]);

    await user.clear(kcal);
    for (const name of ['Белтъчини (г)', 'Мазнини (г)', 'Въглехидрати (г)']) {
      await user.clear(screen.getByRole('textbox', { name }));
    }
    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' });
    const { nutritionPer100g: _none, ...withoutNutrition } = unchanged;
    expect(saved).toEqual([withoutNutrition]);
  });

  it('снимка на стъпка се сменя, маха и качва смалена, а стъпката сочи към нея при запис', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    const forms = serveStepPhotoUploads();
    await openEdit();

    await user.click(screen.getByRole('button', { name: /Изпечи пилето\./ }));
    expect(
      sheet('Стъпка').getByRole('img', { name: 'Снимката на стъпка 1' }),
    ).toHaveAttribute(
      'src',
      expect.stringContaining(`/api/step-photos/${stepPhotoId}`),
    );
    const replace = sheet('Стъпка').getByLabelText('Смени');
    // На телефон изборът дава и камерата, и галерията.
    expect(replace).toHaveAttribute('accept', 'image/*');
    await user.upload(replace, cameraPhoto());
    await waitFor(() =>
      expect(
        sheet('Стъпка').getByRole('img', { name: 'Снимката на стъпка 1' }),
      ).toHaveAttribute(
        'src',
        expect.stringContaining(`/api/step-photos/${stepPhotoIds[0]}`),
      ),
    );
    await user.click(sheet('Стъпка').getByRole('button', { name: 'Готово' }));

    await user.click(screen.getByRole('button', { name: 'Залей с песто.' }));
    await user.upload(
      sheet('Стъпка').getByLabelText('Снимка'),
      cameraPhoto('IMG_0002.jpg'),
    );
    await sheet('Стъпка').findByRole('button', { name: 'Махни' });
    await user.click(sheet('Стъпка').getByRole('button', { name: 'Махни' }));
    expect(
      sheet('Стъпка').queryByRole('img', { name: 'Снимката на стъпка 2' }),
    ).not.toBeInTheDocument();
    await user.upload(
      sheet('Стъпка').getByLabelText('Снимка'),
      cameraPhoto('IMG_0003.jpg'),
    );
    await sheet('Стъпка').findByRole('img', { name: 'Снимката на стъпка 2' });
    await user.click(sheet('Стъпка').getByRole('button', { name: 'Готово' }));

    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' });
    expect(saved).toEqual([
      {
        ...unchanged,
        steps: [
          { text: 'Изпечи пилето.', photoId: stepPhotoIds[0] },
          { text: 'Залей с песто.', photoId: stepPhotoIds[2] },
        ],
      },
    ]);
    // Смалената снимка (малкият JPEG от canvas-а), не оригиналът от камерата.
    const resized = {
      field: 'photo',
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 'small jpeg'.length,
    };
    expect(forms).toEqual(
      [1, 2, 3].map(() => ({
        path: '/api/step-photos',
        contentType: null,
        files: [resized],
      })),
    );
  });

  it('отказ при качване на снимка остава в листа, а стъпката пази старата снимка', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    serveStepPhotoUploads();
    server.use(
      http.post('/api/step-photos', () =>
        apiError(413, 'photo_too_large', 'Снимката е твърде голяма'),
      ),
    );
    await openEdit();

    await user.click(screen.getByRole('button', { name: /Изпечи пилето\./ }));
    await user.upload(sheet('Стъпка').getByLabelText('Смени'), cameraPhoto());

    expect(
      await sheet('Стъпка').findByText('Снимката е твърде голяма'),
    ).toBeInTheDocument();
    await user.click(sheet('Стъпка').getByRole('button', { name: 'Готово' }));
    await user.click(actionBar().getByRole('button', { name: 'Запази' }));

    await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' });
    expect(saved).toEqual([unchanged]);
  });

  it('„Откажи“ се връща към прегледа без запис', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    const { router } = await openEdit();

    await user.clear(screen.getByRole('textbox', { name: 'Заглавие' }));
    await user.click(actionBar().getByRole('button', { name: 'Откажи' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пиле с песто' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(
      `/recipes/${chickenWithPesto.id}`,
    );
    expect(saved).toEqual([]);
  });
});
