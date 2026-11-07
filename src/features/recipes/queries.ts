import {
  type PrepTimeRange,
  putRatingSchema,
  type Rating,
  type Recipe,
  type RecipeSummary,
  type RecipesSort,
  recipeResponseSchema,
  recipesResponseSchema,
  type Tag,
} from '@family/shared';
import {
  keepPreviousData,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch, JSON_HEADERS } from '../../api/client';

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

/** Новата рецепта от сървъра в кеша; списъците се презареждат, защото тя може да влезе или да излезе от тях. */
export function storeRecipe(queryClient: QueryClient, recipe: Recipe): void {
  queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
  void queryClient.invalidateQueries({ queryKey: recipeKeys.lists });
}

/** `archived: true` архивира, `false` връща рецептата в регистъра. */
export function useArchiveRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      apiFetch(
        `/recipes/${id}/${archived ? 'archive' : 'unarchive'}`,
        recipeResponseSchema,
        { method: 'POST' },
      ).then((body) => body.recipe),
    onSuccess(recipe) {
      storeRecipe(queryClient, recipe);
    },
  });
}

export interface RatingChange {
  id: string;
  /** `null` маха оценката. */
  rating: Rating | null;
}

/**
 * Оценка на рецепта (GLOSSARY: Оценка): `PUT` поставя, `DELETE` маха. Оптимистично в рецептата и в списъците; при
 * грешка се връща, а накрая списъците се презареждат. Копие от family без менюто.
 */
export function useRateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating }: RatingChange) =>
      apiFetch(
        `/recipes/${id}/rating`,
        recipeResponseSchema,
        rating === null
          ? { method: 'DELETE' }
          : {
              method: 'PUT',
              headers: JSON_HEADERS,
              body: JSON.stringify(putRatingSchema.parse({ rating })),
            },
      ).then((body) => body.recipe),
    async onMutate({ id, rating }) {
      await queryClient.cancelQueries({ queryKey: recipeKeys.all });
      const previous = queryClient.getQueriesData({
        queryKey: recipeKeys.all,
      });
      queryClient.setQueryData<Recipe>(recipeKeys.detail(id), (recipe) =>
        recipe ? { ...recipe, rating } : recipe,
      );
      queryClient.setQueriesData<RecipeSummary[]>(
        { queryKey: recipeKeys.lists },
        (list) =>
          list?.map((recipe) =>
            recipe.id === id ? { ...recipe, rating } : recipe,
          ),
      );
      return { previous };
    },
    onError(_error, _change, context) {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess(recipe) {
      queryClient.setQueryData(recipeKeys.detail(recipe.id), recipe);
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.lists });
    },
  });
}
