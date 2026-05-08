import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Project, Task, User, Comment } from "../lib/types";
import { TASK_STATUSES, STATUS_LABEL } from "../lib/types";
import {
  DueBadge,
  PriorityBadge,
  ProjectStatusBadge,
  StatusBadge,
} from "../components/Badges";
import { getCurrentUserId } from "../lib/currentUser";

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [commentBody, setCommentBody] = useState("");

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: () => api.get<Task[]>(`/projects/${id}/tasks`),
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["project-comments", id],
    queryFn: () => api.get<Comment[]>(`/comments?projectId=${id}`),
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["project-activity", id],
    queryFn: () => api.get<{ id: string; action: string; createdAt: string; user?: { displayName: string } }[]>(
      `/projects/${id}/activity`,
    ),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });

  const addTaskMut = useMutation({
    mutationFn: (title: string) =>
      api.post<Task>("/tasks", {
        projectId: id,
        title,
        createdById: getCurrentUserId(),
      }),
    onSuccess: () => {
      setNewTaskTitle("");
      qc.invalidateQueries({ queryKey: ["project-tasks", id] });
    },
  });

  const addCommentMut = useMutation({
    mutationFn: (body: string) =>
      api.post("/comments", { projectId: id, userId: getCurrentUserId(), body }),
    onSuccess: () => {
      setCommentBody("");
      qc.invalidateQueries({ queryKey: ["project-comments", id] });
    },
  });

  if (!project) return <div className="p-6 text-sm">Loading…</div>;

  const tasksByStatus = TASK_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s) }),
    {} as Record<string, Task[]>,
  );

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
          </div>
          {project.description && (
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">{project.description}</p>
          )}
          <div className="text-xs text-slate-500 mt-2">
            Owner: {project.owner?.displayName ?? "—"}
            {project.dueDate && <> · Due {new Date(project.dueDate).toLocaleDateString()}</>}
          </div>
        </div>
      </header>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Tasks</h2>
        <div className="flex gap-2 mb-3">
          <input
            placeholder="Add a task…"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTaskTitle.trim()) {
                addTaskMut.mutate(newTaskTitle.trim());
              }
            }}
            className="border border-slate-300 rounded px-3 py-1.5 text-sm flex-1"
          />
          <button
            disabled={!newTaskTitle.trim() || addTaskMut.isPending}
            onClick={() => addTaskMut.mutate(newTaskTitle.trim())}
            className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            Add
          </button>
        </div>
        <div className="space-y-2">
          {TASK_STATUSES.map((s) => {
            const list = tasksByStatus[s] ?? [];
            if (list.length === 0) return null;
            return (
              <div key={s}>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{STATUS_LABEL[s]}</div>
                <ul className="divide-y divide-slate-100 border border-slate-100 rounded">
                  {list.map((t) => (
                    <li key={t.id} className="px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm">{t.title}</div>
                        <div className="text-xs text-slate-500">
                          {t.assignedTo?.displayName ?? "Unassigned"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <PriorityBadge priority={t.priority} />
                        <DueBadge dueDate={t.dueDate} />
                        <select
                          value={t.assignedToId ?? ""}
                          onChange={async (e) => {
                            await api.patch(`/tasks/${t.id}`, {
                              assignedToId: e.target.value || null,
                            });
                            qc.invalidateQueries({ queryKey: ["project-tasks", id] });
                          }}
                          className="border border-slate-300 rounded px-1.5 py-0.5 bg-white text-xs"
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.displayName}</option>
                          ))}
                        </select>
                        <StatusBadge status={t.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {tasks.length === 0 && (
            <div className="text-sm text-slate-500">No tasks yet.</div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Comments</h2>
          <ul className="space-y-3 mb-3">
            {comments.map((c) => (
              <li key={c.id} className="text-sm">
                <div className="font-medium text-slate-800">{c.user?.displayName ?? "Someone"}</div>
                <div className="text-slate-600 whitespace-pre-wrap">{c.body}</div>
                <div className="text-xs text-slate-400">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
            {comments.length === 0 && <li className="text-sm text-slate-500">No comments yet.</li>}
          </ul>
          <div className="flex gap-2">
            <textarea
              placeholder="Add a comment…"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={2}
              className="flex-1 border border-slate-300 rounded px-3 py-1.5 text-sm"
            />
            <button
              disabled={!commentBody.trim() || addCommentMut.isPending}
              onClick={() => addCommentMut.mutate(commentBody.trim())}
              className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded self-start"
            >
              Post
            </button>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Activity</h2>
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="text-xs text-slate-600">
                <span className="text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>{" "}
                <span className="font-medium text-slate-700">{a.user?.displayName ?? "system"}</span>{" "}
                {a.action}
              </li>
            ))}
            {activity.length === 0 && <li className="text-sm text-slate-500">No activity yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
