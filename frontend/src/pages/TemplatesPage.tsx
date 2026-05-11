import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { templatesApi } from '../api/advanced';
import { projectsApi } from '../api/projects';
import type { Project, ProjectTemplate } from '../types';
import { formatDate } from '../utils/format';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingFrom, setSavingFrom] = useState(false);
  const [pickProject, setPickProject] = useState('');
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

  const reload = useCallback(() => {
    templatesApi.list().then(setTemplates).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
    projectsApi.list().then(setProjects).catch(() => undefined);
  }, [reload]);

  async function saveFromProject(e: React.FormEvent) {
    e.preventDefault();
    if (!pickProject || !newName.trim()) return;
    try {
      await templatesApi.fromProject({ projectId: pickProject, name: newName });
      setNewName('');
      setPickProject('');
      setSavingFrom(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function instantiate(t: ProjectTemplate) {
    const name = window.prompt('New project name', `${t.name} (copy)`);
    if (!name) return;
    try {
      const project = await templatesApi.instantiate(t.id, { name });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function remove(t: ProjectTemplate) {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    await templatesApi.remove(t.id);
    reload();
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Project templates</h1>
        <button className="btn" onClick={() => setSavingFrom((v) => !v)}>
          {savingFrom ? 'Cancel' : 'Save from project'}
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {savingFrom ? (
        <form onSubmit={saveFromProject} className="card row" style={{ flexWrap: 'wrap' }}>
          <select value={pickProject} onChange={(e) => setPickProject(e.target.value)} required>
            <option value="">Choose project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Template name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <button type="submit" className="btn">
            Save template
          </button>
        </form>
      ) : null}

      <div className="card">
        {templates.length === 0 ? (
          <div className="muted">No templates yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Created by</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="muted">{t.description ?? '—'}</td>
                  <td className="muted">{t.createdBy?.displayName ?? '—'}</td>
                  <td className="muted">{formatDate(t.createdAt)}</td>
                  <td className="row" style={{ gap: 6 }}>
                    <button className="btn btn-secondary" onClick={() => instantiate(t)}>
                      New project
                    </button>
                    <button className="btn btn-secondary" onClick={() => remove(t)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="muted" style={{ fontSize: 12 }}>
        Tip: visit a <Link to="/projects">project</Link> to save its task tree as a template.
      </div>
    </div>
  );
}
