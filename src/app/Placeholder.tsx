/** Временен екран за път, чийто екран идва в следваща задача. Махни го, когато няма път, който го ползва. */
export function Placeholder({ title }: { title: string }) {
  return (
    <main className="screen">
      <h1>{title}</h1>
      <p>Още не е готово.</p>
    </main>
  );
}
