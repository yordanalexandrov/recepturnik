import { recipesResponseSchema } from '@family/shared';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import {
  accessRedirect,
  apiError,
  networkFailure,
  recordRequests,
  server,
} from '../test/msw';
import { ApiError, apiFetch, failureKind, refusalOf } from './client';

/** Грешката, с която пада `apiFetch` срещу `GET /api/recipes`. */
async function failureOf(response: () => Response) {
  server.use(http.get('/api/recipes', response));
  return apiFetch('/recipes', recipesResponseSchema).catch(
    (error: unknown) => error,
  );
}

describe('apiFetch', () => {
  it('праща X-Acting-User на Рецептурко и при заявка с тяло', async () => {
    const requests = recordRequests();
    server.use(
      http.post('/api/recipes', () => HttpResponse.json({ recipes: [] })),
    );

    await apiFetch('/recipes', recipesResponseSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(requests[0]?.headers.get('x-acting-user')).toBe(
      '33333333-3333-4333-8333-333333333333',
    );
    expect(requests[0]?.headers.get('content-type')).toBe('application/json');
  });

  it('връща тялото, проверено със schema-та', async () => {
    await expect(apiFetch('/recipes', recipesResponseSchema)).resolves.toEqual({
      recipes: [],
    });
  });

  it('2xx извън договора е грешка `invalid_response`, не данни', async () => {
    const error = await failureOf(() =>
      HttpResponse.json({ recipes: [{ title: 'без id' }] }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'invalid_response' });
  });
});

describe('failureKind', () => {
  it('липса на връзка е `network`', async () => {
    expect(failureKind(await failureOf(networkFailure))).toBe('network');
  });

  it('пренасочване от Access, 401 и 403 са изтекла сесия', async () => {
    expect(failureKind(await failureOf(accessRedirect))).toBe(
      'session_expired',
    );
    expect(
      failureKind(
        await failureOf(() =>
          apiError(401, 'invalid_access_token', 'Невалиден token'),
        ),
      ),
    ).toBe('session_expired');
    expect(
      failureKind(
        await failureOf(() => apiError(403, 'forbidden', 'Забранено')),
      ),
    ).toBe('session_expired');
  });

  it('4xx е `client` с кода и съобщението на api-то', async () => {
    const error = await failureOf(() =>
      apiError(404, 'not_found', 'Няма такава рецепта'),
    );

    expect(failureKind(error)).toBe('client');
    expect(error).toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'Няма такава рецепта',
    });
  });

  it('503 `openclaw_unavailable` е `ai_unavailable`', async () => {
    const error = await failureOf(() =>
      apiError(503, 'openclaw_unavailable', 'OpenClaw не отговаря'),
    );

    expect(failureKind(error)).toBe('ai_unavailable');
  });

  it('друг 5xx, и без тяло по договора, е `server`', async () => {
    const error = await failureOf(
      () => new HttpResponse('Bad Gateway', { status: 502 }),
    );

    expect(failureKind(error)).toBe('server');
    expect(error).toMatchObject({ status: 502, code: 'http_error' });
  });

  it('отказ с под-код се чете с `refusalOf`', async () => {
    const error = await failureOf(() =>
      HttpResponse.json(
        {
          error: 'conflict',
          code: 'revision_open',
          message: 'Има отворена поправка',
          revisionId: 'cccccccc-0000-4000-8000-000000000001',
        },
        { status: 409 },
      ),
    );

    expect(refusalOf(error, 'revision_open')).toMatchObject({
      revisionId: 'cccccccc-0000-4000-8000-000000000001',
    });
    expect(refusalOf(error, 'revision_stale')).toBeNull();
  });
});
