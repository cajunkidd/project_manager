import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Task, TaskStatus } from "../lib/types";
import { TASK_STATUSES, STATUS_LABEL } from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";
import { DueBadge, PriorityBadge } from "../components/Badges";
import TaskDrawer from "../components/TaskDrawer";

export default function MyTasks() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  useEffect(() => {
    const handler = () => setUserId(getCurrentUserId());
    window.addEventListener("pm:user-changed", handler);
    return () => window.removeEventListener("pm:user-changed", handler);
  }, []);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["my-tasks", userId],
    queryFn: () => api.get<Task[]>(`/tasks?assignedToId=${userId ?? ""}`),
    enabled: !!userId,
  });

  async function setStatus(id: string, status: TaskStatus) {
    await api.patch(`/tasks/${id}/status`, { status });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  if (!userId) return <div className="p-6 text-sm">Pick a user.</div>;
  if (isLoading) return <div className="p-6 text-sm">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">My Tasks</h1>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Task</th>
              <th className="text-left px-4 py-2 font-medium">Project</th>
              <th className="text-left px-4 py-2 font-medium">Priority</th>
              <th className="text-left px-4 py-2 font-medium">Due</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <button
                    onClick={() => setOpenTaskId(t.id)}
                    className="text-left hover:underline"
                  >
                    {t.title}
                  </button>
                </td>
                <td className="px-4 py-2">
                  {t.project ? (
                    <Link to={`/projects/${t.project.id}`} className="text-brand hover:underline">
                      {t.project.name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2"><PriorityBadge priority={t.priority} /></td>
                <td className="px-4 py-2"><DueBadge dueDate={t.dueDate} /></td>
                <td className="px-4 py-2">
                  <select
                    value={t.status}
                    onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                    className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No tasks assigned.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {tasks.length > 0 && (
        <div className="text-xs text-slate-500">
          Showing {tasks.length} task{tasks.length === 1 ? "" : "s"}.
        </div>
      )}
      <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </div>
  );
}
