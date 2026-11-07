import type { ApiErrorCode, RefusalCode } from '@family/shared';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Тяло по `apiErrorSchema`, както го връща error handler-ът на api-то на family; с `code` — отказ с под-код
 * (`refusalSchemas`).
 */
export function apiError(
  status: number,
  error: ApiErrorCode,
  message: string,
  code?: RefusalCode,
) {
  return HttpResponse.json({ error, code, message }, { status });
}

/** Какво връща Cloudflare Access при изтекла сесия: пренасочване към входа си на друг origin. */
export function accessRedirect() {
  return new HttpResponse(null, {
    status: 302,
    headers: {
      Location: 'https://yo-po.cloudflareaccess.com/cdn-cgi/access/login',
    },
  });
}

/** fetch пада без отговор, както без връзка със сървъра. */
export function networkFailure() {
  return HttpResponse.error();
}

/**
 * Handler-ите по подразбиране: празен регистър. Всеки spec подменя каквото му трябва с `server.use(...)` или с
 * помощниците от фикстурите (напр. `serveRecipes` в `./recipes`).
 */
export const handlers = [
  http.get('/api/recipes', () => HttpResponse.json({ recipes: [] })),
];

export const server = setupServer(...handlers);

/**
 * Записва всяка заявка, която минава през msw (с headers), за проверки като „всяка заявка носи X-Acting-User“.
 * Викай я в началото на теста; списъкът се пълни, докато тестът върви.
 */
export function recordRequests(): Request[] {
  const requests: Request[] = [];
  server.events.on('request:start', ({ request }) => {
    requests.push(request.clone());
  });
  return requests;
}
