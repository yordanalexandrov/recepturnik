import {
  screen,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  accessRedirect,
  networkFailure,
  recordRequests,
  server,
} from '../../test/msw';
import { chickenWithRice, omelette, serveRecipes } from '../../test/recipes';
import { renderApp } from '../../test/render';

describe('Регистър рецепти', () => {
  it('началният адрес води към регистъра с карта за всяка рецепта', async () => {
    serveRecipes([chickenWithRice, omelette]);
    const { router } = renderApp('/');

    const card = await screen.findByRole('link', { name: /Пиле с ориз/ });
    expect(router.state.location.pathname).toBe('/recipes');
    expect(card).toHaveAttribute('href', `/recipes/${chickenWithRice.id}`);
    expect(within(card).getByText('45 мин')).toBeInTheDocument();
    expect(
      within(card).getByRole('img', { name: 'Оценка 4 от 5' }),
    ).toBeInTheDocument();
    expect(
      within(card).getByText('обяд · подходящо за дете'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Омлет/ })).toBeInTheDocument();
  });

  it('всяка заявка е от името на Рецептурко', async () => {
    const user = userEvent.setup();
    const requests = recordRequests();
    serveRecipes([chickenWithRice, omelette]);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Омлет/ });
    await user.type(screen.getByRole('searchbox', { name: 'Търси' }), 'пиле');
    await waitForElementToBeRemoved(() =>
      screen.queryByRole('link', { name: /Омлет/ }),
    );

    // Списъкът, целият регистър (за брояча) и търсенето.
    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.headers.get('x-acting-user')).toBe(
        '33333333-3333-4333-8333-333333333333',
      );
    }
  });

  it('„Търси“ стеснява по заглавие, след като човекът спре да пише', async () => {
    const user = userEvent.setup();
    const searches = serveRecipes([chickenWithRice, omelette]);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Пиле с ориз/ });

    await user.type(screen.getByRole('searchbox', { name: 'Търси' }), 'омл');

    await waitForElementToBeRemoved(() =>
      screen.queryByRole('link', { name: /Пиле с ориз/ }),
    );
    expect(screen.getByRole('link', { name: /Омлет/ })).toBeInTheDocument();
    // Без заявка за всяка буква: само пълният низ стига до api-то.
    expect(
      searches.map((search) => search.get('q')).filter((q) => q !== null),
    ).toEqual(['омл']);
  });

  it('празният регистър казва това и предлага „Нова рецепта“', async () => {
    serveRecipes([]);
    renderApp('/recipes');

    expect(await screen.findByText('Още няма рецепти.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Нова рецепта' })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
  });

  it('търсене без резултат казва това и предлага „Нова рецепта“', async () => {
    const user = userEvent.setup();
    serveRecipes([chickenWithRice]);
    renderApp('/recipes');
    await screen.findByRole('link', { name: /Пиле с ориз/ });

    await user.type(screen.getByRole('searchbox', { name: 'Търси' }), 'торта');

    expect(
      await screen.findByText('Няма рецепти за „торта“.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Нова рецепта' })).toHaveAttribute(
      'href',
      '/recipes/new',
    );
  });
});

describe('Регистър рецепти при грешка', () => {
  it('без връзка със сървъра казва това вместо празен списък, а „Опитай пак“ го зарежда', async () => {
    const user = userEvent.setup();
    serveRecipes([chickenWithRice]);
    server.use(http.get('/api/recipes', networkFailure, { once: true }));
    renderApp('/recipes');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Няма връзка със сървъра');
    expect(screen.queryByText('Още няма рецепти.')).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Опитай пак' }));

    expect(
      await screen.findByRole('link', { name: /Пиле с ориз/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('изтеклата сесия на Access казва това и води към входа', async () => {
    server.use(http.get('/api/recipes', accessRedirect));
    renderApp('/recipes');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Сесията е изтекла');
    // Пълно зареждане на страницата: Cloudflare Access показва входа с имейл PIN.
    expect(
      within(alert).getByRole('link', { name: 'Влез отново' }),
    ).toHaveAttribute('href', '/recipes');
  });
});
