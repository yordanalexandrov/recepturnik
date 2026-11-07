import { createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { App } from '../app/App';
import { createQueryClient } from '../app/query-client';
import { createAppRouter } from '../app/router';

/**
 * Рендерира цялото приложение (истинският router и query client) на адрес `path`, върху history в памет.
 * Без повторни опити на заявките, за да се вижда грешката веднага. API-то се имитира с msw (`./msw`).
 */
export function renderApp(path = '/') {
  const queryClient = createQueryClient({ retry: false });
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );
  return {
    router,
    queryClient,
    ...render(<App router={router} queryClient={queryClient} />),
  };
}
