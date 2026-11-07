/* Единственото място, което пише в конзолата (Biome `noConsole` навсякъде другаде). */

const PREFIX = '[recepturnik]';

export const logger = {
  debug(...args: unknown[]): void {
    if (import.meta.env.DEV) {
      console.debug(PREFIX, ...args);
    }
  },
  info(...args: unknown[]): void {
    console.info(PREFIX, ...args);
  },
  warn(...args: unknown[]): void {
    console.warn(PREFIX, ...args);
  },
  error(...args: unknown[]): void {
    console.error(PREFIX, ...args);
  },
};
