export function Spinner({ label = 'Зарежда се…' }: { label?: string }) {
  return (
    <p className="spinner" role="status">
      {label}
    </p>
  );
}
