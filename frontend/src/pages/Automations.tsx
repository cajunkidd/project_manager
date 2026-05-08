import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  AutomationAction,
  AutomationActionType,
  AutomationRule,
  AutomationTrigger,
  IntakeForm,
  Priority,
  Project,
  TaskStatus,
  User,
} from "../lib/types";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_STATUSES,
} from "../lib/types";
import { getCurrentUserId } from "../lib/currentUser";

const TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: "task_created", label: "Task created" },
  { value: "task_status_changed", label: "Task status changed" },
  { value: "comment_created", label: "Comment created" },
  { value: "form_submitted", label: "Form submitted" },
];

const ACTION_TYPES: { value: AutomationActionType; label: string }[] = [
  { value: "send_notification", label: "Send notification" },
  { value: "assign_user", label: "Assign user" },
  { value: "change_status", label: "Change status" },
  { value: "change_priority", label: "Change priority" },
  { value: "add_comment", label: "Add comment" },
];

const PRIORITIES: Priority[] = ["low", "normal", "high", "urgent"];

export default function Automations() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AutomationRule | "new" | null>(null);

  const { data: rules = [] } = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.get<AutomationRule[]>("/automations"),
  });

  const toggle = useMutation({
    mutationFn: (r: AutomationRule) =>
      api.patch(`/automations/${r.id}`, { isActive: !r.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Automations</h1>
        <button
          onClick={() => setEditing("new")}
          className="bg-brand hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded"
        >
          New rule
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Trigger</th>
              <th className="text-left px-4 py-2 font-medium">Actions</th>
              <th className="text-left px-4 py-2 font-medium">Active</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">
                  <button
                    onClick={() => setEditing(r)}
                    className="text-left hover:underline font-medium"
                  >
                    {r.name}
                  </button>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {TRIGGERS.find((t) => t.value === r.triggerType)?.label}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {(r.actions ?? []).map((a) => a.type).join(", ")}
                </td>
                <td className="px-4 py-2">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={r.isActive}
                      onChange={() => toggle.mutate(r)}
                    />
                    {r.isActive ? "Active" : "Off"}
                  </label>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => {
                      if (confirm(`Delete rule "${r.name}"?`)) remove.mutate(r.id);
                    }}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No automation rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <RuleEditor
          rule={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["automations"] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RuleEditor({
  rule,
  onClose,
  onSaved,
}: {
  rule: AutomationRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [triggerType, setTriggerType] = useState<AutomationTrigger>(
    rule?.triggerType ?? "task_created",
  );
  const [conditions, setConditions] = useState<Record<string, string>>(
    (rule?.conditions ?? {}) as Record<string, string>,
  );
  const [actions, setActions] = useState<AutomationAction[]>(rule?.actions ?? []);
  const [saving, setSaving] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-all"],
    queryFn: () => api.get<Project[]>("/projects"),
  });
  const { data: forms = [] } = useQuery({
    queryKey: ["forms"],
    queryFn: () => api.get<IntakeForm[]>("/forms"),
  });

  const conditionFields = useMemo(() => {
    if (triggerType === "comment_created") {
      return [
        { key: "projectId", label: "Project", source: "projects" as const },
        { key: "taskId", label: "Task ID (uuid)", source: "text" as const },
      ];
    }
    if (triggerType === "form_submitted") {
      return [
        { key: "formId", label: "Form", source: "forms" as const },
        { key: "projectId", label: "Project", source: "projects" as const },
      ];
    }
    // task triggers
    return [
      { key: "projectId", label: "Project", source: "projects" as const },
      { key: "status", label: "Status", source: "status" as const },
      { key: "priority", label: "Priority", source: "priority" as const },
      { key: "assignedToId", label: "Assignee", source: "users" as const },
    ];
  }, [triggerType]);

  async function save() {
    setSaving(true);
    try {
      const cleanConditions: Record<string, string> = {};
      for (const [k, v] of Object.entries(conditions)) if (v) cleanConditions[k] = v;
      const payload = {
        name,
        triggerType,
        conditions: Object.keys(cleanConditions).length ? cleanConditions : null,
        actions,
        isActive: rule?.isActive ?? true,
        createdById: getCurrentUserId(),
      };
      if (rule) {
        await api.patch(`/automations/${rule.id}`, payload);
      } else {
        await api.post("/automations", payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function addAction() {
    setActions((a) => [...a, { type: "send_notification" }]);
  }
  function updateAction(i: number, patch: Partial<AutomationAction>) {
    setActions((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeAction(i: number) {
    setActions((a) => a.filter((_, idx) => idx !== i));
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{rule ? "Edit rule" : "New rule"}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </Field>

        <Field label="Trigger">
          <select
            value={triggerType}
            onChange={(e) => {
              setTriggerType(e.target.value as AutomationTrigger);
              setConditions({});
            }}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
          >
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Conditions (all must match; leave blank to ignore)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {conditionFields.map((cf) => {
              const value = conditions[cf.key] ?? "";
              const onChange = (v: string) =>
                setConditions((c) => ({ ...c, [cf.key]: v }));
              return (
                <Field key={cf.key} label={cf.label}>
                  {cf.source === "users" && (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.displayName}</option>
                      ))}
                    </select>
                  )}
                  {cf.source === "projects" && (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                  {cf.source === "forms" && (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {forms.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  )}
                  {cf.source === "status" && (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  )}
                  {cf.source === "priority" && (
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                    >
                      <option value="">—</option>
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                      ))}
                    </select>
                  )}
                  {cf.source === "text" && (
                    <input
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Actions
            </h3>
            <button
              onClick={addAction}
              className="text-xs border border-slate-300 hover:bg-slate-100 px-2 py-1 rounded"
            >
              + Add action
            </button>
          </div>
          <ul className="space-y-2">
            {actions.map((a, i) => (
              <li key={i} className="border border-slate-200 rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={a.type}
                    onChange={(e) =>
                      updateAction(i, { type: e.target.value as AutomationActionType })
                    }
                    className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeAction(i)}
                    className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
                <ActionParams
                  action={a}
                  users={users}
                  onChange={(patch) => updateAction(i, patch)}
                />
              </li>
            ))}
            {actions.length === 0 && (
              <li className="text-sm text-slate-500">Add at least one action.</li>
            )}
          </ul>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={!name || actions.length === 0 || saving}
            onClick={save}
            className="bg-brand hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionParams({
  action,
  users,
  onChange,
}: {
  action: AutomationAction;
  users: User[];
  onChange: (patch: Partial<AutomationAction>) => void;
}) {
  switch (action.type) {
    case "send_notification":
      return (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={action.userId ?? ""}
            onChange={(e) => onChange({ userId: e.target.value })}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Recipient…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.displayName}</option>
            ))}
          </select>
          <input
            value={action.message ?? ""}
            onChange={(e) => onChange({ message: e.target.value })}
            placeholder="Message"
            className="border border-slate-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
      );
    case "assign_user":
      return (
        <select
          value={action.userId ?? ""}
          onChange={(e) => onChange({ userId: e.target.value })}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">User…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>
      );
    case "change_status":
      return (
        <select
          value={action.status ?? ""}
          onChange={(e) => onChange({ status: e.target.value as TaskStatus })}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">Status…</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      );
    case "change_priority":
      return (
        <select
          value={action.priority ?? ""}
          onChange={(e) => onChange({ priority: e.target.value as Priority })}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">Priority…</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
      );
    case "add_comment":
      return (
        <textarea
          value={action.body ?? ""}
          onChange={(e) => onChange({ body: e.target.value })}
          placeholder="Comment body"
          rows={2}
          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
        />
      );
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
