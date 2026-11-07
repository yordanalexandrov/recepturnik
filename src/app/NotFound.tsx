import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <main className="screen">
      <h1>Няма такава страница</h1>
      <p>
        <Link to="/recipes">Към рецептите</Link>
      </p>
    </main>
  );
}
