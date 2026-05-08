import type { Priority, TaskStatus, ProjectStatus } from "../lib/types";

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "bg-slate-100 text-slate-700",
  to_do: "bg-blue-100 text-blue-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  waiting: "bg-amber-100 text-amber-800",
  review: "bg-purple-100 text-purple-700",
  done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-500 line-through",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-rose-100 text-rose-700",
};

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  not_started: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-slate-200 text-slate-500",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority]}`}
    >
      {priority}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${PROJECT_STATUS_COLORS[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function DueBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const overdue = due < now;
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
        overdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {overdue ? "Overdue " : "Due "}
      {due.toLocaleDateString()}
    </span>
  );
}
