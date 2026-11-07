import {
  displaySourceUrl,
  type Ingredient,
  type SuggestionPayload,
} from '@family/shared';
import { preparationToValues } from '../preparation/preparation-values';
import {
  componentsToValues,
  emptyIngredientRow,
  emptyRecipeFormValues,
  lineComponent,
  nutritionToValues,
  type RecipeFormValues,
} from '../recipes/recipe-form-values';

/**
 * Началните стойности на `RecipeForm` от предложение. `resolved` е продуктът от регистъра по име на реда (точно
 * съвпадение); ред без него остава несвързан и откроен като нов продукт. Подготовката и компонентите идват във
 * формата непроменени. Копие от family.
 */
export function suggestionToFormValues(
  suggestion: SuggestionPayload,
  resolved: ReadonlyMap<string, Ingredient>,
): RecipeFormValues {
  const components = componentsToValues(suggestion.components);
  return {
    ...emptyRecipeFormValues(),
    title: suggestion.title,
    servings: String(suggestion.servings),
    prepMinutes: String(suggestion.prepMinutes),
    sourceUrl: displaySourceUrl(suggestion.sourceUrl),
    tags: [...suggestion.tags],
    appliance: suggestion.appliance ?? '',
    steps: suggestion.steps.map((step) => ({ ...step })),
    preparation: preparationToValues(suggestion.preparation),
    components,
    ingredients: suggestion.ingredients.map((line) => {
      const ingredient = line.isNew ? undefined : resolved.get(line.name);
      return emptyIngredientRow({
        ingredient: ingredient ?? null,
        query: ingredient?.name ?? line.name,
        quantity: line.quantity === null ? '' : String(line.quantity),
        unit: line.unit,
        ...(ingredient ? {} : { isNew: true }),
        ...lineComponent(components, line.component),
      });
    }),
    nutrition: nutritionToValues(suggestion.nutritionPer100g),
  };
}
