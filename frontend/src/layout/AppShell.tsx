import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotificationsBell } from '../components/NotificationsBell';
import { SearchBox } from '../components/SearchBox';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/my-tasks', label: 'My Tasks' },
  { to: '/projects', label: 'Projects' },
  { to: '/board', label: 'Board' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/forms', label: 'Intake Forms' },
  { to: '/ai/tasks', label: 'AI Tasks' },
];

const ADMIN_NAV = [
  { to: '/reports', label: 'Reports' },
  { to: '/workload', label: 'Workload' },
  { to: '/automations', label: 'Automations' },
  { to: '/settings', label: 'Settings' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

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
        {isAdmin
          ? ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                {item.label}
              </NavLink>
            ))
          : null}
        <div className="footer">v0.7 — Phase 7</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <SearchBox />
          <div className="user-pill">
            <NotificationsBell />
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
