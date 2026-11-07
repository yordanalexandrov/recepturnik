import {
  type Appliance,
  appliancesResponseSchema,
  type Ingredient,
  ingredientSchema,
  ingredientsResponseSchema,
  type Recipe,
  type RecipeInput,
  recipeResponseSchema,
} from '@family/shared';
import { HttpResponse, http } from 'msw';
import { server } from './msw';
import { chicken, onion, salt } from './recipe-detail';
import { omelette } from './recipes';

// Фикстури за формата на рецепта: продуктите за autocomplete, уредите и запис. Отговорите минават през schema-ите
// от @family/shared, за да не се разминават с договора.

/** Продукт, който го няма в регистъра, докато не се създаде с „Нов продукт“. */
export const mint: Ingredient = ingredientSchema.parse({
  id: 'aaaaaaaa-0000-4000-8000-000000000009',
  name: 'джоджен',
  unit: 'g',
  aisle: 'produce',
});

export const ingredients: Ingredient[] = [chicken, onion, salt];

/** Част от уредите по data миграцията на api-то на family (`0023_seed_appliances`). */
export const appliances: Appliance[] = [
  {
    id: 'a0000000-0000-4000-8000-000000000001',
    name: 'air fryer (Cosori CAF-R121-KEU)',
    enabled: true,
  },
  {
    id: 'a0000000-0000-4000-8000-000000000003',
    name: 'sous vide',
    enabled: true,
  },
];

/** `GET /api/appliances`. */
export function serveAppliances(list: Appliance[] = appliances) {
  const body = appliancesResponseSchema.parse({ appliances: list });
  server.use(http.get('/api/appliances', () => HttpResponse.json(body)));
}

/** `GET /api/ingredients?q=` по подниз в името, без значение от главни букви (както ILIKE на api-то). */
export function serveIngredientSearch(list: Ingredient[] = ingredients) {
  server.use(
    http.get('/api/ingredients', ({ request }) => {
      const q = (new URL(request.url).searchParams.get('q') ?? '')
        .trim()
        .toLocaleLowerCase('bg');
      return HttpResponse.json(
        ingredientsResponseSchema.parse({
          ingredients: list.filter((i) => i.name.includes(q)),
        }),
      );
    }),
  );
}

/**
 * Всичко за „Нова рецепта“: уреди, търсене на продукти и `POST /api/recipes`, след който прегледът
 * (`GET /api/recipes/:id`) вижда записаното. Връща телата, стигнали до api-то.
 */
export function serveForm(): RecipeInput[] {
  const saved: RecipeInput[] = [];
  const stored = (): Recipe =>
    recipeResponseSchema.parse({
      recipe: { ...omelette, ...saved.at(-1), ingredients: [] },
    }).recipe;
  serveAppliances();
  serveIngredientSearch();
  server.use(
    http.post('/api/recipes', async ({ request }) => {
      saved.push((await request.json()) as RecipeInput);
      return HttpResponse.json({ recipe: stored() }, { status: 201 });
    }),
    http.get(`/api/recipes/${omelette.id}`, () =>
      HttpResponse.json({ recipe: stored() }),
    ),
  );
  return saved;
}
