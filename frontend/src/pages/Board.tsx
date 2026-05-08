import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Priority, Project, Task, TaskStatus, User } from "../lib/types";
import { TASK_STATUSES, STATUS_LABEL, PRIORITY_LABEL } from "../lib/types";
import { DueBadge, PriorityBadge } from "../components/Badges";
import { useTaskOpener } from "../lib/openTask";

const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export default function Board() {
  const qc = useQueryClient();
  const { open: openTask } = useTaskOpener();
  const [projectId, setProjectId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [priority, setPriority] = useState<Priority | "">("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-all"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["board-tasks", projectId, assigneeId, priority],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (projectId) qs.set("projectId", projectId);
      if (assigneeId) qs.set("assignedToId", assigneeId);
      if (priority) qs.set("priority", priority);
      const s = qs.toString();
      return api.get<Task[]>(`/tasks${s ? `?${s}` : ""}`);
    },
  });

  const columns = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [], to_do: [], in_progress: [], waiting: [], review: [], done: [], cancelled: [],
    };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  async function moveTask(id: string, status: TaskStatus) {
    await api.patch(`/tasks/${id}/status`, { status });
    qc.invalidateQueries({ queryKey: ["board-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Board</h1>
        <div className="flex items-center gap-2">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">All assignees</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority | "")}
            className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {TASK_STATUSES.map((s) => (
          <Column
            key={s}
            status={s}
            tasks={columns[s]}
            onDrop={(taskId) => moveTask(taskId, s)}
            onOpen={openTask}
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  status,
  tasks,
  onDrop,
  onOpen,
}: {
  status: TaskStatus;
  tasks: Task[];
  onDrop: (taskId: string) => void;
  onOpen: (taskId: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("text/plain");
        setOver(false);
        if (id) onDrop(id);
      }}
      className={`bg-slate-100 rounded-lg p-2 min-h-[24rem] transition-colors ${
        over ? "bg-brand-subtle outline outline-2 outline-brand" : ""
      }`}
    >
      <div className="px-2 py-1 mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {STATUS_LABEL[status]}
        </h3>
        <span className="text-xs text-slate-500">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <Card key={t.id} task={t} onOpen={() => onOpen(t.id)} />
        ))}
      </div>
    </div>
  );
}

function Card({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const overdue =
    !!task.dueDate &&
    task.status !== "done" &&
    task.status !== "cancelled" &&
    new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={onOpen}
      className={`bg-white border rounded p-2 shadow-sm cursor-pointer hover:border-slate-300 ${
        overdue ? "border-rose-300" : "border-slate-200"
      }`}
    >
      <div className="text-sm font-medium text-slate-900">{task.title}</div>
      <div className="text-xs text-slate-500 mt-1">
        {task.project?.name ?? ""}
        {task.assignedTo ? ` · ${task.assignedTo.displayName}` : ""}
      </div>
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        <PriorityBadge priority={task.priority} />
        <DueBadge dueDate={task.dueDate} />
      </div>
    </div>
  );
}
