import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { CommandPalette, type Command } from '../components/CommandPalette';
import { NotificationsBell } from '../components/NotificationsBell';

function Icon({ path, className = 'nav-icon' }: { path: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  tasks: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  projects: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  board: 'M4 4h5v16H4zm7 0h5v10h-5zm7 0h4v7h-4z',
  timeline: 'M3 6h13M3 12h9M3 18h5M19 6v12m0 0l-3-3m3 3l3-3',
  forms: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5',
  ai: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 17l.9 2.1L22 20l-2.1.9L19 23l-.9-2.1L16 20l2.1-.9z',
  reports: 'M3 3v18h18M8 17V9m4 8V5m4 12v-6',
  workload: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  automations: 'M13 2L3 14h9l-1 8 10-12h-9z',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 00-2.1-1.2L14.4 3h-4l-.4 2.6a7.5 7.5 0 00-2.1 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 000 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 002.1 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 002.1-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
};

const NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: ICONS.dashboard },
  { to: '/my-tasks', label: 'My Tasks', icon: ICONS.tasks },
  { to: '/projects', label: 'Projects', icon: ICONS.projects },
  { to: '/board', label: 'Board', icon: ICONS.board },
  { to: '/timeline', label: 'Timeline', icon: ICONS.timeline },
  { to: '/forms', label: 'Intake Forms', icon: ICONS.forms },
  { to: '/ai/tasks', label: 'AI Tasks', icon: ICONS.ai },
];

const ADMIN_NAV = [
  { to: '/reports', label: 'Reports', icon: ICONS.reports },
  { to: '/workload', label: 'Workload', icon: ICONS.workload },
  { to: '/automations', label: 'Automations', icon: ICONS.automations },
  { to: '/settings', label: 'Settings', icon: ICONS.settings },
];

type Theme = 'dark' | 'light';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('pm-theme');
    return stored === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pm-theme', theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggle];
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const navItems = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;
  const commands: Command[] = [
    ...navItems.map((item) => ({
      id: item.to,
      label: `Go to ${item.label}`,
      hint: 'Page',
      icon: <Icon path={item.icon} />,
      to: item.to,
    })),
    {
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      hint: 'Theme',
      icon: <Icon path={ICONS.settings} />,
      run: toggleTheme,
    },
    {
      id: 'sign-out',
      label: 'Sign out',
      hint: 'Account',
      icon: <Icon path={ICONS.workload} />,
      run: logout,
    },
  ];

  const initials = user?.displayName
    ?.split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
            <Icon path={item.icon} />
            {item.label}
          </NavLink>
        ))}
        {isAdmin ? (
          <>
            <div className="nav-section">Manage</div>
            {ADMIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                <Icon path={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </>
        ) : null}
        <div className="footer">v0.5 — Phase 5</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="kbd-hint"
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          >
            Search & jump… <kbd>Ctrl</kbd>
            <kbd>K</kbd>
          </button>
          <div className="user-pill">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <NotificationsBell />
            {user ? (
              <>
                <span className="avatar" aria-hidden="true">
                  {initials}
                </span>
                <span>{user.displayName}</span>
                <button type="button" className="logout" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : null}
          </div>
        </header>
        <main className="content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
      <CommandPalette commands={commands} />
    </div>
  );
}
