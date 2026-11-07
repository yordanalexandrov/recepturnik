import {
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, JSON_HEADERS } from '../../api/client';
import { storeRecipe } from '../recipes/queries';

const RECENT_LIMIT = 10;

/** Колко често се пита за заявка, която още е `pending`. */
export const POLL_INTERVAL_MS = 3000;

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
      if (suggestion.origin === 'suggest') {
        void queryClient.invalidateQueries({
          queryKey: suggestionKeys.request(suggestion.requestId),
        });
      }
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
      if (suggestion.origin === 'suggest') {
        void queryClient.invalidateQueries({
          queryKey: suggestionKeys.request(suggestion.requestId),
        });
      }
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

/** Заявката и предложенията ѝ; пита отново на `POLL_INTERVAL_MS`, докато е `pending`. */
export function useSuggestionRequest(id: string) {
  return useQuery({
    queryKey: suggestionKeys.request(id),
    queryFn: () =>
      apiFetch(
        `/recipe-suggestions/requests/${id}`,
        suggestionRequestDetailSchema,
      ),
    refetchInterval: (query) =>
      query.state.data?.request.status === 'pending' ? POLL_INTERVAL_MS : false,
  });
}
