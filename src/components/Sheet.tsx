import { type ReactNode, useEffect, useRef } from 'react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Фокусът при отваряне отива на първото поле в листа (за писане веднага), а не на „Готово“. */
  focusField?: boolean;
  /** Надписът на бутона в заглавието; „Затвори“, когато затварянето е отказ (напр. нов компонент без „Добави“). */
  closeLabel?: string;
  /** По-широк прозорец на широк екран, за съдържание в колони (напр. сравнението на рецепти). */
  wide?: boolean;
}

const FIELD = 'input:not([disabled]), textarea:not([disabled]), select';

/**
 * Лист върху екрана (на телефон отдолу): „Готово“ в заглавието, Escape и фонът го затварят. Фокусът отива на „Готово“
 * (или на първото поле с `focusField`) при отваряне и се връща там, откъдето листът е отворен, при затваряне.
 * По-прост от листа на family: без плъзгане и без запис в историята.
 */
export function Sheet({
  title,
  onClose,
  children,
  focusField,
  closeLabel = 'Готово',
  wide = false,
}: SheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Само при отваряне: ново изобразяване на родителя не мести фокуса.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `focusField` се чете при отваряне.
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const field = focusField
      ? panelRef.current?.querySelector<HTMLElement>(FIELD)
      : null;
    (field ?? closeRef.current)?.focus();
    return () => {
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet">
      <button
        type="button"
        className="sheet__backdrop"
        aria-label="Затвори"
        tabIndex={-1}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        className={wide ? 'sheet__panel sheet__panel--wide' : 'sheet__panel'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="sheet__header">
          <h2>{title}</h2>
          <button
            ref={closeRef}
            type="button"
            className="button button--quiet"
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
