import { describe, expect, it } from 'vitest';
import { chicken, chickenWithRiceDetail, salt } from '../../test/recipe-detail';
import {
  emptyIngredientRow,
  emptyRecipeFormValues,
  recipeToFormValues,
  toRecipeInput,
} from './recipe-form-values';

describe('recipe-form-values', () => {
  it('рецепта → полета → вход за api-то пази всичко, и полетата, които формата още не показва', () => {
    const values = recipeToFormValues({
      ...chickenWithRiceDetail,
      appliance: 'sous vide',
      preparation: [{ kind: 'oven', degrees: 200, fan: 'fan' }],
      components: [{ name: 'Сос', servings: 2 }],
      ingredients: chickenWithRiceDetail.ingredients.map((line) =>
        line.ingredient.id === salt.id ? { ...line, component: 0 } : line,
      ),
    });

    expect(values.title).toBe('Пиле с ориз');
    expect(values.servings).toBe('4');
    expect(values.sourceUrl).toBe('https://recepti.example/pile-s-oriz');
    expect(toRecipeInput(values)).toEqual({
      ok: true,
      input: {
        title: 'Пиле с ориз',
        servings: 4,
        prepMinutes: 45,
        sourceUrl: 'https://recepti.example/pile-s-oriz',
        tags: ['lunch', 'kid_friendly'],
        appliance: 'sous vide',
        steps: [{ text: 'Нарежи пилето.' }, { text: 'Задуши с лука.' }],
        nutritionPer100g: { kcal: 150, proteinG: 12, fatG: 5, carbsG: 14 },
        preparation: [{ kind: 'oven', degrees: 200, fan: 'fan' }],
        components: [{ name: 'Сос', servings: 2 }],
        ingredients: [
          {
            ingredientId: chicken.id,
            quantity: 500,
            unit: 'g',
            component: null,
          },
          {
            ingredientId: 'aaaaaaaa-0000-4000-8000-000000000002',
            quantity: 2,
            unit: 'pcs',
            component: null,
          },
          {
            ingredientId: salt.id,
            quantity: null,
            unit: 'pinch',
            component: 0,
          },
        ],
      },
    });
  });

  it('грешките са по пътя на полето, на български', () => {
    const values = {
      ...emptyRecipeFormValues(),
      servings: '2,5',
      steps: [{ text: 'Свари.' }, { text: '  ' }],
      ingredients: [
        emptyIngredientRow({ query: 'магданоз' }),
        emptyIngredientRow({ ingredient: chicken, quantity: '-1' }),
      ],
    };

    expect(toRecipeInput(values)).toEqual({
      ok: false,
      errors: {
        title: 'Въведи заглавие',
        servings: 'Порциите са цяло число, поне 1',
        'steps.1': 'Стъпката е празна',
        'ingredients.0.ingredientId':
          'Избери продукт от списъка или създай нов',
        'ingredients.1.quantity': 'Количеството е положително число',
      },
    });
  });
});
