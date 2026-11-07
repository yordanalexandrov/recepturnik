import {
  type Preparation,
  type RecipeComponent,
  type RecipeRevision,
  type RecipeRevisionRequest,
  type RecipeStep,
  type RevisableRecipe,
  type RevisionLine,
  recipeRevisionResponseSchema,
} from '@family/shared';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { apiFetch, JSON_HEADERS, refusalOf } from '../../api/client';
import { POLL_INTERVAL_MS } from '../ai/ai-requests';
import { preparationToValues } from '../preparation/preparation-values';
import { recipeKeys } from './queries';
import {
  type ComponentValues,
  componentsToValues,
  emptyIngredientRow,
  type IngredientRowValues,
  lineComponent,
  type RecipeFormValues,
} from './recipe-form-values';

// „Поправи с AI“ (GLOSSARY на family: Поправка на рецепта), по `features/recipes/revisions.ts` на family.

/** Не е под `recipeKeys.all`: презареждането на рецептите не пита отново за поправките. */
const revisionKey = (id: string) => ['recipe-revisions', id] as const;

/** Какво поправя „Поправи с AI“: записана рецепта, или предложение с рецептата от формата за преглед (незаписана). */
export type RevisionTarget =
  | { recipeId: string }
  | { suggestionId: string; recipe: RevisableRecipe };

/** Ред в сравнението: продукт от регистъра или нов (несвързан), по име, и индексът на компонента му (`null` = главен). */
export interface ComparedLine {
  ingredient?: { name: string } | undefined;
  newProduct?: { name: string } | undefined;
  quantity: RevisionLine['quantity'];
  unit: RevisionLine['unit'];
  note?: string | undefined;
  component: number | null;
}

/** Рецептата, която AI поправя, както я показва колоната „Сега“ в сравнението. */
export interface RevisionBase {
  servings: number;
  prepMinutes?: number | undefined;
  ingredients: readonly ComparedLine[];
  steps: readonly RecipeStep[];
  preparation: Preparation;
  components: readonly RecipeComponent[];
}

/** Рецептата от формата за преглед като колоната „Сега“; `linked` казва кои редове са свързани (`toRevisableRecipe`). */
export function revisionBaseOf(
  recipe: RevisableRecipe,
  linked: readonly boolean[],
): RevisionBase {
  return {
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes ?? undefined,
    ingredients: recipe.ingredients.map(({ name, ...line }, index) => ({
      ...line,
      ...(linked[index] ? { ingredient: { name } } : { newProduct: { name } }),
    })),
    steps: recipe.steps,
    preparation: recipe.preparation,
    components: recipe.components,
  };
}

/** „Поправка чака преглед“ на рецептата се сменя: рецептите се презареждат. */
function refreshOpenRevision(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: recipeKeys.all });
}

/**
 * Какво пуска поправка: указанието и, за рецепта, `applied`. Рецептурникът няма Готвене и праща `[]`, освен при „Опитай
 * пак“ / „Пусни пак“ на поправка, пусната от family с приложени промени.
 */
interface RevisionAsk {
  target: RevisionTarget;
  instruction: string;
  applied?: readonly string[];
}

function postRevision({ target, instruction, applied = [] }: RevisionAsk) {
  return apiFetch(
    'suggestionId' in target
      ? `/recipe-suggestions/${target.suggestionId}/revisions`
      : `/recipes/${target.recipeId}/revisions`,
    recipeRevisionResponseSchema,
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(
        'suggestionId' in target
          ? { instruction, recipe: target.recipe }
          : { instruction, applied },
      ),
    },
  ).then((body) => body.request);
}

/**
 * Пуска; ако api-то не знае някой от `applied` (`404 no_applied_change`), пуска още веднъж без тях: всеки опит праща
 * по-малко, затова опитите свършват.
 */
async function postKnown(ask: RevisionAsk): Promise<RecipeRevisionRequest> {
  try {
    return await postRevision(ask);
  } catch (error) {
    const unknown = refusalOf(error, 'no_applied_change')?.ids;
    const known = ask.applied?.filter((id) => !unknown?.includes(id)) ?? [];
    if (unknown && known.length < (ask.applied?.length ?? 0)) {
      return postKnown({ ...ask, applied: known });
    }
    throw error;
  }
}

