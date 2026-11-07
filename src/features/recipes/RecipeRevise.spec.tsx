import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECEPTURKO_ID } from '../../api/client';
import { recordRequests, server } from '../../test/msw';
import { chicken } from '../../test/recipe-detail';
import {
  chickenWithPesto,
  serveEdit,
  stepPhotoId,
} from '../../test/recipe-edit';
import { renderApp } from '../../test/render';
import {
  INSTRUCTION,
  pendingRevision,
  refuseStaleSave,
  revision,
  serveRevision,
} from '../../test/revisions';

afterEach(() => {
  vi.useRealTimers();
});

type User = ReturnType<typeof userEvent.setup>;

/** Отваря „Пиле с песто“ и натиска „Поправи с AI“; връща листа. */
async function openRevise(
  user: User,
  path = `/recipes/${chickenWithPesto.id}`,
) {
  const rendered = renderApp(path);
  await user.click(await screen.findByRole('link', { name: 'Поправи с AI' }));
  const sheet = await screen.findByRole('dialog', { name: 'Поправи с AI' });
  return { ...rendered, sheet: within(sheet) };
}

/** Пише указанието и го праща. */
async function send(user: User, sheet: ReturnType<typeof within>) {
  await user.type(sheet.getByLabelText('Какво да се промени?'), INSTRUCTION);
  await user.click(sheet.getByRole('button', { name: 'Изпрати' }));
}

