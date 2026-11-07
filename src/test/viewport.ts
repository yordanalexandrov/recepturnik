import { vi } from 'vitest';
import { WIDE_SCREEN } from '../lib/use-media-query';

/**
 * Имитира ширината на прозореца за `matchMedia` (jsdom я няма): `wide` е desktop, `narrow` — телефон.
 * Без извикване екранът е тесен. `setup.ts` маха имитацията след всеки тест.
 */
export function setViewport(viewport: 'wide' | 'narrow') {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === WIDE_SCREEN && viewport === 'wide',
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}
