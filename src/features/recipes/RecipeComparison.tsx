import type { Preparation, RecipeStep } from '@family/shared';
import { type ReactNode, useId } from 'react';
import { PreparationList } from '../preparation/PreparationList';
import { StepPhotoThumbnail } from '../step-photos/StepPhotoThumbnail';

/**
 * Сравнението на сегашната рецепта с предложената от AI: две колони една до друга на широк екран и една под друга на
 * телефон. Ползват го „Подобри рецептата“ и „Поправи с AI“; колоните са `ComparisonColumn`.
 */
export function RecipeComparison({ children }: { children: ReactNode }) {
  return <div className="comparison">{children}</div>;
}

/**
 * Едната колона на сравнението: каквото е преди подготовката (`children`, напр. порциите и продуктите при поправка),
 * подготовката (ако я има в някоя от двете колони, иначе нищо) и стъпките. Без подготовка в тази колона пише „Без
 * подготовка“, за да личи, че приемането я маха или добавя. Копие на `ComparisonColumn` от family.
 */
export function ComparisonColumn({
  name,
  steps,
  preparation,
  stepsLabel = name,
  children,
}: {
  name: string;
  steps: readonly RecipeStep[];
  /** `undefined`: и двете колони са без подготовка. */
  preparation: Preparation | undefined;
  /** Името на списъка със стъпките, ако не е `name`. */
  stepsLabel?: string;
  children?: ReactNode;
}) {
  const lowerName = name.toLocaleLowerCase('bg');
  const headingId = useId();
  const preparationId = useId();
  return (
    <section className="comparison__column" aria-labelledby={headingId}>
      <h3 id={headingId} className="comparison__heading">
        {name}
      </h3>
      {children}
      {preparation &&
        (preparation.length > 0 ? (
          <>
            <h4 id={preparationId} className="comparison__subheading">
              Подготовка
            </h4>
            {/* Името на списъка е „Подготовка Сега“: двете колони имат по един. */}
            <PreparationList
              preparation={preparation}
              labelledBy={`${preparationId} ${headingId}`}
            />
          </>
        ) : (
          <p className="comparison__note">Без подготовка</p>
        ))}
      <ol className="comparison__steps" aria-label={stepsLabel}>
        {steps.map((step, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: стъпките нямат id; редът е идентичността им.
          <li key={index} className="comparison__step">
            <span>{step.text}</span>
            {step.photoId && (
              <StepPhotoThumbnail
                photoId={step.photoId}
                label={`Снимката на стъпка ${index + 1} (${lowerName})`}
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
