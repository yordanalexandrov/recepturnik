import { useLocation } from '@tanstack/react-router';
import { failureKind } from '../api/client';

interface ErrorBoxProps {
  error: unknown;
  /** Показва „Опитай пак“, когато същата заявка може да мине (мрежа, 5xx, AI не е на разположение). */
  onRetry?: () => void;
}

/** Текстът за грешка, както го вижда човекът; ползвай го и за toast при неуспешно действие. */
export function errorText(error: unknown): string {
  switch (failureKind(error)) {
    case 'network':
      return 'Няма връзка със сървъра. Провери връзката и опитай пак.';
    case 'session_expired':
      return 'Сесията е изтекла. Влез отново, за да продължиш.';
    case 'ai_unavailable':
      return 'AI не е на разположение в момента. Опитай по-късно.';
    default:
      return error instanceof Error ? error.message : 'Нещо се обърка';
  }
}

/**
 * Грешката на екрана с действие според вида ѝ (`failureKind`): при изтекла сесия — „Влез отново“ (пълно зареждане на
 * страницата, Cloudflare Access показва входа); при мрежа, 5xx и недостъпен AI — „Опитай пак“, ако има `onRetry`.
 */
export function ErrorBox({ error, onRetry }: ErrorBoxProps) {
  const kind = failureKind(error);
  // Адресът на екрана: зареден наново, след входа човекът е пак тук.
  const href = useLocation({ select: (location) => location.href });
  return (
    <div className="error-box" role="alert">
      <p>{errorText(error)}</p>
      {kind === 'session_expired' ? (
        <a className="button" href={href}>
          Влез отново
        </a>
      ) : (
        kind !== 'client' &&
        onRetry && (
          <button type="button" className="button" onClick={onRetry}>
            Опитай пак
          </button>
        )
      )}
    </div>
  );
}
