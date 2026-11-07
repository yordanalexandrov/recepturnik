import { useCallback, useSyncExternalStore } from 'react';

/** Широк екран (desktop): от 48rem нагоре — единствената граница в `global.css`. */
export const WIDE_SCREEN = '(min-width: 48rem)';

/**
 * Дали медия-заявката важи сега; следи промяната (напр. завъртане на телефона). Без `matchMedia` (jsdom) връща
 * `fallback`.
 */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof matchMedia !== 'function') {
        return () => {};
      }
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () =>
    typeof matchMedia === 'function' ? matchMedia(query).matches : fallback,
  );
}

/** Дали екранът е широк (desktop); без `matchMedia` — тесен. */
export function useWideScreen(): boolean {
  return useMediaQuery(WIDE_SCREEN, false);
}
