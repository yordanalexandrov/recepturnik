import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECEPTURKO_ID } from '../../api/client';
import { apiError, recordRequests, server } from '../../test/msw';
import {
  chickenWithPesto,
  serveEdit,
  stepPhotoId,
} from '../../test/recipe-edit';
import {
  pendingRefinement,
  refinement,
  serveRefinement,
} from '../../test/refinements';
import { renderApp } from '../../test/render';

afterEach(() => {
  vi.useRealTimers();
});

/** Отваря прегледа на „Пиле с песто“ и натиска „Подобри рецептата“; връща листа. */
async function openRefine(user = userEvent.setup()) {
  const rendered = renderApp(`/recipes/${chickenWithPesto.id}`);
  await user.click(
    await screen.findByRole('button', { name: 'Подобри рецептата' }),
  );
  const sheet = await screen.findByRole('dialog', {
    name: 'Подобри рецептата',
  });
  return { ...rendered, sheet: within(sheet) };
}

/** Текстът на стъпките в списъка с това име. */
function stepTexts(name: string) {
  return within(screen.getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent);
}

describe('„Подобри рецептата“', () => {
  it('чака подобрението, показва го до сегашната рецепта, а „Приеми“ го слага във формата и „Запази“ го записва', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const saved = serveEdit();
    const calls = serveRefinement(undefined, 1);
    const { sheet, router } = await openRefine(user);

    expect(await sheet.findByText('Мисля…')).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await sheet.findByText(refinement.changes)).toBeInTheDocument();
    expect(calls.posts).toBe(1);

    expect(stepTexts('Сега')).toEqual(['Изпечи пилето.', 'Залей с песто.']);
    expect(stepTexts('Предложение')).toEqual(
      refinement.steps.map((step) => step.text),
    );

    await user.click(sheet.getByRole('button', { name: 'Приеми' }));
    await screen.findByRole('heading', { name: 'Редакция' });
    expect(
      screen.getByText('Подобрението е във формата. Прегледай го и запиши.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Време (мин)' })).toHaveValue(
      '45',
    );

    await user.click(screen.getByRole('button', { name: 'Запази' }));
    await screen.findByRole('heading', { name: 'Пиле с песто', level: 1 });
    expect(router.state.location.pathname).toBe(
      `/recipes/${chickenWithPesto.id}`,
    );
    expect(saved).toEqual([
      expect.objectContaining({
        title: 'Пиле с песто',
        prepMinutes: 45,
        steps: [
          { text: 'Овкуси пилето със сол и го остави 10 минути.' },
          {
            text: 'Изпечи пилето 25 минути на 200 °C, докато стане златисто.',
            photoId: stepPhotoId,
          },
          { text: 'Залей с песто точно преди сервиране.' },
        ],
        preparation: [
          {
            kind: 'fridge',
            text: 'извади пилето от хладилника',
            minutesBefore: 30,
          },
        ],
      }),
    ]);
  });

  it('при 503 казва, че AI не е на разположение, и „Опитай пак“ пуска заявката наново', async () => {
    serveEdit();
    const calls = serveRefinement();
    let refused = false;
    server.use(
      http.post(
        `/api/recipes/${chickenWithPesto.id}/refinements`,
        () => {
          refused = true;
          return apiError(
            503,
            'openclaw_unavailable',
            'OpenClaw gateway is not configured',
          );
        },
        { once: true },
      ),
    );
    const user = userEvent.setup();
    const { sheet } = await openRefine(user);

    expect(await sheet.findByRole('alert')).toHaveTextContent(
      'AI не е на разположение в момента. Опитай по-късно.',
    );
    expect(refused).toBe(true);
    expect(sheet.queryByRole('button', { name: 'Приеми' })).toBeNull();

    await user.click(sheet.getByRole('button', { name: 'Опитай пак' }));
    expect(await sheet.findByText(refinement.changes)).toBeInTheDocument();
    expect(calls.posts).toBe(1);
  });

  it('неуспешното подобрение казва какво не е станало, а „Опитай пак“ пуска ново', async () => {
    serveEdit();
    const calls = serveRefinement({ status: 'failed', error: 'timeout' });
    const user = userEvent.setup();
    const { sheet } = await openRefine(user);

    expect(await sheet.findByRole('alert')).toHaveTextContent(
      'AI не отговори за 40 секунди. Опитай пак.',
    );
    await user.click(sheet.getByRole('button', { name: 'Опитай пак' }));
    await vi.waitFor(() => expect(calls.posts).toBe(2));
  });

  it('когато няма какво да се подобри, казва причината на AI', async () => {
    serveEdit();
    serveRefinement({
      status: 'failed',
      error: 'no_results',
      noResults: 'Стъпките са достатъчно ясни.',
    });
    const { sheet } = await openRefine();

    expect(
      await sheet.findByText(
        'Рецептата вече е наред. Стъпките са достатъчно ясни.',
      ),
    ).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Опитай пак' })).toBeNull();
  });

  it('редакция с подобрение, което не е готово, казва, че то не е налично, и показва рецептата', async () => {
    serveEdit();
    serveRefinement({ status: 'failed', error: 'timeout' });
    renderApp(
      `/recipes/${chickenWithPesto.id}/edit?refine=${pendingRefinement.id}`,
    );

    expect(
      await screen.findByText(
        'Подобрението не е налично: формата е с рецептата, както е записана.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Време (мин)' })).toHaveValue(
      '40',
    );
  });

  it('„Откажи“ не променя рецептата, а затворен докато чака листът продължава същата заявка', async () => {
    const saved = serveEdit();
    const calls = serveRefinement(undefined, 1);
    const user = userEvent.setup();
    const { sheet, router } = await openRefine(user);

    expect(await sheet.findByText('Мисля…')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Затвори' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Подобри рецептата' }));
    const reopened = within(
      await screen.findByRole('dialog', { name: 'Подобри рецептата' }),
    );
    expect(await reopened.findByText(refinement.changes)).toBeInTheDocument();
    expect(calls.posts).toBe(1);

    await user.click(reopened.getByRole('button', { name: 'Откажи' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe(
      `/recipes/${chickenWithPesto.id}`,
    );
    expect(saved).toEqual([]);
  });

  it('сравнява и подготовката: махнатата е „Без подготовка“', async () => {
    serveEdit();
    serveRefinement({
      status: 'done',
      refinement: { ...refinement, preparation: [] },
    });
    const { sheet } = await openRefine();

    await sheet.findByText(refinement.changes);
    const now = within(sheet.getByRole('region', { name: 'Сега' }));
    expect(
      now.getByRole('list', { name: 'Подготовка Сега' }),
    ).toHaveTextContent('200°');
    const proposal = within(sheet.getByRole('region', { name: 'Предложение' }));
    expect(proposal.getByText('Без подготовка')).toBeInTheDocument();
    expect(
      sheet.getByRole('list', { name: 'Компонентите остават' }),
    ).toHaveTextContent('Песто · за 5 порции');
  });

  it('заявката за подобряване е от името на Рецептурко', async () => {
    serveEdit();
    serveRefinement();
    const requests = recordRequests();
    const { sheet } = await openRefine();
    await sheet.findByText(refinement.changes);

    const refineRequests = requests.filter((request) =>
      new URL(request.url).pathname.includes('refinements'),
    );
    expect(refineRequests.map((r) => new URL(r.url).pathname)).toEqual([
      `/api/recipes/${chickenWithPesto.id}/refinements`,
      `/api/recipes/refinements/${pendingRefinement.id}`,
    ]);
    for (const request of refineRequests) {
      expect(request.headers.get('x-acting-user')).toBe(RECEPTURKO_ID);
    }
  });
});
