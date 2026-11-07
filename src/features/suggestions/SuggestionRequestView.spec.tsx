import { suggestionRequestDetailSchema } from '@family/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw';
import { renderApp } from '../../test/render';
import {
  approvedRecipeId,
  doneRequest,
  failedRequest,
  pendingRequest,
  requestId,
  serveDecisions,
  serveDetail,
  serveRequestSuggestions,
  skewersSuggestion,
  suggestions,
} from '../../test/suggestions';

const retriedId = 'cccccccc-0000-4000-8000-000000000002';

afterEach(() => {
  vi.useRealTimers();
});

describe('Изгледът на заявка за предложения', () => {
  it('докато е pending пита на 3 s; при done показва картите с причината, времето и продуктите', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = serveDetail(
      { request: pendingRequest, suggestions: [] },
      { request: doneRequest, suggestions },
    );

    renderApp(`/recipes/suggest/${requestId}`);

    expect(
      await screen.findByText('Търся рецепти… обикновено отнема до минута'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Търсено: вечеря · нещо с пиле'),
    ).toBeInTheDocument();
    expect(calls()).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(3000));

    const card = await screen.findByRole('article', {
      name: 'Пилешки шишчета',
    });
    expect(calls()).toBe(2);
    expect(card).toHaveTextContent('Бързо е и децата го обичат.');
    expect(card).toHaveTextContent('25 мин');
    const products = within(card).getByRole('list', { name: 'Продукти' });
    expect(
      within(products)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['пилешко филе 0,6 кг', 'сумак 1 ч.л. нов', 'сол по вкус']);
    expect(within(card).getByRole('link', { name: 'Приеми' })).toHaveAttribute(
      'href',
      `/recipes/suggest/${requestId}/${skewersSuggestion.id}`,
    );

    const approved = screen.getByRole('article', { name: 'Омлет с билки' });
    expect(approved).toHaveTextContent('Прието');
    expect(
      within(approved).getByRole('link', { name: 'Към рецептата' }),
    ).toHaveAttribute('href', `/recipes/${approvedRecipeId}`);

    // След done вече не пита.
    await act(() => vi.advanceTimersByTimeAsync(9000));
    expect(calls()).toBe(2);
  });

  it('„Отхвърли“ отбелязва предложението, а „Върни“ го връща', async () => {
    const user = userEvent.setup();
    const { decisions } = serveDecisions({
      request: doneRequest,
      suggestions: [skewersSuggestion],
    });

    renderApp(`/recipes/suggest/${requestId}`);

    const card = await screen.findByRole('article', {
      name: 'Пилешки шишчета',
    });
    await user.click(within(card).getByRole('button', { name: 'Отхвърли' }));

    const restore = await within(card).findByRole('button', { name: 'Върни' });
    expect(card).toHaveTextContent('Отхвърлено');
    expect(
      within(card).queryByRole('link', { name: 'Приеми' }),
    ).not.toBeInTheDocument();

    await user.click(restore);

    expect(
      await within(card).findByRole('link', { name: 'Приеми' }),
    ).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Отхвърлено');
    expect(decisions).toEqual([
      `reject ${skewersSuggestion.id}`,
      `restore ${skewersSuggestion.id}`,
    ]);
  });

  it('неуспешна заявка казва защо и „Опитай пак“ пуска нова със същия вход', async () => {
    const user = userEvent.setup();
    serveDetail({ request: failedRequest('no_results'), suggestions: [] });
    const sent = serveRequestSuggestions(retriedId);
    server.use(
      http.get(`/api/recipe-suggestions/requests/${retriedId}`, () =>
        HttpResponse.json(
          suggestionRequestDetailSchema.parse({
            request: { ...pendingRequest, id: retriedId },
            suggestions: [],
          }),
        ),
      ),
    );

    renderApp(`/recipes/suggest/${requestId}`);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не намерих подходящи рецепти.',
    );
    await user.click(screen.getByRole('button', { name: 'Опитай пак' }));

    expect(
      await screen.findByText('Търся рецепти… обикновено отнема до минута'),
    ).toBeInTheDocument();
    expect(sent).toEqual([
      {
        slots: ['dinner'],
        times: ['15-30'],
        tags: ['quick'],
        hint: 'нещо с пиле',
      },
    ]);
  });
});
