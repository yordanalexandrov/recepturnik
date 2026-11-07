import type { ReactNode } from 'react';

export type Action = {
  label: string;
  disabled?: boolean;
} & (
  | { onClick: () => void; form?: never }
  | {
      /** Бутонът праща формата с това `id` (и е неин по подразбиране: Enter в поле я праща през него). */
      form: string;
      onClick?: never;
    }
);

interface ActionBarProps {
  primary: Action;
  /** Тихите действия преди основното, напр. „Откажи“. */
  secondary?: readonly Action[];
  /** Кратко пояснение до действията, напр. „3 продукта за свързване“. */
  text?: string | undefined;
  /** Съобщение над действията, напр. грешка от записа. */
  children?: ReactNode;
}

/**
 * Лента с основното действие на екрана, последна в съдържанието му; на телефона залепва за долния край. По `ActionBar`
 * на family.
 */
export function ActionBar({
  primary,
  secondary = [],
  text,
  children,
}: ActionBarProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: група бутони, не полета на форма.
    <div className="action-bar" role="group" aria-label="Действия">
      {children && <div className="action-bar__message">{children}</div>}
      {text && <p className="action-bar__text">{text}</p>}
      <div className="action-bar__actions">
        {secondary.map((action) => (
          <ActionButton key={action.label} action={action} quiet />
        ))}
        <ActionButton action={primary} />
      </div>
    </div>
  );
}

function ActionButton({ action, quiet }: { action: Action; quiet?: boolean }) {
  return (
    <button
      type={action.form === undefined ? 'button' : 'submit'}
      form={action.form}
      className={quiet ? 'button button--quiet' : 'button'}
      onClick={action.onClick}
      disabled={action.disabled}
    >
      {action.label}
    </button>
  );
}
