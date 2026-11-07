import { Link, Outlet } from '@tanstack/react-router';

/**
 * Рамката на всеки екран: горна навигация и екранът под нея. На широк екран навигацията е ред от връзки до
 * заглавието; на тесен е компактна (`global.css`, границата е 48rem).
 */
export function Layout() {
  return (
    <div className="layout">
      <header className="topbar">
        <Link to="/recipes" className="topbar__brand">
          Рецептурник
        </Link>
        <nav className="topbar__nav" aria-label="Основна">
          <Link to="/recipes" activeOptions={{ exact: true }}>
            Рецепти
          </Link>
          <Link to="/recipes/import">Внеси</Link>
          <Link to="/recipes/suggest">Предложения</Link>
          <Link to="/recipes/new">Нова</Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
