import {
  type PrepTimeRange,
  type RecipesSort,
  recipeFiltersSchema,
  type Tag,
} from '@family/shared';
import { useCallback, useState } from 'react';
import { logger } from '../../logger';

/** Избраните филтри и подреждането на регистъра. */
export interface RecipeFilters {
  tags: Tag[];
  times: PrepTimeRange[];
  includeArchived: boolean;
  sort: RecipesSort;
}

export const NO_FILTERS: RecipeFilters = {
  tags: [],
  times: [],
  includeArchived: false,
  sort: 'title',
};

/** Колко филтъра са избрани (тагове, интервали, архивираните); подреждането не е филтър. */
export function countFilters(filters: RecipeFilters): number {
  return (
    filters.tags.length +
    filters.times.length +
    (filters.includeArchived ? 1 : 0)
  );
}

/** Дали има какво да махне „Изчисти“: филтър или подредба, различна от тази по подразбиране. */
export function hasFilters(filters: RecipeFilters): boolean {
  return countFilters(filters) > 0 || filters.sort !== NO_FILTERS.sort;
}

/** Ключът в sessionStorage; нарочно различен от този на family (`family.recipeFilters`). */
const STORED_FILTERS_KEY = 'recepturnik.recipeFilters';

/** Записаните филтри през `recipeFiltersSchema`: непознатите стойности (стар запис, ръчна намеса) отпадат. */
function parse(raw: string | null): RecipeFilters {
  if (raw === null) {
    return NO_FILTERS;
  }
  try {
    return recipeFiltersSchema.safeParse(JSON.parse(raw)).data ?? NO_FILTERS;
  } catch {
    return NO_FILTERS;
  }
}

function read(): RecipeFilters {
  try {
    return parse(sessionStorage.getItem(STORED_FILTERS_KEY));
  } catch (error) {
    logger.warn('sessionStorage недостъпен', error);
    return NO_FILTERS;
  }
}

/**
 * Филтрите на регистъра за сесията на раздела (sessionStorage): остават след отваряне на рецепта и връщане, но не и
 * след затваряне на раздела.
 */
export function useStoredRecipeFilters() {
  const [filters, setFilters] = useState(read);
  const set = useCallback((next: RecipeFilters) => {
    setFilters(next);
    try {
      sessionStorage.setItem(STORED_FILTERS_KEY, JSON.stringify(next));
    } catch (error) {
      logger.warn('sessionStorage недостъпен', error);
    }
  }, []);
  return [filters, set] as const;
}
