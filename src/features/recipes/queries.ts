import {
  type PrepTimeRange,
  type RecipesSort,
  recipeResponseSchema,
  recipesResponseSchema,
  type Tag,
} from '@family/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';

/** Параметрите на `GET /api/recipes` (`recipesQuerySchema`); празните не влизат в query-то. */
export interface RecipesParams {
  q?: string;
  tags?: readonly Tag[];
  times?: readonly PrepTimeRange[];
  includeArchived?: boolean;
  /** Без него — по заглавие. */
  sort?: RecipesSort;
}

export const recipeKeys = {
  all: ['recipes'] as const,
  lists: ['recipes', 'list'] as const,
  /** По query низа: еднаквите филтри (празни или пропуснати) дават едно query. */
  list: (search: string) => ['recipes', 'list', search] as const,
  detail: (id: string) => ['recipes', 'detail', id] as const,
};

export function recipesSearch(params: RecipesParams): string {
  const search = new URLSearchParams();
  const q = params.q?.trim();
  if (q) {
    search.set('q', q);
  }
  for (const tag of params.tags ?? []) {
    search.append('tag', tag);
  }
  for (const time of params.times ?? []) {
    search.append('time', time);
  }
  if (params.includeArchived) {
    search.set('includeArchived', 'true');
  }
  if (params.sort && params.sort !== 'title') {
    search.set('sort', params.sort);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function useRecipes(params: RecipesParams) {
  const search = recipesSearch(params);
  return useQuery({
    queryKey: recipeKeys.list(search),
    queryFn: () =>
      apiFetch(`/recipes${search}`, recipesResponseSchema).then(
        (body) => body.recipes,
      ),
    // Докато се пише в търсенето, старият списък остава на екрана.
    placeholderData: keepPreviousData,
  });
}

/** Рецептата за преглед: `GET /api/recipes/:id` (404 `not_found` за непозната). */
export function useRecipe(id: string) {
  return useQuery({
    queryKey: recipeKeys.detail(id),
    queryFn: () =>
      apiFetch(`/recipes/${id}`, recipeResponseSchema).then(
        (body) => body.recipe,
      ),
  });
}
