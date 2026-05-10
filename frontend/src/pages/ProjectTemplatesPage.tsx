import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectTemplatesApi } from '../api/projectTemplates';
import type { ProjectTemplate } from '../types';
import { formatDate } from '../utils/format';

export function ProjectTemplatesPage() {
  const [items, setItems] = useState<ProjectTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [active, setActive] = useState<ProjectTemplate | null>(null);
  const nav = useNavigate();

  function refresh() {
    projectTemplatesApi.list().then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function open(t: ProjectTemplate) {
    setBusyId(t.id);
    try {
      setActive(await projectTemplatesApi.get(t.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t: ProjectTemplate) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    setBusyId(t.id);
    try {
      await projectTemplatesApi.remove(t.id);
      if (active?.id === t.id) setActive(null);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function instantiate(t: ProjectTemplate, name: string, startDate: string) {
    setBusyId(t.id);
    try {
      const project = await projectTemplatesApi.instantiate(t.id, { name, startDate });
      nav(`/projects/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Project templates</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            Save a project's task tree as a reusable template, then spin up new
            projects with all dates re-anchored to a fresh start date.
          </div>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="grid cols-2">
        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Templates</h2>
          {items.length === 0 ? (
            <div className="muted">
              No templates yet — open any project and click "Save as template".
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px' }}
                        onClick={() => open(t)}
                        disabled={busyId === t.id}
                      >
                        {t.name}
                      </button>
                    </td>
                    <td className="muted">{t.department ?? '—'}</td>
                    <td className="muted">{formatDate(t.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: 12 }}
                        onClick={() => remove(t)}
                        disabled={busyId === t.id}
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

        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Detail</h2>
          {!active ? (
            <div className="muted">Select a template on the left to preview.</div>
          ) : (
            <ActiveTemplate template={active} onUse={instantiate} busy={busyId === active.id} />
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveTemplate({
  template,
  onUse,
  busy,
}: {
  template: ProjectTemplate;
  onUse: (t: ProjectTemplate, name: string, startDate: string) => void | Promise<void>;
  busy: boolean;
}) {
  const [name, setName] = useState(`${template.name} (copy)`);
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);

  return (
    <div className="col">
      <div>
        <strong>{template.name}</strong>
        {template.description ? (
          <div className="muted" style={{ fontSize: 13 }}>
            {template.description}
          </div>
        ) : null}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {template.tasks?.length ?? 0} task(s) · default priority {template.defaultPriority}
      </div>
      {template.tasks && template.tasks.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {template.tasks.map((t) => (
            <li
              key={t.id}
              style={{ marginLeft: t.parentTemplateTaskId ? 16 : 0 }}
            >
              {t.title}
              {t.startOffsetDays != null || t.dueOffsetDays != null ? (
                <span className="muted">
                  {' '}
                  · day {t.startOffsetDays ?? '—'} → {t.dueOffsetDays ?? '—'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="col"
        onSubmit={(e) => {
          e.preventDefault();
          onUse(template, name, startDate);
        }}
        style={{ borderTop: '1px solid var(--border, #eee)', paddingTop: 12, marginTop: 8 }}
      >
        <div className="grid cols-2">
          <label>
            New project name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create project from template'}
          </button>
        </div>
      </form>
    </div>
  );
}
