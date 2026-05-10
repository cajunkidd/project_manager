import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { recurringApi, type CreateRecurringInput } from '../api/recurring';
import type { Priority, Project, RecurringTaskTemplate } from '../types';
import { formatDate } from '../utils/format';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function describeCadence(t: RecurringTaskTemplate): string {
  const every = t.intervalCount > 1 ? `every ${t.intervalCount} ` : '';
  if (t.cadence === 'daily') return `${every || 'every '}day at ${pad(t.hourOfDay)}:00`;
  if (t.cadence === 'weekly') {
    const day = t.dayOfWeek != null ? DOW[t.dayOfWeek] : '';
    return `${every || 'every '}week${day ? ` on ${day}` : ''} at ${pad(t.hourOfDay)}:00`;
  }
  return `${every || 'every '}month on day ${t.dayOfMonth ?? '—'} at ${pad(t.hourOfDay)}:00`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function RecurringTasksPage() {
  const [items, setItems] = useState<RecurringTaskTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function refresh() {
    recurringApi.list().then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    refresh();
    projectsApi.list().then(setProjects).catch(() => undefined);
  }, []);

  async function toggleActive(t: RecurringTaskTemplate) {
    setBusyId(t.id);
    try {
      await recurringApi.update(t.id, { isActive: !t.isActive });
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t: RecurringTaskTemplate) {
    if (!confirm(`Delete recurring template "${t.name}"?`)) return;
    setBusyId(t.id);
    try {
      await recurringApi.remove(t.id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function runNow() {
    setError(null);
    try {
      const r = await recurringApi.runDue();
      alert(`Ran ${r.ranTemplates} template(s); created ${r.createdTaskIds.length} task(s).`);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Recurring tasks</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            Templates spawn a fresh task on every cadence. The scheduler runs every minute.
          </div>
        </div>
        <div className="row">
          <button className="btn btn-secondary" onClick={runNow}>
            Run due now
          </button>
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New template'}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {showForm ? (
        <NewTemplateForm
          projects={projects}
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
      ) : null}

      <div className="card">
        {items.length === 0 ? (
          <div className="muted">No recurring templates yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Spawns</th>
                <th>Cadence</th>
                <th>Project</th>
                <th>Next run</th>
                <th>Last run</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} style={{ opacity: t.isActive ? 1 : 0.55 }}>
                  <td>{t.name}</td>
                  <td>{t.title}</td>
                  <td className="muted">{describeCadence(t)}</td>
                  <td>
                    {t.project ? (
                      <Link to={`/projects/${t.project.id}`}>{t.project.name}</Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{formatDate(t.nextRunAt)}</td>
                  <td className="muted">{t.lastRunAt ? formatDate(t.lastRunAt) : 'never'}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === t.id}
                        onClick={() => toggleActive(t)}
                      >
                        {t.isActive ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === t.id}
                        onClick={() => remove(t)}
                      >
                        Delete
                      </button>
                    </div>
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

function NewTemplateForm({
  projects,
  onCreated,
}: {
  projects: Project[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [cadence, setCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hourOfDay, setHourOfDay] = useState(9);
  const [dueOffsetDays, setDueOffsetDays] = useState(0);
  const [priority, setPriority] = useState<Priority>('normal');
  const [error, setError] = useState<string | null>(null);

  const cadenceFields = useMemo(() => {
    switch (cadence) {
      case 'weekly':
        return (
          <label>
            Day of week
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DOW.map((d, i) => (
                <option key={i} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        );
      case 'monthly':
        return (
          <label>
            Day of month
            <input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
            />
          </label>
        );
      default:
        return null;
    }
  }, [cadence, dayOfWeek, dayOfMonth]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: CreateRecurringInput = {
      name,
      title,
      cadence,
      intervalCount,
      hourOfDay,
      dueOffsetDays,
      priority,
      projectId: projectId || null,
      dayOfWeek: cadence === 'weekly' ? dayOfWeek : null,
      dayOfMonth: cadence === 'monthly' ? dayOfMonth : null,
    };
    try {
      await recurringApi.create(payload);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card col">
      {error ? <div className="error">{error}</div> : null}
      <div className="grid cols-2">
        <label>
          Template name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Project
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— None —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Spawned task title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <div className="grid cols-4">
        <label>
          Cadence
          <select value={cadence} onChange={(e) => setCadence(e.target.value as typeof cadence)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>
          Every N
          <input
            type="number"
            min={1}
            max={365}
            value={intervalCount}
            onChange={(e) => setIntervalCount(Number(e.target.value))}
          />
        </label>
        {cadenceFields}
        <label>
          Hour (0–23)
          <input
            type="number"
            min={0}
            max={23}
            value={hourOfDay}
            onChange={(e) => setHourOfDay(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="grid cols-2">
        <label>
          Due in N days
          <input
            type="number"
            min={0}
            max={365}
            value={dueOffsetDays}
            onChange={(e) => setDueOffsetDays(Number(e.target.value))}
          />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn" type="submit">
          Create template
        </button>
      </div>
    </form>
  );
}
