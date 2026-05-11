import { useCallback, useEffect, useState } from 'react';
import { budgetApi } from '../api/advanced';
import type { BudgetEntry, BudgetKind, BudgetRollup } from '../types';
import { formatDate } from '../utils/format';

export function BudgetCard({ projectId }: { projectId: string }) {
  const [rollup, setRollup] = useState<BudgetRollup | null>(null);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: 'actual' as BudgetKind, amount: '', description: '' });

  const reload = useCallback(() => {
    Promise.all([budgetApi.rollup(projectId), budgetApi.list(projectId)])
      .then(([r, e]) => {
        setRollup(r);
        setEntries(e);
      })
      .catch((err) => setError(err.message));
  }, [projectId]);

  useEffect(() => reload(), [reload]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be > 0');
      return;
    }
    try {
      await budgetApi.add(projectId, {
        kind: form.kind,
        amount,
        description: form.description || null,
      });
      setForm({ kind: 'actual', amount: '', description: '' });
      setAdding(false);
      setError(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this entry?')) return;
    await budgetApi.remove(projectId, id);
    reload();
  }

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Budget</h2>
        <button className="btn btn-secondary" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : 'Add entry'}
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {rollup ? (
        <div className="grid cols-4">
          <div className="subtle-card">
            <div className="muted">Budget</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {rollup.budget != null
                ? `${rollup.currency} ${rollup.budget.toLocaleString()}`
                : '—'}
            </div>
          </div>
          <div className="subtle-card">
            <div className="muted">Planned</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {rollup.currency} {rollup.planned.toLocaleString()}
            </div>
          </div>
          <div className="subtle-card">
            <div className="muted">Actual</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {rollup.currency} {rollup.actual.toLocaleString()}
            </div>
          </div>
          <div className="subtle-card">
            <div className="muted">Remaining</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: rollup.remaining != null && rollup.remaining < 0 ? '#b91c1c' : undefined,
              }}
            >
              {rollup.remaining != null
                ? `${rollup.currency} ${rollup.remaining.toLocaleString()}`
                : '—'}
            </div>
          </div>
        </div>
      ) : null}

      {adding ? (
        <form onSubmit={add} className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as BudgetKind })}
          >
            <option value="planned">Planned</option>
            <option value="actual">Actual</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      ) : null}

      {entries.length > 0 ? (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Amount</th>
              <th>Description</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <span className="badge">{entry.kind}</span>
                </td>
                <td>{entry.amount.toLocaleString()}</td>
                <td className="muted">{entry.description ?? '—'}</td>
                <td className="muted">{formatDate(entry.occurredAt)}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => remove(entry.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
