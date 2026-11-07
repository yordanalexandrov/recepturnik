import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw';

// Под натоварване (няколко worktree-а пускат тестове едновременно) 1 s по подразбиране за findBy/waitFor не стига.
configure({ asyncUtilTimeout: 3000 });

// jsdom не превърта: router-ът вика scrollTo при смяна на екрана, а формите — scrollIntoView.
Element.prototype.scrollIntoView ??= () => {};
window.scrollTo = () => {};

// Заявка без handler е грешка в теста, не тиха мрежова грешка.
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

afterAll(() => server.close());
