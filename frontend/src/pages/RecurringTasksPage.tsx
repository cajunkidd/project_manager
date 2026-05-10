import { useCallback, useEffect, useState } from 'react';
import {
  recurringTasksApi,
  type CreateRecurringTaskInput,
  type RecurringFrequency,
  type RecurringTask,
} from '../api/recurring-tasks';
import { http } from '../api/client';
import type { Project, User } from '../types';
import { formatDate } from '../utils/format';

function emptyDraft(): CreateRecurringTaskInput {
  return {
    name: '',
    title: '',
    description: '',
    projectId: null,
    assignedToId: null,
    priority: 'normal',
    frequency: 'weekly',
    interval: 1,
    dueOffsetDays: 0,
    startAt: new Date().toISOString().slice(0, 10),
  };
}

export function RecurringTasksPage() {
  const [rules, setRules] = useState<RecurringTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<CreateRecurringTaskInput>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const reload = useCallback(() => {
    recurringTasksApi.list().then(setRules).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
    http.get<Project[]>('/projects').then(setProjects).catch(() => setProjects([]));
    http.get<User[]>('/users').then(setUsers).catch(() => setUsers([]));
  }, [reload]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await recurringTasksApi.create({
        ...draft,
        startAt: new Date(draft.startAt).toISOString(),
      });
      setDraft(emptyDraft());
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(rule: RecurringTask) {
    await recurringTasksApi.update(rule.id, { isActive: !rule.isActive });
    reload();
  }

  async function onRemove(id: string) {
    if (!window.confirm('Delete this recurring rule?')) return;
    await recurringTasksApi.remove(id);
    reload();
  }

  async function onRunDue() {
    const res = await recurringTasksApi.runDue();
    setLastRun(`Generated ${res.generated} task${res.generated === 1 ? '' : 's'}.`);
    reload();
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Recurring Tasks</h1>
        <button className="btn btn-secondary" onClick={onRunDue}>
          Run due now
        </button>
      </div>
      {lastRun ? <div className="muted">{lastRun}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={onCreate} className="card col">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>New recurring rule</h2>
        <div className="grid cols-2">
          <label className="col">
            <span className="muted">Rule name</span>
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Weekly status report"
            />
          </label>
          <label className="col">
            <span className="muted">Task title</span>
            <input
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Submit weekly status report"
            />
          </label>
          <label className="col">
            <span className="muted">Project</span>
            <select
              value={draft.projectId ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, projectId: e.target.value || null })
              }
            >
              <option value="">— No project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="col">
            <span className="muted">Assignee</span>
            <select
              value={draft.assignedToId ?? ''}
              onChange={(e) =>
                setDraft({ ...draft, assignedToId: e.target.value || null })
              }
            >
              <option value="">— Unassigned —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="col">
            <span className="muted">Frequency</span>
            <select
              value={draft.frequency}
              onChange={(e) =>
                setDraft({ ...draft, frequency: e.target.value as RecurringFrequency })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          <label className="col">
            <span className="muted">Every N {draft.frequency === 'daily' ? 'days' : draft.frequency === 'weekly' ? 'weeks' : 'months'}</span>
            <input
              type="number"
              min={1}
              value={draft.interval ?? 1}
              onChange={(e) => setDraft({ ...draft, interval: Number(e.target.value) })}
            />
          </label>
          <label className="col">
            <span className="muted">First run on</span>
            <input
              type="date"
              required
              value={draft.startAt.slice(0, 10)}
              onChange={(e) => setDraft({ ...draft, startAt: e.target.value })}
            />
          </label>
          <label className="col">
            <span className="muted">Due N days after generation</span>
            <input
              type="number"
              min={0}
              value={draft.dueOffsetDays ?? 0}
              onChange={(e) =>
                setDraft({ ...draft, dueOffsetDays: Number(e.target.value) })
              }
            />
          </label>
          <label className="col">
            <span className="muted">Priority</span>
            <select
              value={draft.priority ?? 'normal'}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
        </div>
        <label className="col">
          <span className="muted">Description (optional)</span>
          <textarea
            rows={3}
            value={draft.description ?? ''}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Create rule'}
          </button>
        </div>
      </form>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Active rules ({rules.length})</h2>
        {rules.length === 0 ? (
          <div className="muted">No recurring rules yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Cadence</th>
                <th>Next run</th>
                <th>Last run</th>
                <th>Assignee</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div>{r.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      → {r.title}
                    </div>
                  </td>
                  <td>
                    every {r.interval} {r.frequency === 'daily' ? 'day(s)' : r.frequency === 'weekly' ? 'week(s)' : 'month(s)'}
                  </td>
                  <td>{formatDate(r.nextRunAt)}</td>
                  <td>{r.lastRunAt ? formatDate(r.lastRunAt) : '—'}</td>
                  <td className="muted">{r.assignedTo?.displayName ?? '—'}</td>
                  <td>
                    <span className={r.isActive ? 'badge' : 'badge muted'}>
                      {r.isActive ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: 12, marginRight: 4 }}
                      onClick={() => onToggle(r)}
                    >
                      {r.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => onRemove(r.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
