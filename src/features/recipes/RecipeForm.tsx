import {
  COMPONENTS_MAX,
  type Ingredient,
  linesByComponent,
  type RecipeInput,
  type RecipeStep,
  TAG_LABELS_BG,
  type Tag,
  tagSchema,
} from '@family/shared';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { ActionBar } from '../../components/ActionBar';
import { ChoiceChips, toggled } from '../../components/ChoiceChips';
import { ErrorBox } from '../../components/ErrorBox';
import { Field } from '../../components/Field';
import { useAppliances } from '../appliances/queries';
import { PreparationField } from '../preparation/PreparationField';
import { StepPhotoImage } from '../step-photos/StepPhotoThumbnail';
import { ComponentSheet } from './ComponentSheet';
import { applianceShortName, componentHeading, componentName } from './format';
import { IngredientLineSheet } from './IngredientLineSheet';
import {
  type ComponentValues,
  emptyIngredientRow,
  emptyRecipeFormValues,
  type IngredientRowValues,
  ingredientLineName,
  ingredientLineText,
  ingredientRowErrors,
  newRowKey,
  type RecipeFormErrors,
  type RecipeFormValues,
  toRecipeInput,
} from './recipe-form-values';
import { StepSheet } from './StepSheet';

export interface RecipeFormProps {
  /**
   * Начални стойности: празна рецепта по подразбиране; `recipeToFormValues(recipe)` за редакция, черновата от внасяне
   * или предложение. Чете се само при първото изобразяване (за нова рецепта смени `key`).
   */
  initialValues?: RecipeFormValues;
  /** Вика се само с валиден `RecipeInput` (по `recipeInputSchema`). */
  onSubmit: (input: RecipeInput) => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Грешка от записа (api), показва се в лентата с действията. */
  submitError?: unknown;
  onCancel?: () => void;
}

/** Стъпката или редът в отворения лист; `added` = нов от „Добави …“, който се маха, ако се затвори празен. */
interface Editing<K> {
  key: K;
  added: boolean;
}

/** Стъпката с нова снимка или без снимка (`undefined`), без празно поле `photoId`. */
function withPhoto(step: RecipeStep, photoId: string | undefined): RecipeStep {
  const { photoId: _old, ...rest } = step;
  return photoId === undefined ? rest : { ...rest, photoId };
}

function move<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) {
    next.splice(to, 0, item);
  }
  return next;
}

/**
 * Грешките по редове на списък (`steps.<n>`, `ingredients.<n>.<поле>`) са по индекс: след местене или махане минават
 * под новия индекс на реда си (`undefined` = редът го няма). Другите грешки остават.
 */
function reindexErrors(
  errors: RecipeFormErrors,
  list: 'steps' | 'ingredients' | 'preparation' | 'components',
  newIndex: (index: number) => number | undefined,
): RecipeFormErrors {
  const pattern = new RegExp(`^${list}\\.(\\d+)(\\..+)?$`);
  const next: RecipeFormErrors = {};
  for (const [path, message] of Object.entries(errors)) {
    const match = pattern.exec(path);
    if (!match) {
      next[path] = message;
      continue;
    }
    const index = newIndex(Number(match[1]));
    if (index !== undefined) {
      next[`${list}.${index}${match[2] ?? ''}`] = message;
    }
  }
  return next;
}

/** Името на предложения нов продукт на реда, за сравнение без значение от главни букви. */
function newProductKey(row: IngredientRowValues): string | undefined {
  return row.newProduct?.name.trim().toLocaleLowerCase('bg');
}

/** Новият индекс на ред след махането на `removed`. */
function afterRemoving(removed: number) {
  return (index: number) =>
    index === removed ? undefined : index > removed ? index - 1 : index;
}

/** Грешките на подготовката без `preparation.` отпред; грешката на целия списък е под `''`. */
function preparationErrors(errors: RecipeFormErrors): RecipeFormErrors {
  return Object.fromEntries(
    Object.entries(errors).flatMap(([path, message]) =>
      path === 'preparation'
        ? [['', message]]
        : path.startsWith('preparation.')
          ? [[path.slice('preparation.'.length), message]]
          : [],
    ),
  );
}

const NUTRITION_FIELDS = [
  ['kcal', 'Енергия (kcal)'],
  ['proteinG', 'Белтъчини (г)'],
  ['fatG', 'Мазнини (г)'],
  ['carbsG', 'Въглехидрати (г)'],
] as const;

