import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { FormField, IntakeForm, User } from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";
import { useTaskOpener } from "../lib/openTask";

export default function FormSubmit() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { open: openTask } = useTaskOpener();
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [submittedTask, setSubmittedTask] = useState<{ id: string; title: string } | null>(null);

  const { data: form } = useQuery({
    queryKey: ["form", id],
    queryFn: () => api.get<IntakeForm>(`/forms/${id}`),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ task: { id: string; title: string } }>(`/forms/${id}/submit`, {
        submittedById: getCurrentUserId(),
        responses,
      }),
    onSuccess: ({ task }) => {
      setSubmittedTask(task);
      setResponses({});
      setError(null);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (err: Error) => {
      const msg = err.message;
      const m = /missing_required_field:(.+)/.exec(msg);
      setError(m ? `Missing required field: ${m[1]}` : msg);
    },
  });

  if (!form) return <div className="p-6 text-sm">Loading…</div>;

  if (submittedTask) {
    return (
      <div className="p-6 max-w-xl">
        <div className="bg-emerald-50 border border-emerald-200 rounded p-4">
          <div className="text-sm font-semibold text-emerald-900">Submitted</div>
          <div className="text-sm text-emerald-800 mt-1">
            Created task: <em>{submittedTask.title}</em>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => openTask(submittedTask.id)}
              className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded px-3 py-1.5"
            >
              View task
            </button>
            <button
              onClick={() => setSubmittedTask(null)}
              className="text-sm rounded px-3 py-1.5 hover:bg-emerald-100"
            >
              Submit another
            </button>
            <Link to="/forms" className="text-sm rounded px-3 py-1.5 hover:bg-emerald-100">
              Back to forms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">{form.name}</h1>
        {form.description && <p className="text-sm text-slate-600 mt-1">{form.description}</p>}
        {!form.defaultProjectId && (
          <p className="text-sm text-amber-700 mt-2">
            This form has no default project configured. An admin must set one before it can be submitted.
          </p>
        )}
      </header>

      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        {(form.fields ?? []).map((f) => (
          <FieldInput
            key={f.id}
            field={f}
            users={users}
            value={responses[f.id]}
            onChange={(v) => setResponses((r) => ({ ...r, [f.id]: v }))}
          />
        ))}
        {(form.fields ?? []).length === 0 && (
          <div className="text-sm text-slate-500">This form has no fields yet.</div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link to="/forms" className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">
          Cancel
        </Link>
        <button
          disabled={
            !form.defaultProjectId ||
            submit.isPending ||
            (form.fields ?? []).length === 0
          }
          onClick={() => submit.mutate()}
          className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  users,
  value,
  onChange,
}: {
  field: FormField;
  users: User[];
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const labelEl = (
    <span className="text-sm font-medium text-slate-700">
      {field.label}
      {field.isRequired && <span className="text-rose-600 ml-0.5">*</span>}
    </span>
  );

  switch (field.fieldType) {
    case "text":
      return (
        <label className="block">
          {labelEl}
          <input
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </label>
      );
    case "textarea":
      return (
        <label className="block">
          {labelEl}
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="mt-1 w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </label>
      );
    case "dropdown":
      return (
        <label className="block">
          {labelEl}
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
          >
            <option value="">—</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
          />
          {labelEl}
        </label>
      );
    case "date":
      return (
        <label className="block">
          {labelEl}
          <input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
          />
        </label>
      );
    case "user_picker":
      return (
        <label className="block">
          {labelEl}
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
        </label>
      );
    default:
      return null;
  }
}
