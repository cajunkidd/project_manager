import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotificationsBell } from '../components/NotificationsBell';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/my-tasks', label: 'My Tasks' },
  { to: '/projects', label: 'Projects' },
  { to: '/board', label: 'Board' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/forms', label: 'Intake Forms' },
  { to: '/ai/tasks', label: 'AI Tasks' },
  // Settings is visible to every authenticated user so they can manage their
  // own integrations and so the workspace owner can claim the master role
  // before any admin exists.
  { to: '/settings', label: 'Settings' },
];

const ADMIN_NAV = [
  { to: '/reports', label: 'Reports' },
  { to: '/workload', label: 'Workload' },
  { to: '/automations', label: 'Automations' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const isAdmin =
    user?.role === 'master' || user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/stine-logo.svg" alt="Stine" className="brand-logo" />
          <div className="brand-sub">Project Manager</div>
        </div>
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
        <div className="footer">v0.5 — Phase 5</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="muted">Stine — Internal Project Management</div>
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
