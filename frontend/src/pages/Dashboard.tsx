import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Task } from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";
import { DueBadge, PriorityBadge, StatusBadge } from "../components/Badges";

interface DashboardData {
  open: Task[];
  overdue: Task[];
  dueThisWeek: Task[];
  recent: Task[];
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0)
    return <div className="text-sm text-slate-500">{empty}</div>;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id} className="py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 truncate">{t.title}</div>
            <div className="text-xs text-slate-500">
              {t.project ? (
                <Link to={`/projects/${t.project.id}`} className="hover:underline">
                  {t.project.name}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PriorityBadge priority={t.priority} />
            <StatusBadge status={t.status} />
            <DueBadge dueDate={t.dueDate} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());
  useEffect(() => {
    const handler = () => setUserId(getCurrentUserId());
    window.addEventListener("pm:user-changed", handler);
    return () => window.removeEventListener("pm:user-changed", handler);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => api.get<DashboardData>(`/dashboard/me?userId=${userId ?? ""}`),
    enabled: !!userId,
  });

  if (!userId) {
    return <div className="p-6 text-sm text-slate-600">Pick a user to view the dashboard.</div>;
  }
  if (isLoading || !data) return <div className="p-6 text-sm text-slate-600">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Overdue" count={data.overdue.length}>
          <TaskList tasks={data.overdue} empty="No overdue tasks. Nice." />
        </Card>
        <Card title="Due this week" count={data.dueThisWeek.length}>
          <TaskList tasks={data.dueThisWeek} empty="Nothing due this week." />
        </Card>
        <Card title="My open tasks" count={data.open.length}>
          <TaskList tasks={data.open.slice(0, 8)} empty="No open work." />
        </Card>
        <Card title="Recent activity" count={data.recent.length}>
          <TaskList tasks={data.recent.slice(0, 8)} empty="No recent updates." />
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {typeof count === "number" && (
          <span className="text-xs text-slate-500">{count}</span>
        )}
      </header>
      {children}
    </section>
  );
}
