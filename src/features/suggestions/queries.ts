import {
  type AnyRecipeSuggestion,
  type ApproveSuggestionInput,
  approvedSuggestionResponseSchema,
  type RecipeSuggestParams,
  recipeSuggestionResponseSchema,
  type SuggestionRequest,
  type SuggestionRequestDetail,
  suggestionRequestDetailSchema,
  suggestionRequestResponseSchema,
  suggestionRequestsResponseSchema,
} from '@family/shared';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch, JSON_HEADERS } from '../../api/client';
import { pollWhilePending } from '../ai/ai-requests';
import { importKeys } from '../recipe-import/queries';
import { storeRecipe } from '../recipes/queries';

const RECENT_LIMIT = 10;

export const suggestionKeys = {
  all: ['recipe-suggestions'] as const,
  recent: ['recipe-suggestions', 'recent'] as const,
  request: (id: string) => ['recipe-suggestions', 'request', id] as const,
};

/** Входът на заявката, за „Опитай пак“ със същите параметри. */
export function paramsOf(request: SuggestionRequest): RecipeSuggestParams {
  return {
    slots: request.slots,
    ...(request.times.length > 0 ? { times: request.times } : {}),
    ...(request.tags.length > 0 ? { tags: request.tags } : {}),
    ...(request.hint === undefined ? {} : { hint: request.hint }),
  };
}

/** Последните заявки, най-новите първи. */
export function useRecentRequests() {
  return useQuery({
    queryKey: suggestionKeys.recent,
    queryFn: () =>
      apiFetch(
        `/recipe-suggestions/requests?limit=${RECENT_LIMIT}`,
        suggestionRequestsResponseSchema,
      ).then((body) => body.requests),
  });
}

/** Нова заявка → `202` с `pending`; работата тече във фона на api-то. 503 — AI не е на разположение. */
export function useRequestSuggestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: RecipeSuggestParams) =>
      apiFetch(
        '/recipe-suggestions/requests',
        suggestionRequestResponseSchema,
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(params),
        },
      ).then((body) => body.request),
    onSuccess(request) {
      queryClient.setQueryData<SuggestionRequestDetail>(
        suggestionKeys.request(request.id),
        { request, suggestions: [] },
      );
      void queryClient.invalidateQueries({ queryKey: suggestionKeys.recent });
    },
  });
}

/** Заявката, от която е предложението, се чете наново: заявка за предложения или внасяне. */
function invalidateRequestOf(
  queryClient: QueryClient,
  suggestion: AnyRecipeSuggestion,
): void {
  void queryClient.invalidateQueries({
    queryKey:
      suggestion.origin === 'suggest'
        ? suggestionKeys.request(suggestion.requestId)
        : importKeys.all,
  });
}

/** Приемане с прегледания `RecipeInput` → нова рецепта в регистъра; предложението е `approved`. */
export function useApproveSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: ApproveSuggestionInput;
    }) =>
      apiFetch(
        `/recipe-suggestions/${id}/approve`,
        approvedSuggestionResponseSchema,
        {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(input),
        },
      ),
    onSuccess({ recipe, suggestion }) {
      storeRecipe(queryClient, recipe);
      invalidateRequestOf(queryClient, suggestion);
    },
  });
}

/** Отхвърляне (`reject`) или връщане на отхвърлено (`restore`); после заявката се чете наново. */
function useDecision(action: 'reject' | 'restore') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(
        `/recipe-suggestions/${id}/${action}`,
        recipeSuggestionResponseSchema,
        { method: 'POST' },
      ).then((body) => body.suggestion),
    onSuccess(suggestion) {
      invalidateRequestOf(queryClient, suggestion);
    },
  });
}

export function useRejectSuggestion() {
  return useDecision('reject');
}

/** „Върни“ след „Отхвърли“: предложението е пак `proposed`. */
export function useRestoreSuggestion() {
  return useDecision('restore');
}

/** Заявката и предложенията ѝ; пита отново, докато е `pending`. */
export function useSuggestionRequest(id: string) {
  return useQuery({
    queryKey: suggestionKeys.request(id),
    queryFn: () =>
      apiFetch(
        `/recipe-suggestions/requests/${id}`,
        suggestionRequestDetailSchema,
      ),
    refetchInterval: pollWhilePending((detail) => detail.request.status),
  });
}