/** Заглавието на компонента във формата: „Песто · за 5 порции“, докато се пише — „Песто · за ? порции“. */
function componentTitle(component: ComponentValues): string {
  const name = componentName(component.name);
  const servings = Number(component.servings.trim());
  return Number.isInteger(servings) && servings > 0
    ? componentHeading({ name, servings })
    : `${name} · за ${component.servings.trim() || '?'} порции`;
}

/** Отбелязаните грешки, чиито полета `values` още не поправят; нова грешка излиза чак при следващото „Запази“. */
function stillFailing(
  flagged: RecipeFormErrors,
  values: RecipeFormValues,
): RecipeFormErrors {
  if (Object.keys(flagged).length === 0) {
    return flagged;
  }
  const result = toRecipeInput(values);
  if (result.ok) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(flagged).filter(([path]) => path in result.errors),
  );
}

/**
 * Формата на рецепта, за нова и за редакция: основните полета, подготовката, продуктите (главните и по компонент),
 * стъпките със снимките им и хранителната стойност на 100 г; всеки ред, компонент и елемент на подготовката — в свой
 * лист. Без библиотека; проверката е с `recipeInputSchema` през `toRecipeInput`. По `RecipeForm` на family.
 */
export function RecipeForm({
  initialValues,
  onSubmit,
  submitLabel = 'Запази',
  isSubmitting = false,
  submitError,
  onCancel,
}: RecipeFormProps) {
  const [values, setValues] = useState<RecipeFormValues>(
    () => initialValues ?? emptyRecipeFormValues(),
  );
  /**
   * Грешките на клиентската проверка от последното „Запази“ (тази от сървъра е `submitError`); показват се само докато
   * полето им още не минава проверката.
   */
  const [flagged, setFlagged] = useState<RecipeFormErrors>({});
  const errors = useMemo(
    () => stillFailing(flagged, values),
    [flagged, values],
  );
  const [editing, setEditing] = useState<Editing<string> | null>(null);
  const [editingStep, setEditingStep] = useState<Editing<number> | null>(null);
  /** `added` = нов от „+ Компонент“, който остава само с „Добави“. */
  const [editingComponent, setEditingComponent] =
    useState<Editing<string> | null>(null);
  const appliances = useAppliances();
  // Уред, който го няма в списъка (напр. махнат от Настройки на family), остава избран, докато не се смени.
  const applianceNames = appliances.data?.map((a) => a.name) ?? [];
  if (values.appliance !== '' && !applianceNames.includes(values.appliance)) {
    applianceNames.push(values.appliance);
  }
  const formId = useId();
  const errorIdPrefix = useId();

  function set<K extends keyof RecipeFormValues>(
    key: K,
    value: RecipeFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateRow(key: string, patch: Partial<IngredientRowValues>) {
    setValues((current) => ({
      ...current,
      ingredients: current.ingredients.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    }));
  }

  /** Избран продукт в реда; основната единица на продукта, освен ако вече има въведено количество. */
  function selected(
    row: IngredientRowValues,
    ingredient: Ingredient,
  ): Partial<IngredientRowValues> {
    return {
      ingredient,
      query: ingredient.name,
      ...(row.quantity.trim() === '' && row.unit !== 'pinch'
        ? { unit: ingredient.unit }
        : {}),
    };
  }

  /**
   * Продукт, създаден от един ред, свързва и другите несвързани редове със същия предложен нов продукт (напр. от
   * внасяне — за блат и крем). Като във family.
   */
  function linkSameNewProduct(key: string, ingredient: Ingredient) {
    const source = values.ingredients.find((row) => row.key === key);
    const name = source && newProductKey(source);
    if (name === undefined) {
      return;
    }
    for (const row of values.ingredients) {
      if (
        row.key !== key &&
        row.ingredient === null &&
        newProductKey(row) === name
      ) {
        updateRow(row.key, selected(row, ingredient));
      }
    }
  }

  function addIngredient() {
    const row = emptyIngredientRow();
    set('ingredients', [...values.ingredients, row]);
    setEditing({ key: row.key, added: true });
  }

  function removeIngredient(key: string) {
    const removed = values.ingredients.findIndex((row) => row.key === key);
    set(
      'ingredients',
      values.ingredients.filter((row) => row.key !== key),
    );
    setFlagged((current) =>
      reindexErrors(current, 'ingredients', afterRemoving(removed)),
    );
    setEditing(null);
  }

  /** Нов ред, затворен без продукт, текст и количество, отпада. */
  function closeIngredient() {
    if (editing?.added) {
      const row = values.ingredients.find((r) => r.key === editing.key);
      if (
        row &&
        row.ingredient === null &&
        row.query.trim() === '' &&
        row.quantity.trim() === ''
      ) {
        removeIngredient(row.key);
        return;
      }
    }
    setEditing(null);
  }

  function addComponent() {
    const component: ComponentValues = {
      key: newRowKey(),
      name: '',
      // Компонентът е за други порции от рецептата (GLOSSARY: Компонент): ги пише човекът.
      servings: '',
    };
    set('components', [...values.components, component]);
    setEditingComponent({ key: component.key, added: true });
  }

  function updateComponent(
    key: string,
    patch: Partial<Omit<ComponentValues, 'key'>>,
  ) {
    setValues((current) => ({
      ...current,
      components: current.components.map((component) =>
        component.key === key ? { ...component, ...patch } : component,
      ),
    }));
  }

  /** Махнатият компонент връща редовете си при главните. */
  function removeComponent(key: string) {
    const removed = values.components.findIndex(
      (component) => component.key === key,
    );
    setValues((current) => ({
      ...current,
      components: current.components.filter(
        (component) => component.key !== key,
      ),
      ingredients: current.ingredients.map((row) =>
        row.component === key ? { ...row, component: undefined } : row,
      ),
    }));
    setFlagged((current) =>
      reindexErrors(current, 'components', afterRemoving(removed)),
    );
    setEditingComponent(null);
  }

  /** Затварянето на нов компонент (без „Добави“) е отказ: той се маха. */
  function closeComponent() {
    if (editingComponent?.added) {
      removeComponent(editingComponent.key);
      return;
    }
    setEditingComponent(null);
  }

  function addStep() {
    set('steps', [...values.steps, { text: '' }]);
    setEditingStep({ key: values.steps.length, added: true });
  }

  function moveStep(from: number, to: number) {
    set('steps', move(values.steps, from, to));
    const order = move(
      values.steps.map((_, index) => index),
      from,
      to,
    );
    setFlagged((current) =>
      reindexErrors(current, 'steps', (index) => order.indexOf(index)),
    );
    setEditingStep((current) => current && { ...current, key: to });
  }

  function removeStep(index: number) {
    set(
      'steps',
      values.steps.filter((_, i) => i !== index),
    );
    setFlagged((current) =>
      reindexErrors(current, 'steps', afterRemoving(index)),
    );
    setEditingStep(null);
  }

  /** Празна стъпка отпада при затваряне на листа, нова или изпразнена. */
  function closeStep() {
    const index = editingStep?.key;
    if (index !== undefined && values.steps[index]?.text.trim() === '') {
      removeStep(index);
      return;
    }
    setEditingStep(null);
  }

  /** „Запази“ и Enter в поле: несвързан продукт спира записа и отваря листа си, иначе проверка и запис. */
  function submit(event: FormEvent) {
    event.preventDefault();
    const result = toRecipeInput(values);
    if (!result.ok) {
      setFlagged(result.errors);
      const unlinked = values.ingredients.find(
        (row) => row.ingredient === null,
      );
      if (unlinked) {
        setEditing({ key: unlinked.key, added: false });
      }
      return;
    }
    setFlagged({});
    onSubmit(result.input);
  }

  const editingIndex = editing
    ? values.ingredients.findIndex((row) => row.key === editing.key)
    : -1;
  const editingRow = values.ingredients[editingIndex];
  const stepIndex = editingStep?.key ?? -1;
  const editingStepValue = values.steps[stepIndex];
  const componentAt = new Map(
    values.components.map((component, index) => [component.key, index]),
  );
  const lines = linesByComponent(
    values.ingredients.map((row, index) => ({ row, index })),
    values.components.length,
    ({ row }) =>
      row.component === undefined ? null : componentAt.get(row.component),
  );
  /** Редовете на групата: тези, които искат действие, са отгоре, а записът пази реда на рецептата. */
  const ordered = (group: typeof lines.main) => [
    ...group.filter(({ row }) => row.ingredient === null),
    ...group.filter(({ row }) => row.ingredient !== null),
  ];
  const editingComponentIndex = editingComponent
    ? values.components.findIndex((c) => c.key === editingComponent.key)
    : -1;
  const editingComponentValues = values.components[editingComponentIndex];

  function ingredientLine({
    row,
    index,
  }: {
    row: IngredientRowValues;
    index: number;
  }) {
    const rowErrors = ingredientRowErrors(errors, index);
    const error =
      (row.ingredient === null ? rowErrors.ingredientId : undefined) ??
      rowErrors.quantity;
    const errorId = `${errorIdPrefix}-${row.key}-error`;
    const open = () => setEditing({ key: row.key, added: false });
    return (
      <li key={row.key} className="form-line">
        <button
          type="button"
          className="form-line__open"
          aria-describedby={error === undefined ? undefined : errorId}
          onClick={open}
        >
          {ingredientLineText(row)}
        </button>
        {row.ingredient ? (
          <span className="form-line__linked" role="img" aria-label="Свързан">
            ✓
          </span>
        ) : (
          <button
            type="button"
            className="button button--quiet"
            aria-label={`Свържи „${ingredientLineName(row)}“`}
            onClick={open}
          >
            Свържи
          </button>
        )}
        {error !== undefined && (
          <p className="field__error form-line__error" id={errorId}>
            {error}
          </p>
        )}
      </li>
    );
  }

  return (
    <>
      <form id={formId} className="recipe-form" noValidate onSubmit={submit}>
        <fieldset className="recipe-form__section recipe-form__basics">
          <legend>Основни</legend>
          <Field
            label="Заглавие"
            error={errors.title}
            className="recipe-form__title"
          >
            {(props) => (
              <input
                {...props}
                className="input"
                value={values.title}
                onChange={(event) => set('title', event.target.value)}
              />
            )}
          </Field>
          <Field label="Порции" error={errors.servings}>
            {(props) => (
              <input
                {...props}
                className="input"
                inputMode="numeric"
                value={values.servings}
                onChange={(event) => set('servings', event.target.value)}
              />
            )}
          </Field>
          <Field label="Време (мин)" error={errors.prepMinutes}>
            {(props) => (
              <input
                {...props}
                className="input"
                inputMode="numeric"
                value={values.prepMinutes}
                onChange={(event) => set('prepMinutes', event.target.value)}
              />
            )}
          </Field>
          <Field label="Източник (линк)" error={errors.sourceUrl}>
            {(props) => (
              <input
                {...props}
                type="url"
                className="input"
                value={values.sourceUrl}
                onChange={(event) => set('sourceUrl', event.target.value)}
              />
            )}
          </Field>
          <Field label="Уред" error={errors.appliance}>
            {(props) => (
              <select
                {...props}
                className="input"
                value={values.appliance}
                onChange={(event) => set('appliance', event.target.value)}
              >
                <option value="">Без уред</option>
                {applianceNames.map((name) => (
                  <option key={name} value={name}>
                    {applianceShortName(name)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <ChoiceChips<Tag>
            label="Тагове"
            className="recipe-form__tags"
            options={tagSchema.options}
            labels={TAG_LABELS_BG}
            selected={values.tags}
            onToggle={(tag) => set('tags', toggled(values.tags, tag))}
          />
        </fieldset>

        <PreparationField
          items={values.preparation}
          errors={preparationErrors(errors)}
          onChange={(preparation, reindex) => {
            set('preparation', preparation);
            if (reindex) {
              setFlagged((current) =>
                reindexErrors(current, 'preparation', reindex),
              );
            }
          }}
        />

        <fieldset className="recipe-form__section">
          <legend>Продукти</legend>
          <ul className="form-lines" aria-label="Продукти">
            {ordered(lines.main).map(ingredientLine)}
          </ul>
          {values.components.map((component, index) => {
            const error =
              errors[`components.${index}.name`] ??
              errors[`components.${index}.servings`] ??
              errors[`components.${index}`];
            const errorId = `${errorIdPrefix}-${component.key}-error`;
            return (
              <div key={component.key} className="recipe-form__component">
                <button
                  type="button"
                  className="recipe-form__component-open"
                  aria-describedby={error === undefined ? undefined : errorId}
                  onClick={() =>
                    setEditingComponent({ key: component.key, added: false })
                  }
                >
                  {componentTitle(component)}
                </button>
                {error !== undefined && (
                  <p className="field__error" id={errorId}>
                    {error}
                  </p>
                )}
                <ul
                  className="form-lines"
                  aria-label={componentName(component.name)}
                >
                  {ordered(lines.components[index] ?? []).map(ingredientLine)}
                </ul>
              </div>
            );
          })}
          <button
            type="button"
            className="button button--quiet"
            onClick={addIngredient}
          >
            Добави продукт
          </button>
          {values.components.length < COMPONENTS_MAX && (
            <button
              type="button"
              className="button button--quiet"
              onClick={addComponent}
            >
              + Компонент
            </button>
          )}
        </fieldset>

        <fieldset className="recipe-form__section">
          <legend>Стъпки</legend>
          {errors.steps && <p className="field__error">{errors.steps}</p>}
          <ol className="form-lines form-lines--numbered" aria-label="Стъпки">
            {values.steps.map((step, index) => {
              const error = errors[`steps.${index}`];
              const errorId = `${errorIdPrefix}-step-${index}-error`;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: стъпките нямат id; редът е идентичността им.
                <li key={index} className="form-line">
                  <button
                    type="button"
                    className="form-line__open"
                    aria-describedby={error === undefined ? undefined : errorId}
                    onClick={() => setEditingStep({ key: index, added: false })}
                  >
                    <span className="form-line__text">
                      {step.text.trim() || 'Празна стъпка'}
                    </span>
                    {step.photoId && (
                      <StepPhotoImage photoId={step.photoId} label="" />
                    )}
                  </button>
                  {error !== undefined && (
                    <p className="field__error form-line__error" id={errorId}>
                      {error}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <button
            type="button"
            className="button button--quiet"
            onClick={addStep}
          >
            Добави стъпка
          </button>
        </fieldset>
        <fieldset className="recipe-form__section">
          <legend>Хранителна стойност</legend>
          <p className="form-hint">На 100 г, по избор.</p>
          <div className="recipe-form__row">
            {NUTRITION_FIELDS.map(([key, label]) => (
              <Field
                key={key}
                label={label}
                error={errors[`nutritionPer100g.${key}`]}
              >
                {(props) => (
                  <input
                    {...props}
                    className="input"
                    inputMode="decimal"
                    value={values.nutrition[key]}
                    onChange={(event) =>
                      set('nutrition', {
                        ...values.nutrition,
                        [key]: event.target.value,
                      })
                    }
                  />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
        {/* В самата форма: Enter в поле я праща през „Запази“. */}
        <ActionBar
          primary={{ label: submitLabel, form: formId, disabled: isSubmitting }}
          secondary={onCancel ? [{ label: 'Откажи', onClick: onCancel }] : []}
        >
          {Object.keys(errors).length > 0 && (
            <p className="field__error" role="alert">
              Поправи отбелязаните полета.
            </p>
          )}
          {submitError !== undefined && submitError !== null && (
            <ErrorBox error={submitError} />
          )}
        </ActionBar>
      </form>
      {editing && editingRow && (
        <IngredientLineSheet
          row={editingRow}
          components={values.components}
          errors={ingredientRowErrors(errors, editingIndex)}
          onChange={(patch) => updateRow(editingRow.key, patch)}
          onSelect={(ingredient) =>
            updateRow(editingRow.key, selected(editingRow, ingredient))
          }
          onCreated={(ingredient) =>
            linkSameNewProduct(editingRow.key, ingredient)
          }
          onRemove={() => removeIngredient(editingRow.key)}
          onClose={closeIngredient}
        />
      )}
      {editingComponent && editingComponentValues && (
        <ComponentSheet
          component={editingComponentValues}
          errors={{
            name: errors[`components.${editingComponentIndex}.name`],
            servings: errors[`components.${editingComponentIndex}.servings`],
          }}
          onChange={(patch) =>
            updateComponent(editingComponentValues.key, patch)
          }
          onRemove={() => removeComponent(editingComponentValues.key)}
          onAdd={
            editingComponent.added ? () => setEditingComponent(null) : undefined
          }
          onClose={closeComponent}
        />
      )}
      {editingStep && editingStepValue && (
        <StepSheet
          number={stepIndex + 1}
          count={values.steps.length}
          text={editingStepValue.text}
          photoId={editingStepValue.photoId}
          error={errors[`steps.${stepIndex}`]}
          onChange={(text) =>
            set(
              'steps',
              values.steps.map((s, i) =>
                i === stepIndex ? { ...s, text } : s,
              ),
            )
          }
          onPhotoChange={(photoId) =>
            setValues((current) => ({
              ...current,
              steps: current.steps.map((s, i) =>
                i === stepIndex ? withPhoto(s, photoId) : s,
              ),
            }))
          }
          onMoveUp={() => moveStep(stepIndex, stepIndex - 1)}
          onMoveDown={() => moveStep(stepIndex, stepIndex + 1)}
          onRemove={() => removeStep(stepIndex)}
          onClose={closeStep}
        />
      )}
    </>
  );
}
