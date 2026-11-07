import {
  type Preparation,
  type PreparationItem,
  type PreparationKind,
  preparationKind,
  preparationLabel,
} from '@family/shared';

/** Иконата на вида; името на вида е името ѝ за четците на екрана. */
export function PreparationKindIcon({ kind }: { kind: PreparationKind }) {
  const { icon, labelBg } = preparationKind(kind);
  return (
    <span className="preparation-item__icon" role="img" aria-label={labelBg}>
      {icon}
    </span>
  );
}

/** Иконата на вида и надписът на един елемент от подготовката (GLOSSARY: Подготовка): „🔥 200° · с вентилатор“. */
export function PreparationItemLabel({ item }: { item: PreparationItem }) {
  return (
    <>
      <PreparationKindIcon kind={item.kind} />
      <span className="preparation-item__label">{preparationLabel(item)}</span>
    </>
  );
}

/** Подготовката само за четене, в реда на рецептата. Копие от family. */
export function PreparationList({
  preparation,
  labelledBy,
}: {
  preparation: Preparation;
  /** `id` на заглавието, което дава името на списъка. */
  labelledBy: string;
}) {
  return (
    <ul className="preparation-list" aria-labelledby={labelledBy}>
      {preparation.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: елементите нямат id, а редът им е смисълът.
        <li key={index} className="preparation-item">
          <PreparationItemLabel item={item} />
        </li>
      ))}
    </ul>
  );
}