function listTexts(name: string) {
  return within(screen.getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

describe('„Поправи с AI“ на рецепта', () => {
  it('праща указанието, чака, сравнява със сегашната рецепта, а „Приеми“ минава през формата и записва с поправката', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const saved = serveEdit();
    const calls = serveRevision(undefined, 1);
    const { sheet, router } = await openRevise(user);

    await send(user, sheet);
    expect(await sheet.findByText('Мисля…')).toBeInTheDocument();
    expect(calls.posts).toEqual([{ instruction: INSTRUCTION, applied: [] }]);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await sheet.findByText(revision.changes)).toBeInTheDocument();
    expect(sheet.getByText(`Ти написа: ${INSTRUCTION}`)).toBeInTheDocument();

    expect(listTexts('Продукти: сега')).toEqual(['пилешко филе · 400 г']);
    expect(listTexts('Продукти: с поправката')).toEqual([
      'пилешко филе · 500 г',
      'черен пипер · по вкус (нов продукт)',
    ]);
    expect(listTexts('Песто: с поправката')).toEqual([
      'босилек · 50 г',
      'сол · по вкус',
    ]);
    expect(listTexts('Стъпки: сега')[0]).toBe('Изпечи пилето.');
    expect(listTexts('Стъпки: с поправката')[0]).toBe(
      'Изпечи пилето 35 минути с черен пипер.',
    );

    await user.click(sheet.getByRole('button', { name: 'Приеми' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Редакция' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Поправката е във формата. Прегледай я и запиши.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Време (мин)' })).toHaveValue(
      '50',
    );

    // Черният пипер е нов продукт: свързва се, преди да се запише.
    expect(saved).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Запази' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Поправи отбелязаните полета.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Свържи „черен пипер“' }),
    );
    const line = within(await screen.findByRole('dialog'));
    await user.click(line.getByRole('button', { name: 'Премахни ред' }));

    await user.click(screen.getByRole('button', { name: 'Запази' }));
    await screen.findByRole('heading', { name: 'Пиле с песто', level: 1 });
    expect(router.state.location.pathname).toBe(
      `/recipes/${chickenWithPesto.id}`,
    );
    expect(saved).toEqual([
      expect.objectContaining({
        revisionId: pendingRevision.id,
        prepMinutes: 50,
        steps: [
          {
            text: 'Изпечи пилето 35 минути с черен пипер.',
            photoId: stepPhotoId,
          },
          { text: 'Залей с песто.' },
        ],
        ingredients: expect.arrayContaining([
          expect.objectContaining({ ingredientId: chicken.id, quantity: 500 }),
        ]),
      }),
    ]);
  });

  it('„Отхвърли“ отхвърля поправката и затваря листа, без запис', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    const calls = serveRevision();
    const { sheet } = await openRevise(user);

    await send(user, sheet);
    await sheet.findByText(revision.changes);
    await user.click(sheet.getByRole('button', { name: 'Отхвърли' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.rejected).toEqual([pendingRevision.id]);
    expect(saved).toEqual([]);
  });

  it('рецепта с отворена поправка има значка, която води до чакащата поправка', async () => {
    const user = userEvent.setup();
    serveEdit({
      ...chickenWithPesto,
      openRevision: { id: pendingRevision.id, status: 'done' },
    });
    const calls = serveRevision();
    renderApp(`/recipes/${chickenWithPesto.id}`);

    await user.click(
      await screen.findByRole('link', { name: 'Поправка чака преглед' }),
    );
    const sheet = within(
      await screen.findByRole('dialog', { name: 'Поправи с AI' }),
    );
    expect(await sheet.findByText(revision.changes)).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Приеми' })).toBeInTheDocument();
    expect(calls.posts).toEqual([]);
  });

  it('при `revision_open` не пуска втора поправка, а води до чакащата', async () => {
    const user = userEvent.setup();
    serveEdit();
    const calls = serveRevision();
    server.use(
      http.post(
        `/api/recipes/${chickenWithPesto.id}/revisions`,
        () =>
          HttpResponse.json(
            {
              error: 'conflict',
              code: 'revision_open',
              message: 'The recipe has an open revision',
              revisionId: pendingRevision.id,
            },
            { status: 409 },
          ),
        { once: true },
      ),
    );
    const { sheet } = await openRevise(user);

    await send(user, sheet);
    expect(await sheet.findByText('Поправка чака преглед')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Отвори поправката' }));
    expect(await sheet.findByText(revision.changes)).toBeInTheDocument();
    expect(calls.posts).toEqual([]);
  });

  it('остаряла поправка няма „Приеми“, а „Пусни пак“ отхвърля старата и пуска същото указание', async () => {
    const user = userEvent.setup();
    serveEdit({
      ...chickenWithPesto,
      openRevision: { id: pendingRevision.id, status: 'done' },
    });
    const calls = serveRevision({ status: 'done', revision, stale: true });
    renderApp(`/recipes/${chickenWithPesto.id}/edit?revise=true`);
    const sheet = within(
      await screen.findByRole('dialog', { name: 'Поправи с AI' }),
    );

    expect(
      await sheet.findByText(
        'Рецептата е записана след поправката: тя вече не може да се приеме.',
      ),
    ).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Приеми' })).toBeNull();

    await user.click(sheet.getByRole('button', { name: 'Пусни пак' }));
    expect(await sheet.findByRole('button', { name: 'Приеми' })).toBeEnabled();
    expect(calls.rejected).toEqual([pendingRevision.id]);
    expect(calls.posts).toEqual([{ instruction: INSTRUCTION, applied: [] }]);
  });

  it('`revision_stale` при запис не записва и отваря листа с опреснената поправка', async () => {
    const user = userEvent.setup();
    const saved = serveEdit();
    serveRevision();
    const { sheet } = await openRevise(user);
    await send(user, sheet);
    await sheet.findByText(revision.changes);
    await user.click(sheet.getByRole('button', { name: 'Приеми' }));
    await user.click(
      screen.getByRole('button', { name: 'Свържи „черен пипер“' }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Премахни ред',
      }),
    );

    // Междувременно рецептата е записана другаде: поправката вече е остаряла.
    refuseStaleSave();
    serveRevision({ status: 'done', revision, stale: true });
    await user.click(screen.getByRole('button', { name: 'Запази' }));

    const reopened = within(
      await screen.findByRole('dialog', { name: 'Поправи с AI' }),
    );
    expect(
      await reopened.findByRole('button', { name: 'Пусни пак' }),
    ).toBeInTheDocument();
    expect(reopened.queryByRole('button', { name: 'Приеми' })).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Редакция' }),
    ).toBeInTheDocument();
    expect(saved).toEqual([]);
  });

  it('`no_applied_change` пита пак без непознатите id, докато опитите свършат', async () => {
    const user = userEvent.setup();
    const known = 'ffffffff-0000-4000-8000-000000000002';
    const unknown = 'ffffffff-0000-4000-8000-000000000001';
    serveEdit({
      ...chickenWithPesto,
      openRevision: { id: pendingRevision.id, status: 'done' },
    });
    // Поправка, пусната от family с приложени промени от готвенето, и неуспешна.
    serveRevision({
      status: 'failed',
      error: 'timeout',
      applied: [unknown, known],
    });
    const posts: unknown[] = [];
    server.use(
      http.post(
        `/api/recipes/${chickenWithPesto.id}/revisions`,
        async ({ request }) => {
          const body = (await request.json()) as { applied: string[] };
          posts.push(body);
          return body.applied.includes(unknown)
            ? HttpResponse.json(
                {
                  error: 'not_found',
                  code: 'no_applied_change',
                  message: 'Unknown applied changes',
                  ids: [unknown],
                },
                { status: 404 },
              )
            : HttpResponse.json({ request: pendingRevision }, { status: 202 });
        },
      ),
    );
    renderApp(`/recipes/${chickenWithPesto.id}/edit?revise=true`);
    const sheet = within(
      await screen.findByRole('dialog', { name: 'Поправи с AI' }),
    );

    await user.click(await sheet.findByRole('button', { name: 'Опитай пак' }));
    await vi.waitFor(() =>
      expect(posts).toEqual([
        { instruction: INSTRUCTION, applied: [unknown, known] },
        { instruction: INSTRUCTION, applied: [known] },
      ]),
    );
  });

  it('заявките на поправката са от името на Рецептурко', async () => {
    const user = userEvent.setup();
    serveEdit();
    serveRevision();
    const requests = recordRequests();
    const { sheet } = await openRevise(user);
    await send(user, sheet);
    await sheet.findByText(revision.changes);

    const revisionRequests = requests.filter((request) =>
      new URL(request.url).pathname.includes('revisions'),
    );
    expect(revisionRequests.length).toBeGreaterThanOrEqual(2);
    for (const request of revisionRequests) {
      expect(request.headers.get('x-acting-user')).toBe(RECEPTURKO_ID);
    }
  });
});