/** „Изпрати“ → `202` с `pending`; агентът работи във фона на api-то. */
export function useRequestRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postKnown,
    onSuccess(request) {
      // Веднага пита отново: заявката може вече да е свършила.
      void queryClient.invalidateQueries({ queryKey: revisionKey(request.id) });
      refreshOpenRevision(queryClient);
    },
  });
}

/** Поправката с `id`; пита отново на 3 s, докато е `pending`. Без `id` не пита. */
export function useRevision(id: string | undefined) {
  return useQuery({
    queryKey: revisionKey(id ?? ''),
    queryFn: (): Promise<RecipeRevisionRequest> =>
      apiFetch(`/recipes/revisions/${id}`, recipeRevisionResponseSchema).then(
        (body) => body.request,
      ),
    enabled: id !== undefined,
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? POLL_INTERVAL_MS : false,
  });
}

/** Поправката с `id` се чете пак, напр. щом записът с нея върне `409 revision_stale`: листът вижда `stale`. */
export function useRefreshRevision() {
  const queryClient = useQueryClient();
  return (id: string) =>
    void queryClient.invalidateQueries({ queryKey: revisionKey(id) });
}

/** „Отхвърли“: поправката е решена и не чака повече. */
export function useRejectRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(
        `/recipes/revisions/${id}/reject`,
        recipeRevisionResponseSchema,
        { method: 'POST' },
      ).then((body) => body.request),
    onSuccess(request) {
      queryClient.setQueryData(revisionKey(request.id), request);
      refreshOpenRevision(queryClient);
    },
  });
}

/**
 * Продуктите на поправката като редове на формата: свързаните с продукта си, а предложеният нов продукт неразрешен, с
 * името си и попълнена форма „Нов продукт“, както при внасяне; всеки в компонента си от `components`.
 */
function revisionToIngredientRows(
  lines: readonly RevisionLine[],
  components: readonly ComponentValues[],
): IngredientRowValues[] {
  return lines.map((line) =>
    emptyIngredientRow({
      ...lineComponent(components, line.component),
      ingredient: line.ingredient ?? null,
      query: line.ingredient?.name ?? line.newProduct?.name ?? '',
      quantity: line.quantity === null ? '' : String(line.quantity),
      unit: line.unit,
      ...(line.note === undefined ? {} : { note: line.note }),
      ...(line.newProduct ? { isNew: true, newProduct: line.newProduct } : {}),
    }),
  );
}

/** Полетата на формата, които поправката не пипа. */
const KEPT_FIELDS = [
  'title',
  'sourceUrl',
  'tags',
  'appliance',
  'nutrition',
] as const satisfies readonly (keyof RecipeFormValues)[];

/**
 * Формата `values`, отворена с `loaded`, върху по-новата рецепта `fresh` (напр. след `409 revision_stale`): полетата,
 * които поправката не пипа и които не са променени във формата, са тези на `fresh`; променените остават.
 */
export function rebaseKeptFields(
  values: RecipeFormValues,
  loaded: RecipeFormValues,
  fresh: RecipeFormValues,
): RecipeFormValues {
  const rebased = { ...values };
  for (const field of KEPT_FIELDS) {
    if (JSON.stringify(values[field]) === JSON.stringify(loaded[field])) {
      Object.assign(rebased, { [field]: fresh[field] });
    }
  }
  return rebased;
}

/**
 * „Приеми“ на поправка: формата `values` с цялата поправка (порции, време, продукти, компоненти, подготовка, стъпки);
 * заглавието, таговете, уредът, източникът и хранителната стойност остават.
 */
export function revisedFormValues(
  values: RecipeFormValues,
  revision: RecipeRevision,
): RecipeFormValues {
  const components = componentsToValues(revision.components);
  return {
    ...values,
    servings: String(revision.servings),
    prepMinutes:
      revision.prepMinutes === undefined ? '' : String(revision.prepMinutes),
    steps: revision.steps.map((step) => ({ ...step })),
    preparation: preparationToValues(revision.preparation),
    components,
    ingredients: revisionToIngredientRows(revision.ingredients, components),
  };
}
