import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { IntakeForm } from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";

export default function Forms() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const { data: forms = [] } = useQuery({
    queryKey: ["forms"],
    queryFn: () => api.get<IntakeForm[]>("/forms"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<IntakeForm>("/forms", {
        name,
        createdById: getCurrentUserId(),
        fields: [],
      }),
    onSuccess: (form) => {
      setName("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["forms"] });
      window.location.href = `/forms/${form.id}/edit`;
    },
  });

  const active = forms.filter((f) => f.isActive);
  const inactive = forms.filter((f) => !f.isActive);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Intake Forms</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-brand hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded"
        >
          New form
        </button>
      </div>

      <FormGrid title="Available" forms={active} emptyMsg="No active forms yet." />
      {inactive.length > 0 && (
        <FormGrid title="Inactive" forms={inactive} emptyMsg="" muted />
      )}

      {creating && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="text-lg font-semibold">New form</h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT Request"
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-sm rounded hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!name || create.isPending}
                onClick={() => create.mutate()}
                className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
              >
                Create &amp; configure
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormGrid({
  title,
  forms,
  emptyMsg,
  muted,
}: {
  title: string;
  forms: IntakeForm[];
  emptyMsg: string;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 mb-2">{title}</h2>
      {forms.length === 0 ? (
        <div className="text-sm text-slate-500">{emptyMsg}</div>
      ) : (
        <ul className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${muted ? "opacity-60" : ""}`}>
          {forms.map((f) => (
            <li
              key={f.id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    to={`/forms/${f.id}`}
                    className="text-sm font-semibold text-slate-900 hover:underline"
                  >
                    {f.name}
                  </Link>
                  {f.description && (
                    <p className="text-xs text-slate-600 mt-0.5">{f.description}</p>
                  )}
                </div>
                <Link
                  to={`/forms/${f.id}/edit`}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Edit
                </Link>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-3">
                <span>{f._count?.fields ?? 0} fields</span>
                <span>· {f._count?.submissions ?? 0} submissions</span>
                {f.defaultProject && <span>· → {f.defaultProject.name}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
