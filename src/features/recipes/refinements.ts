import {
  type Recipe,
  type RecipeRefinement,
  type RecipeRefineRequest,
  recipeRefineResponseSchema,
} from '@family/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { POLL_INTERVAL_MS } from '../ai/ai-requests';
import { preparationToValues } from '../preparation/preparation-values';
import {
  type RecipeFormValues,
  recipeToFormValues,
} from './recipe-form-values';

// „Подобри рецептата“ (GLOSSARY на family: Подобряване на рецепта), по `features/recipes/refinements.ts` на family.

/** Не е под `recipeKeys.all`: записът на рецептата не бива да пита отново за свършено подобрение. */
const refinementKey = (id: string) => ['recipe-refinements', id] as const;

/** Пуска подобряване на рецептата → `202` с `pending`; агентът работи във фона на api-то. */
export function useRequestRefinement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipeId: string) =>
      apiFetch(`/recipes/${recipeId}/refinements`, recipeRefineResponseSchema, {
        method: 'POST',
      }).then((body) => body.request),
    onSuccess(request) {
      // Веднага пита отново: заявката може вече да е свършила.
      void queryClient.invalidateQueries({
        queryKey: refinementKey(request.id),
      });
    },
  });
}

/** Подобряването с `id`; пита отново на 3 s, докато е `pending`. Без `id` не пита. */
export function useRefinement(id: string | undefined) {
  return useQuery({
    queryKey: refinementKey(id ?? ''),
    queryFn: (): Promise<RecipeRefineRequest> =>
      apiFetch(`/recipes/refinements/${id}`, recipeRefineResponseSchema).then(
        (body) => body.request,
      ),
    enabled: id !== undefined,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? POLL_INTERVAL_MS : false,
  });
}

/**
 * Формата на рецептата с приетото подобрение: стъпките са неговите, подготовката — цялата негова (подобрение отпреди
 * подготовката я оставя), времето — неговото, ако го има. Останалото (продукти, компоненти, порции) е на рецептата.
 */
export function refinedFormValues(
  recipe: Recipe,
  refinement: RecipeRefinement,
): RecipeFormValues {
  const values = recipeToFormValues(recipe);
  return {
    ...values,
    steps: refinement.steps.map((step) => ({ ...step })),
    ...(refinement.preparation === undefined
      ? {}
      : { preparation: preparationToValues(refinement.preparation) }),
    ...(refinement.prepMinutes === undefined
      ? {}
      : { prepMinutes: String(refinement.prepMinutes) }),
  };
}
