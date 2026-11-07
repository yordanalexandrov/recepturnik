import { Link } from '@tanstack/react-router';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import {
  formatRequestTime,
  REQUEST_STATUS_LABELS,
  requestLabel,
} from './messages';
import { useRecentRequests } from './queries';

/** Последните заявки, за да се върне човек към стара. */
export function RecentRequests() {
  const requests = useRecentRequests();
  return (
    <section className="suggestions__recent" aria-label="Последни заявки">
      <h2>Последни заявки</h2>
      {requests.isPending ? (
        <Spinner />
      ) : requests.isError ? (
        <ErrorBox
          error={requests.error}
          onRetry={() => void requests.refetch()}
        />
      ) : requests.data.length === 0 ? (
        <p className="muted">Още няма заявки.</p>
      ) : (
        <ul className="suggestions__recent-list">
          {requests.data.map((request) => (
            <li key={request.id}>
              <Link
                to="/recipes/suggest/$requestId"
                params={{ requestId: request.id }}
              >
                {requestLabel(request)}{' '}
                <span className="badge">
                  {REQUEST_STATUS_LABELS[request.status]}
                </span>{' '}
                <span className="muted">
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
