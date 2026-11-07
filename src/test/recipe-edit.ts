import {
  type Ingredient,
  ingredientSchema,
  type Recipe,
  type ReplaceRecipeInput,
  recipeResponseSchema,
  recipeSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { server } from './msw';
import { chicken, salt } from './recipe-detail';
import { serveAppliances, serveIngredientSearch } from './recipe-form';

// Фикстури за редакцията на рецепта: рецепта с всичко, което може да има (компонент, подготовка, хранителна стойност,
// снимка на стъпка), и api-то на редакцията. Отговорите минават през schema-ите от @family/shared.

export const basil: Ingredient = ingredientSchema.parse({
  id: 'aaaaaaaa-0000-4000-8000-000000000004',
  name: 'босилек',
  unit: 'g',
  aisle: 'produce',
});

export const stepPhotoId = 'eeeeeeee-0000-4000-8000-000000000001';

/** „Пиле с песто“: главни продукти, компонент „Песто · за 5 порции“, фурна, хранителна стойност и снимка на стъпка. */
export const chickenWithPesto: Recipe = recipeSchema.parse({
  id: 'bbbbbbbb-0000-4000-8000-000000000010',
  title: 'Пиле с песто',
  servings: 2,
  prepMinutes: 40,
  tags: ['dinner'],
  steps: [
    { text: 'Изпечи пилето.', photoId: stepPhotoId },
    { text: 'Залей с песто.' },
  ],
  sourceUrl: 'https://recepti.example/pile-s-pesto',
  appliance: 'sous vide',
  nutritionPer100g: { kcal: 180, proteinG: 20, fatG: 9, carbsG: 2.5 },
  preparation: [{ kind: 'oven', degrees: 200, fan: 'fan' }],
  components: [{ name: 'Песто', servings: 5 }],
  ingredients: [
    {
      ingredientId: chicken.id,
      quantity: 400,
      unit: 'g',
      component: null,
      ingredient: chicken,
    },
    {
      ingredientId: basil.id,
      quantity: 50,
      unit: 'g',
      component: 0,
      ingredient: basil,
    },
    {
      ingredientId: salt.id,
      quantity: null,
      unit: 'pinch',
      component: 0,
      ingredient: salt,
    },
  ],
  archivedAt: null,
  rating: null,
  createdAt: '2026-10-22T10:00:00.000Z',
  updatedAt: '2026-10-22T10:00:00.000Z',
  openRevision: null,
});

/**
 * Редакцията на `recipe`: прегледът и формата (`GET /api/recipes/:id`, който след запис вижда записаното), уредите,
 * търсенето на продукти и `PUT /api/recipes/:id`. Връща телата на `PUT`, стигнали до api-то.
 */
export function serveEdit(recipe: Recipe = chickenWithPesto): unknown[] {
  const saved: unknown[] = [];
  const stored = (): Recipe => {
    const last = saved.at(-1) as ReplaceRecipeInput | undefined;
    return recipeResponseSchema.parse({
      recipe: { ...recipe, ...last, ingredients: recipe.ingredients },
    }).recipe;
  };
  serveAppliances();
  serveIngredientSearch([chicken, salt, basil]);
  server.use(
    http.get(`/api/recipes/${recipe.id}`, () =>
      HttpResponse.json({ recipe: stored() }),
    ),
    http.put(`/api/recipes/${recipe.id}`, async ({ request }) => {
      saved.push(await request.json());
      return HttpResponse.json({ recipe: stored() });
    }),
  );
  return saved;
}
