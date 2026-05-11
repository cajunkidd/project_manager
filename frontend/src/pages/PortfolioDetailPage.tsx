import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { portfoliosApi } from '../api/advanced';
import { StatusBadge } from '../components/StatusBadge';
import type { Portfolio, PortfolioRollup, Project } from '../types';
import { formatDate } from '../utils/format';

type Detail = Portfolio & { projects: Project[] };

export function PortfolioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [rollup, setRollup] = useState<PortfolioRollup | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    Promise.all([portfoliosApi.get(id), portfoliosApi.rollup(id)])
      .then(([d, r]) => {
        setDetail(d);
        setRollup(r);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => reload(), [reload]);

  if (error) return <div className="error">{error}</div>;
  if (!detail || !rollup) return <div className="muted">Loading…</div>;

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <Link to="/portfolios" className="muted" style={{ fontSize: 13 }}>
            ← All portfolios
          </Link>
          <h1 style={{ margin: '4px 0 0' }}>{detail.name}</h1>
          {detail.description ? <div className="muted">{detail.description}</div> : null}
        </div>
      </div>

      <div className="grid cols-4">
        <div className="subtle-card">
          <div className="muted">Projects</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{rollup.total}</div>
        </div>
        <div className="subtle-card">
          <div className="muted">Budget total</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>
            ${rollup.budgetTotal.toLocaleString()}
          </div>
        </div>
        <div className="subtle-card">
          <div className="muted">Overdue</div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: rollup.overdue > 0 ? '#b91c1c' : undefined,
            }}
          >
            {rollup.overdue}
          </div>
        </div>
        <div className="subtle-card">
          <div className="muted">By status</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
            {Object.entries(rollup.byStatus).map(([status, count]) => (
              <span key={status} className="badge">
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Projects</h2>
        {detail.projects.length === 0 ? (
          <div className="muted">No projects in this portfolio.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {detail.projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/projects/${p.id}`}>{p.name}</Link>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="muted">
                    {p.budgetAmount != null
                      ? `${p.budgetCurrency ?? 'USD'} ${p.budgetAmount.toLocaleString()}`
                      : '—'}
                  </td>
                  <td>{formatDate(p.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
