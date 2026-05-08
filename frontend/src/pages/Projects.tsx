import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Project, ProjectStatus, User } from "../lib/types";
import { PROJECT_STATUS_LABEL } from "../lib/types";
import { ProjectStatusBadge } from "../components/Badges";
import { getCurrentUserId } from "../lib/currentUser";

export default function Projects() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", statusFilter],
    queryFn: () =>
      api.get<Project[]>(`/projects${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const createMut = useMutation({
    mutationFn: (data: { name: string; description?: string; ownerId?: string | null }) =>
      api.post<Project>("/projects", { ...data, createdById: getCurrentUserId() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setShowCreate(false);
    },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-brand hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded"
        >
          New Project
        </button>
      </div>
      <div className="flex gap-2">
        <input
          placeholder="Search projects…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-300 rounded px-3 py-1.5 text-sm bg-white flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | "")}
          className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">All statuses</option>
          {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Owner</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Tasks</th>
              <th className="text-left px-4 py-2 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">
                  <Link to={`/projects/${p.id}`} className="text-brand hover:underline font-medium">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{p.owner?.displayName ?? "—"}</td>
                <td className="px-4 py-2"><ProjectStatusBadge status={p.status} /></td>
                <td className="px-4 py-2 text-slate-600">{p._count?.tasks ?? 0}</td>
                <td className="px-4 py-2 text-slate-600">
                  {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No projects.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onSubmit={(d) => createMut.mutate(d)}
          isSubmitting={createMut.isPending}
        />
      )}
    </div>
  );
}

function CreateProjectDialog({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (d: { name: string; description?: string; ownerId?: string | null }) => void;
  isSubmitting: boolean;
}) {
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
        <h2 className="text-lg font-semibold">New Project</h2>
        <div className="space-y-3">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label="Owner">
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm bg-white"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={!name || isSubmitting}
            onClick={() =>
              onSubmit({
                name,
                description: description || undefined,
                ownerId: ownerId || null,
              })
            }
            className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
