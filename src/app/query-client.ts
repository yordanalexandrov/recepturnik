import { QueryCache, QueryClient } from '@tanstack/react-query';
import { isRetryable } from '../api/client';
import { logger } from '../logger';

type Retry = boolean | ((failureCount: number, error: Error) => boolean);

/** Един опит повече само при мрежова или сървърна грешка; 4xx и изтекла сесия не се повтарят. */
function defaultRetry(failureCount: number, error: Error): boolean {
  return isRetryable(error) && failureCount < 1;
}

/** Query client-ът на приложението; тестовете подават `retry: false`. */
export function createQueryClient({
  retry = defaultRetry,
}: {
  retry?: Retry;
} = {}) {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error, query) {
        logger.warn('Заявката не успя', query.queryKey, error);
      },
    }),
    defaultOptions: {
      queries: { retry },
    },
  });
}
