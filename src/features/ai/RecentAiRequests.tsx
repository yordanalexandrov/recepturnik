import type { ContractRequestStatus } from '@family/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useId } from 'react';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { formatRequestTime, REQUEST_STATUS_LABELS } from './ai-requests';

/** Полетата на AI заявка, които списъкът показва. */
interface ListedRequest {
  id: string;
  status: ContractRequestStatus;
  createdAt: string;
}

interface RecentAiRequestsProps<T extends ListedRequest> {
  /** Заглавието на региона, напр. „Последни внасяния“. */
  title: string;
  /** Текстът без заявки, напр. „Още няма внасяния.“ */
  empty: string;
  requests: UseQueryResult<T[]>;
  /** Екранът на една заявка. */
  to: '/recipes/import/$requestId' | '/recipes/suggest/$requestId';
  label: (request: T) => string;
}

/** Регионът с последните AI заявки (внасяния, заявки за предложения), за да се върне човек към стара. */
export function RecentAiRequests<T extends ListedRequest>({
  title,
  empty,
  requests,
  to,
  label,
}: RecentAiRequestsProps<T>) {
  const headingId = useId();
  return (
    <section className="recent" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {requests.isPending ? (
        <Spinner />
      ) : requests.isError ? (
        <ErrorBox
          error={requests.error}
          onRetry={() => void requests.refetch()}
        />
      ) : requests.data.length === 0 ? (
        <p className="recipes__empty">{empty}</p>
      ) : (
        <ul className="recent__list">
          {requests.data.map((request) => (
            <li key={request.id}>
              <Link
                to={to}
                params={{ requestId: request.id }}
                className="recent__link"
              >
                <span>{label(request)}</span>
                <span className="badge">
                  {REQUEST_STATUS_LABELS[request.status]}
                </span>
                <span className="recent__date">
                  {formatRequestTime(request.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
