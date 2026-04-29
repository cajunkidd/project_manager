import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, FolderKanban, Kanban, GanttChartSquare,
  ClipboardList, BarChart3, Users2, Zap, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-tasks', icon: CheckSquare, label: 'My Tasks' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/board', icon: Kanban, label: 'Board' },
  { to: '/timeline', icon: GanttChartSquare, label: 'Timeline' },
  { to: '/forms', icon: ClipboardList, label: 'Intake Forms' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/workload', icon: Users2, label: 'Workload' },
  { to: '/automations', icon: Zap, label: 'Automations' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="flex w-60 flex-col border-r bg-slate-900 text-slate-100">
      <div className="flex h-16 items-center border-b border-slate-700 px-6">
        <span className="text-lg font-bold tracking-tight text-white">ProjectHub</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-slate-700 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {user?.displayName?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.displayName}</p>
            <p className="truncate text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
