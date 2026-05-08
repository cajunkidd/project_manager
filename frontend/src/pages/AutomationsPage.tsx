import { useEffect, useState } from 'react';
import { automationsApi } from '../api/automations';
import { http } from '../api/client';
import type {
  AutomationAction,
  AutomationActionType,
  AutomationCondition,
  AutomationRule,
  AutomationTrigger,
  User,
} from '../types';
import { formatDate } from '../utils/format';

const TRIGGERS: { value: AutomationTrigger; label: string }[] = [
  { value: 'task_created', label: 'Task created' },
  { value: 'task_updated', label: 'Task updated' },
  { value: 'task_status_changed', label: 'Task status changed' },
  { value: 'comment_created', label: 'Comment created' },
  { value: 'form_submitted', label: 'Form submitted' },
];

const ACTION_TYPES: { value: AutomationActionType; label: string }[] = [
  { value: 'send_notification', label: 'Send notification' },
  { value: 'assign_user', label: 'Assign user' },
  { value: 'change_status', label: 'Change status' },
  { value: 'change_priority', label: 'Change priority' },
  { value: 'add_comment', label: 'Add comment' },
];

interface DraftRule {
  name: string;
  triggerType: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

function emptyDraft(): DraftRule {
  return {
    name: '',
    triggerType: 'task_created',
    conditions: [],
    actions: [{ type: 'send_notification', params: { title: '', message: '' } }],
  };
}

function parseList(s: string | null): AutomationCondition[] | AutomationAction[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<DraftRule>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    automationsApi.list().then(setRules).catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
    http.get<User[]>('/users').then(setUsers).catch(() => undefined);
  }, []);

  async function toggle(rule: AutomationRule) {
    await automationsApi.update(rule.id, { isActive: !rule.isActive });
    reload();
  }

  async function remove(id: string) {
    await automationsApi.remove(id);
    reload();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await automationsApi.create({
        name: draft.name,
        triggerType: draft.triggerType,
        conditions: draft.conditions.length ? draft.conditions : undefined,
        actions: draft.actions,
      });
      setDraft(emptyDraft());
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    }
  }

  function updateAction(index: number, patch: Partial<AutomationAction>) {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) =>
        i === index ? { ...a, ...patch, params: { ...a.params, ...(patch.params ?? {}) } } : a,
      ),
    }));
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Automations</h1>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New rule'}
        </button>
      </div>

      {showForm ? (
        <div className="card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>New automation rule</h2>
          <form onSubmit={onSubmit} className="col">
            <div className="form-grid">
              <div className="full">
                <label>Rule name</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label>Trigger</label>
                <select
                  value={draft.triggerType}
                  onChange={(e) =>
                    setDraft({ ...draft, triggerType: e.target.value as AutomationTrigger })
                  }
                >
                  {TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h3 style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>Conditions (optional)</h3>
            {draft.conditions.map((c, idx) => (
              <div key={idx} className="form-grid subtle-card">
                <div>
                  <label>Field</label>
                  <input
                    placeholder="e.g. priority"
                    value={c.field}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        conditions: draft.conditions.map((cc, i) =>
                          i === idx ? { ...cc, field: e.target.value } : cc,
                        ),
                      })
                    }
                  />
                </div>
                <div>
                  <label>Equals</label>
                  <input
                    placeholder="e.g. urgent"
                    value={(c.equals as string) ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        conditions: draft.conditions.map((cc, i) =>
                          i === idx ? { ...cc, equals: e.target.value } : cc,
                        ),
                      })
                    }
                  />
                </div>
                <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="link"
                    style={{ color: 'var(--danger)' }}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        conditions: draft.conditions.filter((_, i) => i !== idx),
                      })
                    }
                  >
                    Remove condition
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setDraft({ ...draft, conditions: [...draft.conditions, { field: '', equals: '' }] })
              }
            >
              + Add condition
            </button>

            <h3 style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--muted)' }}>Actions</h3>
            {draft.actions.map((a, idx) => (
              <div key={idx} className="form-grid subtle-card">
                <div>
                  <label>Type</label>
                  <select
                    value={a.type}
                    onChange={(e) =>
                      updateAction(idx, { type: e.target.value as AutomationActionType, params: {} })
                    }
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                {a.type === 'send_notification' ? (
                  <>
                    <div>
                      <label>Notify user</label>
                      <select
                        value={(a.params.userId as string) ?? ''}
                        onChange={(e) => updateAction(idx, { params: { userId: e.target.value } })}
                      >
                        <option value="">Task assignee</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="full">
                      <label>Title</label>
                      <input
                        value={(a.params.title as string) ?? ''}
                        onChange={(e) => updateAction(idx, { params: { title: e.target.value } })}
                      />
                    </div>
                    <div className="full">
                      <label>Message</label>
                      <input
                        value={(a.params.message as string) ?? ''}
                        onChange={(e) => updateAction(idx, { params: { message: e.target.value } })}
                      />
                    </div>
                  </>
                ) : null}
                {a.type === 'assign_user' ? (
                  <div>
                    <label>Assign to</label>
                    <select
                      value={(a.params.userId as string) ?? ''}
                      onChange={(e) => updateAction(idx, { params: { userId: e.target.value } })}
                    >
                      <option value="">Pick user…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {a.type === 'change_status' ? (
                  <div>
                    <label>New status</label>
                    <select
                      value={(a.params.status as string) ?? ''}
                      onChange={(e) => updateAction(idx, { params: { status: e.target.value } })}
                    >
                      <option value="">Pick status…</option>
                      <option value="backlog">Backlog</option>
                      <option value="to_do">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="waiting">Waiting</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                ) : null}
                {a.type === 'change_priority' ? (
                  <div>
                    <label>New priority</label>
                    <select
                      value={(a.params.priority as string) ?? ''}
                      onChange={(e) => updateAction(idx, { params: { priority: e.target.value } })}
                    >
                      <option value="">Pick priority…</option>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                ) : null}
                {a.type === 'add_comment' ? (
                  <div className="full">
                    <label>Comment body</label>
                    <input
                      value={(a.params.body as string) ?? ''}
                      onChange={(e) => updateAction(idx, { params: { body: e.target.value } })}
                    />
                  </div>
                ) : null}
                <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {draft.actions.length > 1 ? (
                    <button
                      type="button"
                      className="link"
                      style={{ color: 'var(--danger)' }}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          actions: draft.actions.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      Remove action
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setDraft({
                  ...draft,
                  actions: [...draft.actions, { type: 'send_notification', params: {} }],
                })
              }
            >
              + Add action
            </button>

            {error ? <div className="error">{error}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" type="submit">
                Create rule
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Rules</h2>
        {rules.length === 0 ? (
          <div className="muted">No automation rules.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Trigger</th>
                <th>Actions</th>
                <th>Active</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const actions = parseList(r.actions) as AutomationAction[];
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td className="muted">
                      {TRIGGERS.find((t) => t.value === r.triggerType)?.label ?? r.triggerType}
                    </td>
                    <td className="muted">
                      {actions.map((a) => a.type).join(', ')}
                    </td>
                    <td>
                      <span className={`badge${r.isActive ? ' status-active' : ' status-cancelled'}`}>
                        {r.isActive ? 'On' : 'Off'}
                      </span>
                    </td>
                    <td className="muted">{formatDate(r.createdAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="link" onClick={() => toggle(r)}>
                        {r.isActive ? 'Disable' : 'Enable'}
                      </button>{' '}
                      <button
                        type="button"
                        className="link"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => remove(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
