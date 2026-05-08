import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/my-tasks', label: 'My Tasks' },
  { to: '/projects', label: 'Projects' },
  { to: '/board', label: 'Board' },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Project Manager</h1>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {item.label}
          </NavLink>
        ))}
        <div className="footer">v0.1 — internal MVP</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="muted">Internal Project Management</div>
          <div className="user-pill">
            {user ? (
              <>
                <span>{user.displayName}</span>
                <button type="button" className="logout" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : null}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
