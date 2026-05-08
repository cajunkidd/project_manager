import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ProjectStatus, Task, User } from "../lib/types";
import { PROJECT_STATUS_LABEL } from "../lib/types";
import { DueBadge, PriorityBadge } from "../components/Badges";
import { useTaskOpener } from "../lib/openTask";

interface TasksByUser {
  rows: { assignedToId: string | null; status: string; _count: { _all: number } }[];
  users: User[];
}
interface StatusRow { status: ProjectStatus; _count: { _all: number } }
interface WeekRow { weekStart: string; count: number }
interface AvgRow { count: number; avgMs: number; avgDays: number }

export default function Reports() {
  const tasksByUser = useQuery({
    queryKey: ["report:tasks-by-user"],
    queryFn: () => api.get<TasksByUser>("/reports/tasks-by-user"),
  });
  const overdue = useQuery({
    queryKey: ["report:overdue"],
    queryFn: () => api.get<Task[]>("/reports/overdue"),
  });
  const projectsByStatus = useQuery({
    queryKey: ["report:projects-by-status"],
    queryFn: () => api.get<StatusRow[]>("/reports/projects-by-status"),
  });
  const completedByWeek = useQuery({
    queryKey: ["report:completed-by-week"],
    queryFn: () => api.get<WeekRow[]>("/reports/completed-by-week?weeks=8"),
  });
  const avgCompletion = useQuery({
    queryKey: ["report:avg-completion"],
    queryFn: () => api.get<AvgRow>("/reports/avg-completion-time?days=90"),
  });
  const blocked = useQuery({
    queryKey: ["report:blocked"],
    queryFn: () => api.get<Task[]>("/reports/blocked"),
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat
          label="Avg completion (last 90d)"
          value={avgCompletion.data ? `${avgCompletion.data.avgDays} days` : "—"}
          sub={avgCompletion.data ? `${avgCompletion.data.count} tasks` : undefined}
        />
        <Stat label="Overdue tasks" value={overdue.data?.length ?? "—"} tone="rose" />
        <Stat label="Blocked / waiting" value={blocked.data?.length ?? "—"} tone="amber" />
      </div>

      <Card title="Open tasks by user">
        {tasksByUser.data && (
          <TasksByUserTable data={tasksByUser.data} />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Projects by status">
          {projectsByStatus.data && <ProjectsByStatus rows={projectsByStatus.data} />}
        </Card>
        <Card title="Tasks completed by week">
          {completedByWeek.data && <CompletedByWeek rows={completedByWeek.data} />}
        </Card>
      </div>

      <Card title="Overdue">
        {overdue.data && <TaskList tasks={overdue.data} empty="No overdue tasks." />}
      </Card>

      <Card title="Blocked / Waiting">
        {blocked.data && <TaskList tasks={blocked.data} empty="No blocked tasks." />}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "slate" | "rose" | "amber";
}) {
  const toneCls =
    tone === "rose"
      ? "text-rose-700"
      : tone === "amber"
      ? "text-amber-700"
      : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function TasksByUserTable({ data }: { data: TasksByUser }) {
  const userMap = new Map(data.users.map((u) => [u.id, u.displayName]));
  const byUser = new Map<string, Map<string, number>>();
  for (const r of data.rows) {
    const key = r.assignedToId ?? "__unassigned__";
    if (!byUser.has(key)) byUser.set(key, new Map());
    byUser.get(key)!.set(r.status, r._count._all);
  }
  const statuses = ["backlog", "to_do", "in_progress", "waiting", "review"];
  const rows = [...byUser.entries()];
  if (rows.length === 0) {
    return <div className="text-sm text-slate-500">No open tasks.</div>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-slate-600 text-left">
        <tr>
          <th className="py-1 font-medium">User</th>
          {statuses.map((s) => (
            <th key={s} className="py-1 font-medium px-2">
              {s.replace("_", " ")}
            </th>
          ))}
          <th className="py-1 font-medium px-2">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map(([uid, m]) => {
          const total = [...m.values()].reduce((a, b) => a + b, 0);
          return (
            <tr key={uid}>
              <td className="py-1.5">
                {uid === "__unassigned__" ? (
                  <span className="text-slate-400">Unassigned</span>
                ) : (
                  userMap.get(uid) ?? uid
                )}
              </td>
              {statuses.map((s) => (
                <td key={s} className="py-1.5 px-2 text-slate-600">{m.get(s) ?? 0}</td>
              ))}
              <td className="py-1.5 px-2 font-medium">{total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ProjectsByStatus({ rows }: { rows: StatusRow[] }) {
  const total = rows.reduce((a, r) => a + r._count._all, 0) || 1;
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = Math.round((r._count._all / total) * 100);
        return (
          <li key={r.status}>
            <div className="flex justify-between text-sm">
              <span>{PROJECT_STATUS_LABEL[r.status]}</span>
              <span className="text-slate-600">{r._count._all}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded">
              <div className="h-2 bg-brand rounded" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
      {rows.length === 0 && <li className="text-sm text-slate-500">No projects.</li>}
    </ul>
  );
}

function CompletedByWeek({ rows }: { rows: WeekRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex items-end gap-2 h-32">
      {rows.map((r) => {
        const h = Math.round((r.count / max) * 100);
        return (
          <div key={r.weekStart} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="text-xs text-slate-600">{r.count}</div>
            <div
              className="w-full bg-brand rounded-t"
              style={{ height: `${h}%`, minHeight: r.count > 0 ? 4 : 0 }}
            />
            <div className="text-[10px] text-slate-500">
              {new Date(r.weekStart).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  const { open } = useTaskOpener();
  if (tasks.length === 0)
    return <div className="text-sm text-slate-500">{empty}</div>;
  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((t) => (
        <li key={t.id} className="py-2 flex items-center justify-between gap-3">
          <button
            onClick={() => open(t.id)}
            className="text-sm text-left hover:underline truncate"
          >
            {t.title}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">
              {t.assignedTo?.displayName ?? "Unassigned"}
            </span>
            <PriorityBadge priority={t.priority} />
            <DueBadge dueDate={t.dueDate} />
          </div>
        </li>
      ))}
    </ul>
  );
}
