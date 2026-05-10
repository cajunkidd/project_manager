import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  projectTemplatesApi,
  type CreateTemplateInput,
  type ProjectTemplate,
  type TemplateTaskInput,
} from '../api/project-templates';

function emptyDraft(): CreateTemplateInput & { tasks: TemplateTaskInput[] } {
  return {
    name: '',
    description: '',
    defaultPriority: 'normal',
    department: '',
    tasks: [{ title: '', dueOffsetDays: 0, priority: 'normal' }],
  };
}

export function ProjectTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [draft, setDraft] = useState(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [instantiateFor, setInstantiateFor] = useState<ProjectTemplate | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [instanceStartDate, setInstanceStartDate] = useState('');

  const reload = useCallback(() => {
    projectTemplatesApi.list().then(setTemplates).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function setTask(idx: number, patch: Partial<TemplateTaskInput>) {
    setDraft((d) => {
      const tasks = d.tasks.slice();
      tasks[idx] = { ...tasks[idx], ...patch };
      return { ...d, tasks };
    });
  }

  function addTaskRow() {
    setDraft((d) => ({
      ...d,
      tasks: [...d.tasks, { title: '', dueOffsetDays: 0, priority: 'normal' }],
    }));
  }

  function removeTaskRow(idx: number) {
    setDraft((d) => ({ ...d, tasks: d.tasks.filter((_, i) => i !== idx) }));
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const cleanedTasks = draft.tasks
        .filter((t) => t.title.trim().length > 0)
        .map((t, idx) => ({ ...t, sortOrder: idx }));
      await projectTemplatesApi.create({ ...draft, tasks: cleanedTasks });
      setDraft(emptyDraft());
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string) {
    if (!window.confirm('Delete this template?')) return;
    await projectTemplatesApi.remove(id);
    reload();
  }

  async function onInstantiate(e: React.FormEvent) {
    e.preventDefault();
    if (!instantiateFor) return;
    const res = await projectTemplatesApi.instantiate(instantiateFor.id, {
      name: instanceName,
      startDate: instanceStartDate ? new Date(instanceStartDate).toISOString() : null,
    });
    setInstantiateFor(null);
    setInstanceName('');
    setInstanceStartDate('');
    navigate(`/projects/${res.project.id}`);
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Project Templates</h1>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={onCreate} className="card col">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>New template</h2>
        <div className="grid cols-2">
          <label className="col">
            <span className="muted">Name</span>
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="New employee onboarding"
            />
          </label>
          <label className="col">
            <span className="muted">Default priority</span>
            <select
              value={draft.defaultPriority ?? 'normal'}
              onChange={(e) => setDraft({ ...draft, defaultPriority: e.target.value })}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="col">
            <span className="muted">Department (optional)</span>
            <input
              value={draft.department ?? ''}
              onChange={(e) => setDraft({ ...draft, department: e.target.value })}
            />
          </label>
          <label className="col" style={{ gridColumn: 'span 2' }}>
            <span className="muted">Description</span>
            <textarea
              rows={2}
              value={draft.description ?? ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
        </div>

        <div>
          <div
            className="muted"
            style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.04, margin: '4px 0' }}
          >
            Tasks
          </div>
          {draft.tasks.map((t, idx) => (
            <div key={idx} className="row" style={{ gap: 8, marginBottom: 6 }}>
              <input
                placeholder="Task title"
                value={t.title}
                onChange={(e) => setTask(idx, { title: e.target.value })}
                style={{ flex: 1 }}
              />
              <select
                value={t.priority ?? 'normal'}
                onChange={(e) => setTask(idx, { priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <label className="row" style={{ gap: 4, alignItems: 'center', fontSize: 12 }}>
                <span className="muted">Due +days</span>
                <input
                  type="number"
                  min={0}
                  value={t.dueOffsetDays ?? 0}
                  onChange={(e) =>
                    setTask(idx, { dueOffsetDays: Number(e.target.value) })
                  }
                  style={{ width: 70 }}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => removeTaskRow(idx)}
                disabled={draft.tasks.length === 1}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={addTaskRow}
          >
            + Add task
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Create template'}
          </button>
        </div>
      </form>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Saved templates ({templates.length})</h2>
        {templates.length === 0 ? (
          <div className="muted">No templates yet.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {templates.map((t) => (
              <li
                key={t.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border, #eee)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{t.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {t.tasks.length} task{t.tasks.length === 1 ? '' : 's'}
                    {t.department ? ` · ${t.department}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '4px 10px', fontSize: 13 }}
                  onClick={() => {
                    setInstantiateFor(t);
                    setInstanceName(t.name);
                  }}
                >
                  Use template
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: 13 }}
                  onClick={() => onRemove(t.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {instantiateFor ? (
        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
            Create project from “{instantiateFor.name}”
          </h2>
          <form onSubmit={onInstantiate} className="col">
            <label className="col">
              <span className="muted">Project name</span>
              <input
                required
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
            </label>
            <label className="col">
              <span className="muted">Start date (optional)</span>
              <input
                type="date"
                value={instanceStartDate}
                onChange={(e) => setInstanceStartDate(e.target.value)}
              />
            </label>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setInstantiateFor(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn">
                Create project
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
