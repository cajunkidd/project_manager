import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portfoliosApi, type Portfolio } from '../api/portfolios';
import { projectsApi } from '../api/projects';
import type { Project } from '../types';

export function PortfoliosPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    portfoliosApi.list().then(setPortfolios).catch((err) => setError(err.message));
  }

  useEffect(() => {
    reload();
    projectsApi.list().then(setProjects).catch(() => setProjects([]));
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await portfoliosApi.create({
        name,
        description: description || null,
        projectIds: selectedIds,
      });
      setName('');
      setDescription('');
      setSelectedIds([]);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  }

  async function onRemove(id: string) {
    if (!window.confirm('Delete this portfolio?')) return;
    await portfoliosApi.remove(id);
    reload();
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Portfolios</h1>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={onCreate} className="card col">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>New portfolio</h2>
        <label className="col">
          <span className="muted">Name</span>
          <input value={name} required onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="col">
          <span className="muted">Description (optional)</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="col">
          <span className="muted">Projects (cmd/ctrl-click to multi-select)</span>
          <select
            multiple
            size={Math.min(6, projects.length || 3)}
            value={selectedIds}
            onChange={(e) =>
              setSelectedIds(Array.from(e.target.selectedOptions).map((o) => o.value))
            }
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" type="submit" disabled={!name.trim()}>
            Create portfolio
          </button>
        </div>
      </form>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
          All portfolios ({portfolios.length})
        </h2>
        {portfolios.length === 0 ? (
          <div className="muted">No portfolios yet.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {portfolios.map((p) => (
              <li
                key={p.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border, #eee)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <Link to={`/portfolios/${p.id}`} style={{ fontWeight: 500 }}>
                    {p.name}
                  </Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {p.projects.length} project{p.projects.length === 1 ? '' : 's'}
                    {p.description ? ` · ${p.description}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={() => onRemove(p.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
