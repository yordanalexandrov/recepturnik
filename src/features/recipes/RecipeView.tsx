import {
  AISLES,
  linesByComponent,
  type Recipe,
  TAG_LABELS_BG,
} from '@family/shared';
import { Link, useParams } from '@tanstack/react-router';
import { ApiError } from '../../api/client';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { PreparationList } from '../preparation/PreparationList';
import { StepPhotoThumbnail } from '../step-photos/StepPhotoThumbnail';
import {
  applianceShortName,
  componentHeading,
  formatMinutes,
  formatNumber,
  formatQuantity,
  formatServings,
  sourceDomain,
} from './format';
import { useArchiveRecipe, useRateRecipe, useRecipe } from './queries';
import { RatingStars } from './Stars';

/** Прегледът на рецепта (`/recipes/$id`). Копие на `RecipeView` от family без Готвене, „Как мина?“ и устройствата. */
export function RecipeView() {
  const { id } = useParams({ from: '/recipes/$id' });
  const recipe = useRecipe(id);

  return (
    <main className="screen recipe-view">
      {/* Регистърът сам пази филтрите си, затова обикновена връзка го връща както е бил. */}
      <Link to="/recipes" className="recipe-view__back">
        ← Рецепти
      </Link>
      {recipe.isPending ? (
        <Spinner />
      ) : isNotFound(recipe.error) ? (
        <div className="recipe-view__missing">
          <h1>Няма такава рецепта</h1>
          <p>
            <Link to="/recipes">Към рецептите</Link>
          </p>
        </div>
      ) : recipe.isError ? (
        <ErrorBox error={recipe.error} onRetry={() => void recipe.refetch()} />
      ) : (
        <RecipeDetails recipe={recipe.data} />
      )}
    </main>
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Продуктите по щандове, в реда на обхождане на магазина (`AISLES`). */
function groupByAisle(lines: Recipe['ingredients']) {
  return AISLES.map((aisle) => ({
    ...aisle,
    lines: lines.filter((line) => line.ingredient.aisle === aisle.key),
  })).filter((group) => group.lines.length > 0);
}

function IngredientLines({
  lines,
  labelledBy,
}: {
  lines: Recipe['ingredients'];
  labelledBy: string;
}) {
  return (
    <ul className="recipe-view__lines" aria-labelledby={labelledBy}>
      {lines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: един продукт може да е на два реда (за блата и за крема), а редовете нямат id.
        <li key={index} className="recipe-view__line">
          <span>{line.ingredient.name}</span>
          <span>{formatQuantity(line)}</span>
        </li>
      ))}
    </ul>
  );
}

function RecipeDetails({ recipe }: { recipe: Recipe }) {
  const rate = useRateRecipe();
  const archive = useArchiveRecipe();
  const archived = recipe.archivedAt !== null;
  const lines = linesByComponent(
    recipe.ingredients,
    recipe.components.length,
    (line) => line.component,
  );
  const nutrition = recipe.nutritionPer100g;
  return (
    <article className="recipe-view__article">
      <header className="recipe-view__header recipe-view__wide">
        <h1>{recipe.title}</h1>
        <RatingStars
          rating={recipe.rating}
          onRate={(rating) => rate.mutate({ id: recipe.id, rating })}
        />
        {rate.isError && <ErrorBox error={rate.error} />}
        <p className="recipe-view__meta">
          <span>{formatServings(recipe.servings)}</span>
          {recipe.prepMinutes !== undefined && (
            <span>{formatMinutes(recipe.prepMinutes)}</span>
          )}
          {recipe.tags.map((tag) => (
            <span key={tag} className="badge">
              {TAG_LABELS_BG[tag]}
            </span>
          ))}
          {recipe.appliance && (
            // Уредът (GLOSSARY на family: Уред) е за наш уред; пълното име с модела е в подсказката.
            <span className="badge" title={recipe.appliance}>
              Уред: {applianceShortName(recipe.appliance)}
            </span>
          )}
          {archived && <span className="badge">Архивирана</span>}
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Източник: {sourceDomain(recipe.sourceUrl)}
            </a>
          )}
        </p>
        {/* Действията над рецептата („Редактирай“ и архивът) са тук, в заглавната част. */}
        <div className="recipe-view__actions">
          <button
            type="button"
            className="button button--quiet"
            disabled={archive.isPending}
            onClick={() =>
              archive.mutate({ id: recipe.id, archived: !archived })
            }
          >
            {archived ? 'Върни' : 'Архивирай'}
          </button>
        </div>
        {archive.isError && <ErrorBox error={archive.error} />}
      </header>

      {recipe.preparation.length > 0 && (
        <section
          className="recipe-view__section recipe-view__wide"
          aria-labelledby="preparation"
        >
          <h2 id="preparation">Подготовка</h2>
          <PreparationList
            preparation={recipe.preparation}
            labelledBy="preparation"
          />
        </section>
      )}

      <section className="recipe-view__section" aria-labelledby="ingredients">
        <h2 id="ingredients">Продукти</h2>
        {recipe.ingredients.length === 0 && (
          <p className="recipe-view__meta">Няма въведени продукти.</p>
        )}
        {groupByAisle(lines.main).map((group) => (
          <div key={group.key}>
            <h3 id={`aisle-${group.key}`}>{group.labelBg}</h3>
            <IngredientLines
              lines={group.lines}
              labelledBy={`aisle-${group.key}`}
            />
          </div>
        ))}
        {recipe.components.map((component, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: компонентите нямат id; редът им е идентичността им.
          <div key={index}>
            <h3 id={`component-${index}`}>{componentHeading(component)}</h3>
            <IngredientLines
              lines={lines.components[index] ?? []}
              labelledBy={`component-${index}`}
            />
          </div>
        ))}
      </section>

      <section className="recipe-view__section" aria-labelledby="steps">
        <h2 id="steps">Стъпки</h2>
        <ol className="recipe-view__steps" aria-labelledby="steps">
          {recipe.steps.map((step, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: стъпките нямат id, а редът им е смисълът.
            <li key={index}>
              {/* Флексът е вътре: `li` остава ред от списъка и пази номера си. */}
              <div className="recipe-view__step">
                <span className="recipe-view__step-text">{step.text}</span>
                {step.photoId && (
                  <StepPhotoThumbnail
                    photoId={step.photoId}
                    label={`Снимката на стъпка ${index + 1}`}
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {nutrition && (
        <footer className="recipe-view__wide recipe-view__meta">
          <p>
            ≈ хранителна стойност на 100 г: {formatNumber(nutrition.kcal)} kcal
            · белтъчини {formatNumber(nutrition.proteinG)} г · мазнини{' '}
            {formatNumber(nutrition.fatG)} г · въглехидрати{' '}
            {formatNumber(nutrition.carbsG)} г
          </p>
        </footer>
      )}
    </article>
  );
}
