import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
  redirect,
} from '@tanstack/react-router';
import { ImportRequestView } from '../features/recipe-import/ImportRequestView';
import {
  ImportScreen,
  parseImportSearch,
} from '../features/recipe-import/ImportScreen';
import {
  EditRecipeScreen,
  NewRecipeScreen,
  parseEditRecipeSearch,
} from '../features/recipes/RecipeEditor';
import { RecipeList } from '../features/recipes/RecipeList';
import { RecipeView } from '../features/recipes/RecipeView';
import { SuggestionRequestView } from '../features/suggestions/SuggestionRequestView';
import {
  parseSuggestionReviewSearch,
  SuggestionReview,
} from '../features/suggestions/SuggestionReview';
import { SuggestScreen } from '../features/suggestions/SuggestScreen';
import { Layout } from './Layout';
import { NotFound } from './NotFound';

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

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/import',
  validateSearch: parseImportSearch,
  component: ImportScreen,
});

const importRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/import/$requestId',
  component: ImportRequestView,
});

const suggestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/suggest',
  component: SuggestScreen,
});

const suggestionRequestRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/suggest/$requestId',
  component: SuggestionRequestView,
});

const suggestionReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/suggest/$requestId/$suggestionId',
  validateSearch: parseSuggestionReviewSearch,
  component: SuggestionReview,
});

const recipeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/$id',
  component: RecipeView,
});

const editRecipeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/$id/edit',
  validateSearch: parseEditRecipeSearch,
  component: () => <EditRecipeScreen />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  recipesRoute,
  newRecipeRoute,
  importRoute,
  importRequestRoute,
  suggestRoute,
  suggestionRequestRoute,
  suggestionReviewRoute,
  recipeRoute,
  editRecipeRoute,
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
