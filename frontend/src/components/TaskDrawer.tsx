import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Comment, Priority, Task, TaskStatus, User } from "../lib/types";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_STATUSES,
} from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";
import { DueBadge, PriorityBadge, StatusBadge } from "./Badges";

interface ActivityRow {
  id: string;
  action: string;
  createdAt: string;
  oldValue: unknown;
  newValue: unknown;
  user?: { displayName: string } | null;
}

const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export default function TaskDrawer({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [taskId, onClose]);

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.get<Task>(`/tasks/${taskId}`),
    enabled: !!taskId,
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => api.get<Comment[]>(`/comments?taskId=${taskId}`),
    enabled: !!taskId,
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["task-activity", taskId],
    queryFn: () => api.get<ActivityRow[]>(`/tasks/${taskId}/activity`),
    enabled: !!taskId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["task", taskId] });
    qc.invalidateQueries({ queryKey: ["task-activity", taskId] });
    qc.invalidateQueries({ queryKey: ["board-tasks"] });
    qc.invalidateQueries({ queryKey: ["project-tasks"] });
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const patchMut = useMutation({
    mutationFn: (patch: Partial<Task>) => api.patch<Task>(`/tasks/${taskId}`, patch),
    onSuccess: invalidateAll,
  });

  const addSubtaskMut = useMutation({
    mutationFn: (title: string) =>
      api.post<Task>("/tasks", {
        projectId: task!.projectId,
        parentTaskId: task!.id,
        title,
        createdById: getCurrentUserId(),
      }),
    onSuccess: invalidateAll,
  });

  const addCommentMut = useMutation({
    mutationFn: (body: string) =>
      api.post("/comments", { taskId, userId: getCurrentUserId(), body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/tasks/${taskId}`),
    onSuccess: () => {
      invalidateAll();
      onClose();
    },
  });

  if (!taskId) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl border-l border-slate-200 overflow-y-auto">
        {!task ? (
          <div className="p-6 text-sm text-slate-600">Loading…</div>
        ) : (
          <div className="p-5 space-y-5">
            <header className="flex items-start justify-between gap-3">
              <input
                value={task.title}
                onChange={(e) => patchMut.mutate({ title: e.target.value })}
                className="text-lg font-semibold w-full border-0 focus:ring-0 focus:outline-none p-0"
              />
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </header>

            <div className="text-xs text-slate-500">
              {task.project?.name}{" "}
              <span className="ml-2 inline-flex gap-1 align-middle">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                <DueBadge dueDate={task.dueDate} />
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FieldSelect
                label="Status"
                value={task.status}
                options={TASK_STATUSES.map((s) => [s, STATUS_LABEL[s]])}
                onChange={(v) => patchMut.mutate({ status: v as TaskStatus })}
              />
              <FieldSelect
                label="Priority"
                value={task.priority}
                options={PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]])}
                onChange={(v) => patchMut.mutate({ priority: v as Priority })}
              />
              <FieldSelect
                label="Assignee"
                value={task.assignedToId ?? ""}
                options={[["", "Unassigned"], ...users.map((u) => [u.id, u.displayName] as [string, string])]}
                onChange={(v) => patchMut.mutate({ assignedToId: v || null })}
              />
              <FieldDate
                label="Due date"
                value={task.dueDate}
                onChange={(v) => patchMut.mutate({ dueDate: v })}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Description</label>
              <textarea
                key={task.id}
                defaultValue={task.description ?? ""}
                onBlur={(e) =>
                  e.target.value !== (task.description ?? "") &&
                  patchMut.mutate({ description: e.target.value })
                }
                rows={4}
                className="mt-1 w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
                placeholder="Add a description…"
              />
            </div>

            <Subtasks task={task} onAdd={(t) => addSubtaskMut.mutate(t)} />

            <Section title="Comments">
              <ul className="space-y-2 mb-2">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="font-medium text-slate-800">
                      {c.user?.displayName ?? "Someone"}
                    </div>
                    <div className="text-slate-600 whitespace-pre-wrap">{c.body}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
                {comments.length === 0 && (
                  <li className="text-sm text-slate-500">No comments yet.</li>
                )}
              </ul>
              <CommentBox
                disabled={addCommentMut.isPending}
                onSubmit={(body) => addCommentMut.mutate(body)}
              />
            </Section>

            <Section title="Activity">
              <ul className="space-y-1">
                {activity.map((a) => (
                  <li key={a.id} className="text-xs text-slate-600">
                    <span className="text-slate-400">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>{" "}
                    <span className="font-medium text-slate-700">
                      {a.user?.displayName ?? "system"}
                    </span>{" "}
                    {a.action}
                  </li>
                ))}
                {activity.length === 0 && (
                  <li className="text-sm text-slate-500">No activity yet.</li>
                )}
              </ul>
            </Section>

            <footer className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  if (confirm("Delete this task?")) deleteMut.mutate();
                }}
                className="text-sm text-rose-600 hover:text-rose-700"
              >
                Delete task
              </button>
            </footer>
          </div>
        )}
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
    </label>
  );
}

function FieldDate({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const dateValue = value ? new Date(value).toISOString().slice(0, 10) : "";
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="date"
        value={dateValue}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
      />
    </label>
  );
}

function Subtasks({
  task,
  onAdd,
}: {
  task: Task;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const subs = task.subtasks ?? [];
  if (task.parentTaskId) return null; // don't nest deeper
  return (
    <Section title={`Subtasks (${subs.length})`}>
      <ul className="space-y-1 mb-2">
        {subs.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between text-sm border border-slate-100 rounded px-2 py-1"
          >
            <span>{s.title}</span>
            <span className="flex items-center gap-1">
              <PriorityBadge priority={s.priority} />
              <StatusBadge status={s.status} />
            </span>
          </li>
        ))}
        {subs.length === 0 && <li className="text-sm text-slate-500">No subtasks.</li>}
      </ul>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a subtask…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              onAdd(title.trim());
              setTitle("");
            }
          }}
          className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm"
        />
        <button
          disabled={!title.trim()}
          onClick={() => {
            onAdd(title.trim());
            setTitle("");
          }}
          className="bg-slate-100 hover:bg-slate-200 text-sm px-2 py-1 rounded disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </Section>
  );
}

function CommentBox({
  onSubmit,
  disabled,
}: {
  onSubmit: (body: string) => void;
  disabled?: boolean;
}) {
  const [body, setBody] = useState("");
  return (
    <div className="flex gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Add a comment…"
        className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm"
      />
      <button
        disabled={!body.trim() || disabled}
        onClick={() => {
          onSubmit(body.trim());
          setBody("");
        }}
        className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded self-start"
      >
        Post
      </button>
    </div>
  );
}
