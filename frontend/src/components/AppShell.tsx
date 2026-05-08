import { NavLink, Outlet } from "react-router-dom";
import UserSwitcher from "./UserSwitcher";
import NotificationBell from "./NotificationBell";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/my-tasks", label: "My Tasks" },
  { to: "/projects", label: "Projects" },
  { to: "/board", label: "Board" },
  { to: "/settings", label: "Settings" },
];

export default function AppShell() {
  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white">
        <div className="px-4 py-5 border-b border-slate-200">
          <div className="text-lg font-semibold text-slate-900">Project Manager</div>
          <div className="text-xs text-slate-500">Internal MVP</div>
        </div>
        <nav className="p-2 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-brand-subtle text-brand"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="text-sm text-slate-500">Internal Project Management</div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserSwitcher />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
