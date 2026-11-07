import { recipeSuggestionResponseSchema } from '@family/shared';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECEPTURKO_ID } from '../../api/client';
import {
  doneDetail,
  doneImport,
  importedSuggestion,
  importId,
  importText,
  importUrl,
  pendingDetail,
  pendingImport,
  serveImport,
  serveRecentImports,
  sumac,
} from '../../test/imports';
import { apiError, recordRequests, server } from '../../test/msw';
import { chicken, salt } from '../../test/recipe-detail';
import { omelette } from '../../test/recipes';
import { renderApp } from '../../test/render';

afterEach(() => {
  vi.useRealTimers();
});

/** Редовете в списъка „Продукти“, като текст, в реда, в който се виждат. */
function ingredientLines() {
  return within(screen.getByRole('list', { name: 'Продукти' }))
    .getAllByRole('listitem')
    .map((line) => line.textContent);
}

/** Листът за един ред продукт. */
function lineSheet() {
  return within(screen.getByRole('dialog', { name: 'Продукт' }));
}

describe('Внасяне на рецепта', () => {
  it('текст → изчакване → черновата във формата → нов продукт → Запази одобрява и отваря рецептата', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    const api = serveImport(pendingDetail, doneDetail);
    const requests = recordRequests();

    renderApp('/recipes/import');

    expect(
      await screen.findByRole('heading', { name: 'Внеси рецепта' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Текст' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await user.click(
      screen.getByRole('textbox', { name: 'Текст на рецептата' }),
    );
    await user.paste(importText);
    await user.type(
      screen.getByRole('textbox', {
        name: 'Линк към източника (по желание)',
      }),
      importUrl,
    );
    await user.click(screen.getByRole('button', { name: 'Внеси' }));

    expect(
      await screen.findByText('Чета рецептата… обикновено отнема до минута'),
    ).toBeInTheDocument();
    expect(api.posted).toEqual([
      { kind: 'text', text: importText, url: importUrl },
    ]);

    await act(() => vi.advanceTimersByTimeAsync(3000));

    // Черновата е във формата: продуктите от регистъра са свързани, новият чака отгоре.
    expect(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
    ).toHaveValue('Пилешко филе със сумак');
    expect(
      screen.getByText('Порциите не са дадени: по количествата са 4.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Източник (линк)' }),
    ).toHaveValue(importUrl);
    expect(ingredientLines()).toEqual([
      'сумак · 1 ч.л.Свържи',
      'пилешко филе · 600 г✓',
      'сол · по вкус✓',
    ]);

    await user.click(screen.getByRole('button', { name: 'Свържи „сумак“' }));
    const sheet = lineSheet();
    await user.click(await sheet.findByRole('button', { name: 'Нов продукт' }));
    await user.click(sheet.getByRole('button', { name: 'Създай' }));
    expect(await sheet.findByRole('textbox', { name: 'Продукт' })).toHaveValue(
      'сумак',
    );
    await user.click(sheet.getByRole('button', { name: 'Готово' }));
    await user.click(screen.getByRole('button', { name: 'Запази' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Пилешко филе със сумак',
      }),
    ).toBeInTheDocument();
    expect(api.created).toEqual([
      { name: 'сумак', unit: 'g', aisle: 'spices' },
    ]);
    expect(api.approved).toEqual([
      {
        title: 'Пилешко филе със сумак',
        servings: 4,
        prepMinutes: 40,
        tags: ['dinner'],
        steps: [
          { text: 'Овкусете пилето.' },
          { text: 'Изпечете го 30 минути.' },
        ],
        appliance: null,
        sourceUrl: importUrl,
        preparation: [],
        components: [],
        ingredients: [
          {
            ingredientId: chicken.id,
            quantity: 600,
            unit: 'g',
            note: 'пилешки гърди',
            component: null,
          },
          {
            ingredientId: sumac.id,
            quantity: 1,
            unit: 'tsp',
            note: 'смлян',
            component: null,
          },
          {
            ingredientId: salt.id,
            quantity: null,
            unit: 'pinch',
            component: null,
          },
        ],
      },
    ]);
    expect(
      requests.every((r) => r.headers.get('x-acting-user') === RECEPTURKO_ID),
    ).toBe(true);
  });

  it('един нов продукт на два реда: създаден от единия, свързва и другия', async () => {
    const user = userEvent.setup();
    const sumacLine = importedSuggestion.payload.ingredients[1];
    if (!sumacLine) {
      throw new Error('fixture without the сумак line');
    }
    const api = serveImport({
      ...doneDetail,
      suggestion: {
        ...importedSuggestion,
        payload: {
          ...importedSuggestion.payload,
          ingredients: [
            ...importedSuggestion.payload.ingredients,
            {
              ...sumacLine,
              newProduct: { name: 'Сумак', unit: 'g', aisle: 'spices' },
              quantity: 2,
              note: 'за поръсване',
            },
          ],
        },
      },
    });

    renderApp(`/recipes/import/${importId}`);
    const [first, second] = await screen.findAllByRole('button', {
      name: /^Свържи „сумак“$/i,
    });
    if (!first || !second) {
      throw new Error('expected two сумак lines');
    }
    await user.click(first);
    const sheet = lineSheet();
    await user.click(await sheet.findByRole('button', { name: 'Нов продукт' }));
    await user.click(sheet.getByRole('button', { name: 'Създай' }));
    expect(await sheet.findByRole('textbox', { name: 'Продукт' })).toHaveValue(
      'сумак',
    );
    await user.click(sheet.getByRole('button', { name: 'Готово' }));

    // И двата реда са свързани, без да се отваря вторият.
    expect(
      screen.queryByRole('button', { name: /^Свържи/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Запази' }));

    await screen.findByRole('heading', {
      level: 1,
      name: 'Пилешко филе със сумак',
    });
    expect(api.created).toHaveLength(1);
    expect(
      api.approved[0]?.ingredients.filter(
        (line) => line.ingredientId === sumac.id,
      ),
    ).toHaveLength(2);
  });

  it('503 при „Внеси“ казва, че AI не е на разположение', async () => {
    const user = userEvent.setup();
    serveImport();
    server.use(
      http.post('/api/recipe-imports', () =>
        apiError(503, 'openclaw_unavailable', 'OpenClaw is not configured'),
      ),
    );

    renderApp('/recipes/import');
    await user.click(
      await screen.findByRole('textbox', { name: 'Текст на рецептата' }),
    );
    await user.paste(importText);
    await user.click(screen.getByRole('button', { name: 'Внеси' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AI не е на разположение в момента',
    );
  });

  it('„Последни внасяния“ показва заглавие, статус и води до внасянето', async () => {
    const user = userEvent.setup();
    serveImport(doneDetail);
    serveRecentImports([
      doneImport,
      {
        ...pendingImport,
        id: 'eeeeeeee-0000-4000-8000-000000000002',
        url: undefined,
        firstLine: 'Баница с тиква',
      },
      {
        ...pendingImport,
        id: 'eeeeeeee-0000-4000-8000-000000000003',
        source: 'url',
        url: 'https://www.recepti.example/banica',
        status: 'failed',
        error: 'fetch_failed',
      },
    ]);

    renderApp('/recipes/import');

    const recent = within(
      await screen.findByRole('region', { name: 'Последни внасяния' }),
    );
    const links = await recent.findAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringMatching(/^Пилешко филе със сумакготова/),
      expect.stringMatching(/^Баница с тиквачака/),
      expect.stringMatching(/^recepti\.exampleнеуспешна/),
    ]);
    await user.click(recent.getByRole('link', { name: /Пилешко филе/ }));
    expect(
      await screen.findByRole('textbox', { name: 'Заглавие' }),
    ).toHaveValue('Пилешко филе със сумак');
  });

  it('неуспешно внасяне: съобщение по кода, „Опитай пак“ внася същия текст наново', async () => {
    const user = userEvent.setup();
    const api = serveImport({
      ...doneDetail,
      request: {
        ...pendingImport,
        status: 'failed',
        error: 'no_results',
        noResults: 'в текста няма продукти',
      },
      suggestion: undefined,
    });

    renderApp(`/recipes/import/${importId}`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не намерих рецепта: в текста няма продукти',
    );
    await user.click(screen.getByRole('button', { name: 'Опитай пак' }));
    await waitFor(() =>
      expect(api.posted).toEqual([
        { kind: 'text', text: importText, url: importUrl },
      ]),
    );
  });

  it('„Отхвърли“ отхвърля черновата; „Върни“ я връща', async () => {
    const user = userEvent.setup();
    const rejectedDetail = {
      ...doneDetail,
      suggestion: { ...importedSuggestion, status: 'rejected' as const },
    };
    const api = serveImport(doneDetail, rejectedDetail);
    let restored = 0;
    server.use(
      http.post(
        `/api/recipe-suggestions/${importedSuggestion.id}/restore`,
        () => {
          restored += 1;
          return HttpResponse.json(
            recipeSuggestionResponseSchema.parse({
              suggestion: importedSuggestion,
            }),
          );
        },
      ),
    );

    renderApp(`/recipes/import/${importId}`);
    await user.click(await screen.findByRole('button', { name: 'Отхвърли' }));

    expect(
      await screen.findByText('Черновата е отхвърлена.'),
    ).toBeInTheDocument();
    expect(api.rejected).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Върни' }));
    await waitFor(() => expect(restored).toBe(1));
  });

  it('„Линк“ праща линка; линк, който вече е рецепта, дава „Отвори“ и „Внеси пак“ с force', async () => {
    const user = userEvent.setup();
    const api = serveImport(pendingDetail);
    let conflicts = 1;
    server.use(
      http.post('/api/recipe-imports', async ({ request }) => {
        const body = await request.json();
        api.posted.push(body);
        if (conflicts > 0) {
          conflicts -= 1;
          return HttpResponse.json(
            {
              error: 'already_imported',
              message: 'Вече е в регистъра',
              recipe: { id: omelette.id, title: omelette.title },
            },
            { status: 409 },
          );
        }
        return HttpResponse.json({ request: pendingImport }, { status: 202 });
      }),
    );

    renderApp('/recipes/import');
    await user.click(await screen.findByRole('tab', { name: 'Линк' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Линк към рецептата' }),
      importUrl,
    );
    await user.click(screen.getByRole('button', { name: 'Внеси' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Вече е в регистъра',
    );
    expect(screen.getByRole('link', { name: 'Отвори' })).toHaveAttribute(
      'href',
      `/recipes/${omelette.id}`,
    );
    await user.click(screen.getByRole('button', { name: 'Внеси пак' }));

    expect(
      await screen.findByText('Чета рецептата… обикновено отнема до минута'),
    ).toBeInTheDocument();
    expect(api.posted).toEqual([
      { kind: 'url', url: importUrl },
      { kind: 'url', url: importUrl, force: true },
    ]);
  });
});
