import type {
  SuggestionRequest,
  SuggestionRequestDetail,
} from '@family/shared';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ErrorBox } from '../../components/ErrorBox';
import { Spinner } from '../../components/Spinner';
import { failureMessage, requestLabel } from './messages';
import {
  paramsOf,
  useRequestSuggestions,
  useSuggestionRequest,
} from './queries';
import { SuggestionCard } from './SuggestionCard';

const ROUTE = '/recipes/suggest/$requestId';

/** `/recipes/suggest/:requestId`: изчакване, докато е `pending`, после предложенията или грешката. */
export function SuggestionRequestView() {
  const { requestId } = useParams({ from: ROUTE });
  const detail = useSuggestionRequest(requestId);
  return (
    <main className="screen">
      <header className="screen__header">
        <h1>Предложения</h1>
        <Link to="/recipes/suggest">← Нова заявка</Link>
      </header>
      {detail.isPending ? (
        <Spinner />
      ) : detail.isError ? (
        <ErrorBox error={detail.error} onRetry={() => void detail.refetch()} />
      ) : (
        <RequestResult detail={detail.data} />
      )}
    </main>
  );
}

function RequestResult({ detail }: { detail: SuggestionRequestDetail }) {
  const { request, suggestions } = detail;
  if (request.status === 'pending') {
    return (
      <div className="suggestions__waiting">
        <Spinner label="Изчакване…" />
        <p>Търся рецепти… обикновено отнема до минута</p>
        <p className="muted">Търсено: {requestLabel(request)}</p>
      </div>
    );
  }
  if (request.status === 'failed') {
    return <RequestFailed request={request} />;
  }
  return (
    <>
      <p className="muted">Търсено: {requestLabel(request)}</p>
      <ul className="suggestion-cards">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <SuggestionCard suggestion={suggestion} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Защо заявката е неуспешна и „Опитай пак“: нова заявка със същия вход. */
function RequestFailed({ request }: { request: SuggestionRequest }) {
  const retry = useRequestSuggestions();
  const navigate = useNavigate();
  return (
    <>
      <div className="error-box" role="alert">
        <p>{failureMessage(request)}</p>
        <p className="muted">Търсено: {requestLabel(request)}</p>
        <button
          type="button"
          className="button"
          disabled={retry.isPending}
          onClick={() =>
            retry.mutate(paramsOf(request), {
              onSuccess(next) {
                void navigate({
                  to: '/recipes/suggest/$requestId',
                  params: { requestId: next.id },
                });
              },
            })
          }
        >
          Опитай пак
        </button>
      </div>
      {retry.isError && <ErrorBox error={retry.error} />}
    </>
  );
}
