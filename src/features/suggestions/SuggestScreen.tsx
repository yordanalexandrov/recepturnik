import { Link, useNavigate } from '@tanstack/react-router';
import { RecentAiRequests } from '../ai/RecentAiRequests';
import { requestLabel } from './messages';
import { useRecentRequests, useRequestSuggestions } from './queries';
import { SuggestForm } from './SuggestForm';

/** `/recipes/suggest`: формата за заявка и последните заявки под нея. */
export function SuggestScreen() {
  const requestSuggestions = useRequestSuggestions();
  const recentRequests = useRecentRequests();
  const navigate = useNavigate();
  return (
    <main className="screen">
      <header className="screen__header">
        <h1>Предложения</h1>
        <Link to="/recipes">← Рецепти</Link>
      </header>
      <SuggestForm
        isSubmitting={requestSuggestions.isPending}
        submitError={requestSuggestions.error}
        onSubmit={(params) =>
          requestSuggestions.mutate(params, {
            onSuccess(request) {
              void navigate({
                to: '/recipes/suggest/$requestId',
                params: { requestId: request.id },
              });
            },
          })
        }
      />
      <RecentAiRequests
        title="Последни заявки"
        empty="Още няма заявки."
        requests={recentRequests}
        to="/recipes/suggest/$requestId"
        label={requestLabel}
      />
    </main>
  );
}
