import { useCallback, useEffect, useState } from 'react';
import { recurringApi } from '../api/advanced';
import { projectsApi } from '../api/projects';
import type { Project, RecurringFrequency, RecurringTaskRule } from '../types';
import { formatDate } from '../utils/format';

export function RecurringPage() {
  const [rules, setRules] = useState<RecurringTaskRule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    projectId: '',
    templateTitle: '',
    frequency: 'weekly' as RecurringFrequency,
    nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  const reload = useCallback(() => {
    recurringApi.list().then(setRules).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
    projectsApi.list().then(setProjects).catch(() => undefined);
  }, [reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await recurringApi.create({
        name: form.name,
        projectId: form.projectId || null,
        templateTitle: form.templateTitle,
        frequency: form.frequency,
        nextRunAt: form.nextRunAt,
      });
      setForm({ ...form, name: '', templateTitle: '' });
      setCreating(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function toggle(rule: RecurringTaskRule) {
    await recurringApi.update(rule.id, { isActive: !rule.isActive });
    reload();
  }

  async function remove(rule: RecurringTaskRule) {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    await recurringApi.remove(rule.id);
    reload();
  }

  async function runDue() {
    try {
      const result = await recurringApi.runDue();
      alert(`Ran ${result.ranRules} rules, created ${result.createdTaskIds.length} tasks.`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Recurring tasks</h1>
        <div className="row">
          <button className="btn btn-secondary" onClick={runDue}>
            Run due now
          </button>
          <button className="btn" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Cancel' : 'New rule'}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {creating ? (
        <form onSubmit={create} className="card col">
          <input
            placeholder="Rule name (internal)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Task title to create"
            value={form.templateTitle}
            onChange={(e) => setForm({ ...form, templateTitle: e.target.value })}
            required
          />
          <div className="row">
            <select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={form.frequency}
              onChange={(e) =>
                setForm({ ...form, frequency: e.target.value as RecurringFrequency })
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input
              type="date"
              value={form.nextRunAt}
              onChange={(e) => setForm({ ...form, nextRunAt: e.target.value })}
              required
            />
            <button type="submit" className="btn">
              Create
            </button>
          </div>
        </form>
      ) : null}

      <div className="card">
        {rules.length === 0 ? (
          <div className="muted">No recurring rules yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Task</th>
                <th>Frequency</th>
                <th>Next run</th>
                <th>Last run</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="muted">{r.templateTitle}</td>
                  <td>{r.frequency}</td>
                  <td>{formatDate(r.nextRunAt)}</td>
                  <td className="muted">{r.lastRunAt ? formatDate(r.lastRunAt) : '—'}</td>
                  <td>
                    <span className={`badge${r.isActive ? '' : ' overdue'}`}>
                      {r.isActive ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="row" style={{ gap: 6 }}>
                    <button className="btn btn-secondary" onClick={() => toggle(r)}>
                      {r.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => remove(r)}>
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
