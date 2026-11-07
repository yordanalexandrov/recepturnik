import {
  type Ingredient,
  ingredientSchema,
  type Recipe,
  recipeResponseSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { server } from './msw';
import { chickenWithRice } from './recipes';

// Фикстури за прегледа на рецепта: продукти от seed-а на family и рецепта с редове. Отговорите минават през
// schema-ите от @family/shared, за да не се разминават с договора.

export const chicken: Ingredient = ingredientSchema.parse({
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  name: 'пилешко филе',
  unit: 'g',
  aisle: 'meat',
});

export const onion: Ingredient = ingredientSchema.parse({
  id: 'aaaaaaaa-0000-4000-8000-000000000002',
  name: 'лук',
  unit: 'pcs',
  aisle: 'produce',
});

export const salt: Ingredient = ingredientSchema.parse({
  id: 'aaaaaaaa-0000-4000-8000-000000000003',
  name: 'сол',
  unit: 'g',
  aisle: 'spices',
});

/** „Пиле с ориз“ с продукти (по един на щанд) и хранителна стойност. */
export const chickenWithRiceDetail: Recipe = {
  ...chickenWithRice,
  nutritionPer100g: { kcal: 150, proteinG: 12, fatG: 5, carbsG: 14 },
  ingredients: [
    {
      ingredientId: chicken.id,
      quantity: 500,
      unit: 'g',
      component: null,
      ingredient: chicken,
    },
    {
      ingredientId: onion.id,
      quantity: 2,
      unit: 'pcs',
      component: null,
      ingredient: onion,
    },
    {
      ingredientId: salt.id,
      quantity: null,
      unit: 'pinch',
      component: null,
      ingredient: salt,
    },
  ],
};

/** `GET /api/recipes/:id` за тази рецепта; отговорът минава през `recipeResponseSchema`. */
export function serveRecipe(recipe: Recipe = chickenWithRiceDetail) {
  const body = recipeResponseSchema.parse({ recipe });
  server.use(
    http.get(`/api/recipes/${recipe.id}`, () => HttpResponse.json(body)),
  );
}
