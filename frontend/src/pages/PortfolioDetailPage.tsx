import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  portfoliosApi,
  type Portfolio,
  type PortfolioSummary,
} from '../api/portfolios';
import { projectsApi } from '../api/projects';
import { StatusBadge } from '../components/StatusBadge';
import type { Project } from '../types';
import { formatDate } from '../utils/format';
import { formatMinutes } from '../api/time-entries';

export function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [addProjectId, setAddProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    Promise.all([portfoliosApi.get(id), portfoliosApi.summary(id)])
      .then(([p, s]) => {
        setPortfolio(p);
        setSummary(s);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    reload();
    projectsApi.list().then(setAllProjects).catch(() => setAllProjects([]));
  }, [reload]);

  async function onAddProject(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !addProjectId) return;
    setError(null);
    try {
      await portfoliosApi.addProject(id, addProjectId);
      setAddProjectId('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add project');
    }
  }

  async function onRemoveProject(projectId: string) {
    if (!id) return;
    await portfoliosApi.removeProject(id, projectId);
    reload();
  }

  if (error) return <div className="error">{error}</div>;
  if (!portfolio || !summary) return <div className="muted">Loading…</div>;

  const existingIds = new Set(portfolio.projects.map((p) => p.project.id));
  const candidates = allProjects.filter((p) => !existingIds.has(p.id));

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <Link to="/portfolios" className="muted" style={{ fontSize: 13 }}>
            ← All portfolios
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>{portfolio.name}</h1>
          {portfolio.description ? (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {portfolio.description}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid cols-4">
        <div className="subtle-card">
          <div className="muted">Projects</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{summary.projectCount}</div>
        </div>
        <div className="subtle-card">
          <div className="muted">Tasks</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>
            {summary.completedTasks} / {summary.taskCount}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            {summary.completionPct}% complete
          </div>
        </div>
        <div className="subtle-card">
          <div className="muted">Overdue</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: summary.overdueTasks > 0 ? '#b8412c' : undefined,
            }}
          >
            {summary.overdueTasks}
          </div>
        </div>
        <div className="subtle-card">
          <div className="muted">Time logged</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>
            {formatMinutes(summary.minutesLogged)}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Project status mix</h2>
        {Object.keys(summary.projectsByStatus).length === 0 ? (
          <div className="muted">No projects yet.</div>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(summary.projectsByStatus).map(([status, count]) => (
              <div key={status} className="subtle-card" style={{ minWidth: 120 }}>
                <div className="muted">
                  <StatusBadge status={status} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
          Projects ({portfolio.projects.length})
        </h2>
        {portfolio.projects.length === 0 ? (
          <div className="muted">No projects in this portfolio yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Due</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {portfolio.projects.map((pp) => (
                <tr key={pp.id}>
                  <td>
                    <Link to={`/projects/${pp.project.id}`}>{pp.project.name}</Link>
                  </td>
                  <td>
                    <StatusBadge status={pp.project.status} />
                  </td>
                  <td>{formatDate(pp.project.dueDate)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => onRemoveProject(pp.project.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form onSubmit={onAddProject} className="row" style={{ marginTop: 12, gap: 8 }}>
          <select
            value={addProjectId}
            onChange={(e) => setAddProjectId(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Add a project…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={!addProjectId}>
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
