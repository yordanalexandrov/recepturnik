import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
  redirect,
} from '@tanstack/react-router';
import { NewRecipeScreen } from '../features/recipes/RecipeEditor';
import { RecipeList } from '../features/recipes/RecipeList';
import { RecipeView } from '../features/recipes/RecipeView';
import { Layout } from './Layout';
import { NotFound } from './NotFound';
import { Placeholder } from './Placeholder';

// Пътищата са същите като във family (спец #1, „Пътища“), за да работи един линк и в двете приложения.
// Code-based routes: всеки екран е `createRoute` тук и влиза в `rootRoute.addChildren`.

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/recipes', replace: true });
  },
});

const recipesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes',
  component: RecipeList,
});

const newRecipeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/new',
  component: () => <NewRecipeScreen />,
});

// Временни екрани: следващите задачи (#9, #10) им дават истинския component.
const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/import',
  component: () => <Placeholder title="Внеси рецепта" />,
});

const suggestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/suggest',
  component: () => <Placeholder title="Предложения" />,
});

const recipeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/$id',
  component: RecipeView,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  recipesRoute,
  newRecipeRoute,
  importRoute,
  suggestRoute,
  recipeRoute,
]);

/** Router-ът на приложението; тестовете подават history в памет (`src/test/render.tsx`). */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
