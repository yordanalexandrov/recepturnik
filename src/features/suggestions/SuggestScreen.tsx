import { Link, useNavigate } from '@tanstack/react-router';
import { useRequestSuggestions } from './queries';
import { RecentRequests } from './RecentRequests';
import { SuggestForm } from './SuggestForm';

/** `/recipes/suggest`: формата за заявка и последните заявки под нея. */
export function SuggestScreen() {
  const requestSuggestions = useRequestSuggestions();
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
      <RecentRequests />
    </main>
  );
}
