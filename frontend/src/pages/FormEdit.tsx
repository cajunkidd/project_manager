import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type {
  FormFieldType,
  FormSubmission,
  IntakeForm,
  Priority,
  Project,
  User,
} from "../lib/types";

interface DraftField {
  id?: string;
  label: string;
  fieldType: FormFieldType;
  isRequired: boolean;
  options: string[] | null;
  sortOrder: number;
}

const TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Single-line text",
  textarea: "Multi-line text",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  user_picker: "User picker",
};
const TYPES: FormFieldType[] = ["text", "textarea", "dropdown", "checkbox", "date", "user_picker"];

export default function FormEdit() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: form } = useQuery({
    queryKey: ["form", id],
    queryFn: () => api.get<IntakeForm>(`/forms/${id}`),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-all"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const { data: submissions = [] } = useQuery({
    queryKey: ["form-submissions", id],
    queryFn: () => api.get<FormSubmission[]>(`/forms/${id}/submissions`),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultProjectId, setDefaultProjectId] = useState("");
  const [defaultAssigneeId, setDefaultAssigneeId] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<Priority>("normal");
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<DraftField[]>([]);

  useEffect(() => {
    if (!form) return;
    setName(form.name);
    setDescription(form.description ?? "");
    setDefaultProjectId(form.defaultProjectId ?? "");
    setDefaultAssigneeId(form.defaultAssigneeId ?? "");
    setDefaultPriority(form.defaultPriority);
    setIsActive(form.isActive);
    setFields(
      (form.fields ?? []).map((f) => ({
        id: f.id,
        label: f.label,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        options: f.options,
        sortOrder: f.sortOrder,
      })),
    );
  }, [form]);

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/forms/${id}`, {
        name,
        description: description || null,
        defaultProjectId: defaultProjectId || null,
        defaultAssigneeId: defaultAssigneeId || null,
        defaultPriority,
        isActive,
        fields: fields.map((f, i) => ({
          label: f.label,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          options: f.fieldType === "dropdown" ? f.options ?? [] : null,
          sortOrder: i,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["form", id] });
      qc.invalidateQueries({ queryKey: ["forms"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/forms/${id}`),
    onSuccess: () => nav("/forms"),
  });

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        label: "",
        fieldType: "text",
        isRequired: false,
        options: null,
        sortOrder: prev.length,
      },
    ]);
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFields(next);
  }

  if (!form) return <div className="p-6 text-sm">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit form</h1>
        <div className="flex gap-2">
          <Link
            to={`/forms/${id}`}
            className="text-sm border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded"
          >
            Preview
          </Link>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name}
            className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            Save
          </button>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Default project (required to submit)">
            <select
              value={defaultProjectId}
              onChange={(e) => setDefaultProjectId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
            >
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Default assignee">
            <select
              value={defaultAssigneeId}
              onChange={(e) => setDefaultAssigneeId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
            >
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </Field>
          <Field label="Default priority">
            <select
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value as Priority)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
            >
              {(["low", "normal", "high", "urgent"] as const).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Active">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Form is available to submit
            </label>
          </Field>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Fields</h2>
          <button
            onClick={addField}
            className="text-sm border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded"
          >
            + Add field
          </button>
        </div>
        <ul className="space-y-2">
          {fields.map((f, idx) => (
            <li
              key={idx}
              className="border border-slate-200 rounded p-3 grid grid-cols-12 gap-2 items-start"
            >
              <input
                value={f.label}
                onChange={(e) =>
                  setFields((prev) =>
                    prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                  )
                }
                placeholder="Field label"
                className="col-span-4 border border-slate-300 rounded px-2 py-1.5 text-sm"
              />
              <select
                value={f.fieldType}
                onChange={(e) =>
                  setFields((prev) =>
                    prev.map((x, i) =>
                      i === idx
                        ? {
                            ...x,
                            fieldType: e.target.value as FormFieldType,
                            options:
                              (e.target.value as FormFieldType) === "dropdown"
                                ? x.options ?? []
                                : null,
                          }
                        : x,
                    ),
                  )
                }
                className="col-span-3 border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <label className="col-span-2 flex items-center gap-1 text-xs text-slate-700 mt-2">
                <input
                  type="checkbox"
                  checked={f.isRequired}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, isRequired: e.target.checked } : x,
                      ),
                    )
                  }
                />
                Required
              </label>
              <div className="col-span-3 flex justify-end gap-1">
                <button
                  onClick={() => move(idx, -1)}
                  className="text-xs px-2 py-1 rounded hover:bg-slate-100"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  className="text-xs px-2 py-1 rounded hover:bg-slate-100"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() =>
                    setFields((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded"
                >
                  Remove
                </button>
              </div>
              {f.fieldType === "dropdown" && (
                <div className="col-span-12">
                  <span className="text-xs font-medium text-slate-600">Options (one per line)</span>
                  <textarea
                    value={(f.options ?? []).join("\n")}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                options: e.target.value
                                  .split("\n")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              }
                            : x,
                        ),
                      )
                    }
                    rows={3}
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  />
                </div>
              )}
            </li>
          ))}
          {fields.length === 0 && (
            <li className="text-sm text-slate-500">No fields yet. Add at least one before publishing.</li>
          )}
        </ul>
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">
          Recent submissions ({submissions.length})
        </h2>
        {submissions.length === 0 ? (
          <div className="text-sm text-slate-500">No submissions yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {submissions.slice(0, 10).map((s) => (
              <li key={s.id} className="py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.createdTask?.title ?? "—"}</div>
                  <div className="text-xs text-slate-500">
                    {s.submittedBy?.displayName ?? "Unknown"} ·{" "}
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
                {s.createdTaskId && (
                  <Link
                    to={`/forms/${id}/edit?task=${s.createdTaskId}`}
                    className="text-xs text-brand hover:underline"
                  >
                    Open task
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex justify-between border-t border-slate-100 pt-4">
        <button
          onClick={() => {
            if (confirm(`Delete form "${name}"? Submissions will be removed.`))
              remove.mutate();
          }}
          className="text-sm text-rose-600 hover:text-rose-700"
        >
          Delete form
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !name}
          className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
        >
          Save
        </button>
      </footer>
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
