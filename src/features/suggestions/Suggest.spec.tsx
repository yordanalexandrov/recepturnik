import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { RECEPTURKO_ID } from '../../api/client';
import { apiError, recordRequests, server } from '../../test/msw';
import { serveAppliances } from '../../test/recipe-form';
import { renderApp } from '../../test/render';
import {
  doneRequest,
  pendingRequest,
  requestId,
  serveDetail,
  serveRecentRequests,
  serveRequestSuggestions,
} from '../../test/suggestions';

describe('Поискай предложения', () => {
  it('хранене, време и тагове → POST на заявката и изгледът ѝ', async () => {
    const user = userEvent.setup();
    serveAppliances();
    serveRecentRequests();
    const sent = serveRequestSuggestions();
    serveDetail({ request: pendingRequest, suggestions: [] });
    const requests = recordRequests();

    renderApp('/recipes/suggest');

    const submit = await screen.findByRole('button', {
      name: 'Поискай предложения',
    });
    expect(submit).toBeDisabled();

    const meal = within(screen.getByRole('group', { name: 'Хранене' }));
    await user.click(meal.getByRole('button', { name: 'вечеря' }));
    await user.click(meal.getByRole('button', { name: 'обяд' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Време' })).getByRole('button', {
        name: '15–30 мин',
      }),
    );
    await user.click(
      within(screen.getByRole('group', { name: 'Тагове' })).getByRole(
        'button',
        { name: 'бързо' },
      ),
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Подсказка' }),
      '  нещо с пиле ',
    );
    await user.click(submit);

    expect(
      await screen.findByText('Търся рецепти… обикновено отнема до минута'),
    ).toBeInTheDocument();
    expect(sent).toEqual([
      {
        slots: ['dinner', 'lunch'],
        times: ['15-30'],
        tags: ['quick'],
        hint: 'нещо с пиле',
      },
    ]);
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.headers.get('x-acting-user')).toBe(RECEPTURKO_ID);
    }
  });

  it('503 показва „AI не е на разположение в момента“ и остава на формата', async () => {
    const user = userEvent.setup();
    serveAppliances();
    serveRecentRequests();
    server.use(
      http.post('/api/recipe-suggestions/requests', () =>
        apiError(503, 'openclaw_unavailable', 'OpenClaw is unavailable'),
      ),
    );

    renderApp('/recipes/suggest');

    await user.click(
      within(await screen.findByRole('group', { name: 'Хранене' })).getByRole(
        'button',
        { name: 'закуска' },
      ),
    );
    await user.click(
      screen.getByRole('button', { name: 'Поискай предложения' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'AI не е на разположение в момента',
    );
    expect(
      screen.getByRole('button', { name: 'Поискай предложения' }),
    ).toBeEnabled();
  });

  it('последните заявки водят към изгледа си', async () => {
    serveAppliances();
    serveRecentRequests([doneRequest]);

    renderApp('/recipes/suggest');

    const recent = await screen.findByRole('region', {
      name: 'Последни заявки',
    });
    const link = await within(recent).findByRole('link', {
      name: /вечеря · нещо с пиле/,
    });
    expect(link).toHaveTextContent('готова');
    expect(link).toHaveAttribute('href', `/recipes/suggest/${requestId}`);
  });
});
