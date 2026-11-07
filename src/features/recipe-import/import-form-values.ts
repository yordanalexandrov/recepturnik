import {
  displaySourceUrl,
  type ImportPayload,
  type Ingredient,
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
 * Черновата от внасяне като начални стойности на `RecipeForm` (копие от family). Редът с `ingredientId` идва свързан
 * с продукта от `linked` (регистъра); редът с `newProduct` остава неразрешен, с предложеното име и форма „Нов продукт“,
 * попълнена от него. Бележката на реда (оригиналната единица) остава в рецептата, а подготовката и компонентите идват
 * във формата, за да се поправят.
 */
export function importToFormValues(
  recipe: ImportPayload,
  linked: readonly Ingredient[],
  sourceUrl: string | undefined,
): RecipeFormValues {
  const byId = new Map(linked.map((ingredient) => [ingredient.id, ingredient]));
  const components = componentsToValues(recipe.components);
  return {
    ...emptyRecipeFormValues(),
    title: recipe.title,
    servings: String(recipe.servings),
    prepMinutes: recipe.prepMinutes === null ? '' : String(recipe.prepMinutes),
    sourceUrl: displaySourceUrl(sourceUrl ?? ''),
    tags: [...recipe.tags],
    steps: recipe.steps.map((step) => ({ ...step })),
    preparation: preparationToValues(recipe.preparation),
    components,
    ingredients: recipe.ingredients.map((line) => {
      const ingredient =
        line.ingredientId === null ? undefined : byId.get(line.ingredientId);
      return emptyIngredientRow({
        ingredient: ingredient ?? null,
        query: ingredient?.name ?? line.newProduct?.name ?? '',
        quantity: line.quantity === null ? '' : String(line.quantity),
        unit: line.unit,
        ...(line.note === null ? {} : { note: line.note }),
        ...(line.newProduct
          ? { isNew: true, newProduct: line.newProduct }
          : {}),
        ...lineComponent(components, line.component),
      });
    }),
    nutrition: nutritionToValues(recipe.nutritionPer100g),
  };
}
