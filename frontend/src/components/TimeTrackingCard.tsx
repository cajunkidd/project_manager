import { useCallback, useEffect, useState } from 'react';
import { timeApi } from '../api/advanced';
import { useAuth } from '../auth/AuthContext';
import type { TimeEntry, TimeRollup } from '../types';
import { formatDate } from '../utils/format';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TimeTrackingCard({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [rollup, setRollup] = useState<TimeRollup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');

  const reload = useCallback(() => {
    Promise.all([timeApi.forTask(taskId), timeApi.taskRollup(taskId)])
      .then(([e, r]) => {
        setEntries(e);
        setRollup(r);
      })
      .catch((err) => setError(err.message));
  }, [taskId]);

  useEffect(() => reload(), [reload]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(minutes);
    if (!Number.isInteger(n) || n <= 0) {
      setError('Minutes must be a positive integer');
      return;
    }
    try {
      await timeApi.add(taskId, { minutes: n, notes: notes || null });
      setMinutes('');
      setNotes('');
      setError(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this entry?')) return;
    await timeApi.remove(taskId, id);
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
        <h2 style={{ margin: 0, fontSize: 16 }}>Time tracking</h2>
        {rollup ? (
          <div className="muted">Total: {formatMinutes(rollup.totalMinutes)}</div>
        ) : null}
      </div>

      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={add} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="Minutes"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          required
          style={{ maxWidth: 120 }}
        />
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" className="btn">
          Log time
        </button>
      </form>

      {entries.length > 0 ? (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>User</th>
              <th>Duration</th>
              <th>Date</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.user?.displayName ?? '—'}</td>
                <td>{formatMinutes(e.minutes)}</td>
                <td className="muted">{formatDate(e.occurredAt)}</td>
                <td className="muted">{e.notes ?? '—'}</td>
                <td>
                  {e.userId === user?.id || user?.role === 'admin' || user?.role === 'manager' ? (
                    <button className="btn btn-secondary" onClick={() => remove(e.id)}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
