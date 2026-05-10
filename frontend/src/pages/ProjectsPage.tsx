import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import type { Project } from '../types';
import { formatDate } from '../utils/format';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [view, setView] = useState<'projects' | 'templates'>('projects');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

  function reload() {
    projectsApi
      .list({
        search: search || undefined,
        status: statusFilter || undefined,
        isTemplate: view === 'templates' ? 'true' : 'false',
      })
      .then(setProjects)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, view]);

  async function cloneFromTemplate(project: Project) {
    const suggested = `${project.name.replace(/\s*\(template\)\s*$/i, '')} — new`;
    const name = window.prompt('Name for the new project?', suggested);
    if (!name) return;
    setCloningId(project.id);
    try {
      await projectsApi.clone(project.id, { name });
      setView('projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone project');
    } finally {
      setCloningId(null);
    }
  }

  const isTemplates = view === 'templates';

  return (
    <div className="col">
      <div className="page-header">
        <h1>{isTemplates ? 'Project templates' : 'Projects'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${isTemplates ? 'btn-secondary' : ''}`}
            onClick={() => setView('projects')}
          >
            Projects
          </button>
          <button
            className={`btn ${isTemplates ? '' : 'btn-secondary'}`}
            onClick={() => setView('templates')}
          >
            Templates
          </button>
          <button className="btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : isTemplates ? 'New template' : 'New project'}
          </button>
        </div>
      </div>

      {showForm ? (
        <NewProjectForm
          asTemplate={isTemplates}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      ) : null}

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder={isTemplates ? 'Search templates…' : 'Search projects…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          {isTemplates ? null : (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ maxWidth: 200 }}
            >
              <option value="">All statuses</option>
              <option value="not_started">Not Started</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        </div>
        {error ? <div className="error">{error}</div> : null}
        {projects.length === 0 ? (
          <div className="muted">
            {isTemplates ? 'No templates yet.' : 'No projects yet.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {isTemplates ? null : <th>Status</th>}
                <th>Priority</th>
                <th>Owner</th>
                {isTemplates ? null : <th>Due</th>}
                <th>Tasks</th>
                {isTemplates ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/projects/${p.id}`}>{p.name}</Link>
                  </td>
                  {isTemplates ? null : (
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                  )}
                  <td>
                    <PriorityBadge priority={p.priority} />
                  </td>
                  <td className="muted">{p.owner?.displayName ?? '—'}</td>
                  {isTemplates ? null : <td>{formatDate(p.dueDate)}</td>}
                  <td className="muted">{p._count?.tasks ?? 0}</td>
                  {isTemplates ? (
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => cloneFromTemplate(p)}
                        disabled={cloningId === p.id}
                      >
                        {cloningId === p.id ? 'Cloning…' : 'Use template'}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewProjectForm({
  asTemplate,
  onCreated,
}: {
  asTemplate: boolean;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await projectsApi.create({
        name,
        description: description || null,
        department: department || null,
        isTemplate: asTemplate,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
        {asTemplate ? 'New template' : 'New project'}
      </h2>
      <form onSubmit={onSubmit} className="form-grid">
        <div className="full">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="full">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div>
          <label htmlFor="department">Department</label>
          <input
            id="department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
        {error ? <div className="full error">{error}</div> : null}
        <div className="full" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" type="submit">
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
