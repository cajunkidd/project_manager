import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { portfoliosApi } from '../api/advanced';
import { useAuth } from '../auth/AuthContext';
import type { Portfolio, PortfolioRollup } from '../types';

export function PortfoliosPage() {
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [rollups, setRollups] = useState<Record<string, PortfolioRollup>>({});
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const reload = useCallback(() => {
    portfoliosApi
      .list()
      .then(async (list) => {
        setPortfolios(list);
        const entries = await Promise.all(
          list.map(async (p) => [p.id, await portfoliosApi.rollup(p.id)] as const),
        );
        setRollups(Object.fromEntries(entries));
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await portfoliosApi.create({ name: newName });
      setNewName('');
      setCreating(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Portfolios</h1>
        {canManage ? (
          <button className="btn" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Cancel' : 'New portfolio'}
          </button>
        ) : null}
      </div>

      {error ? <div className="error">{error}</div> : null}

      {creating ? (
        <form onSubmit={create} className="card row">
          <input
            placeholder="Portfolio name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <button type="submit" className="btn">
            Create
          </button>
        </form>
      ) : null}

      {portfolios.length === 0 ? (
        <div className="card muted">No portfolios yet.</div>
      ) : (
        <div className="grid cols-3">
          {portfolios.map((p) => {
            const r = rollups[p.id];
            return (
              <Link to={`/portfolios/${p.id}`} key={p.id} className="card portfolio-card">
                <h3 style={{ margin: '0 0 6px' }}>{p.name}</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  {p._count?.projects ?? 0} projects
                </div>
                {r ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Budget total
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>
                      ${r.budgetTotal.toLocaleString()}
                    </div>
                    {r.overdue > 0 ? (
                      <div className="badge overdue" style={{ marginTop: 6 }}>
                        {r.overdue} overdue
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
