import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatMinutes, timeEntriesApi, type TimeEntry } from '../api/time-entries';
import { formatDate } from '../utils/format';

interface Props {
  taskId: string;
}

export function TimeEntriesCard({ taskId }: Props) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [minutes, setMinutes] = useState('');
  const [description, setDescription] = useState('');
  const [billable, setBillable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    timeEntriesApi.listForTask(taskId).then(setEntries).catch((err) => setError(err.message));
  }, [taskId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) {
      setError('Enter minutes greater than 0');
      return;
    }
    try {
      await timeEntriesApi.create(taskId, { minutes: m, description, billable });
      setMinutes('');
      setDescription('');
      setBillable(true);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log time');
    }
  }

  async function onRemove(id: string) {
    if (!window.confirm('Delete this time entry?')) return;
    await timeEntriesApi.remove(id);
    reload();
  }

  const total = entries.reduce((sum, e) => sum + e.minutes, 0);
  const billableTotal = entries.reduce((sum, e) => sum + (e.billable ? e.minutes : 0), 0);

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
        Time tracking{' '}
        <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
          {entries.length === 0
            ? ''
            : `· ${formatMinutes(total)} logged (${formatMinutes(billableTotal)} billable)`}
        </span>
      </h2>
      {error ? <div className="error">{error}</div> : null}

      {entries.length === 0 ? (
        <div className="muted">No time logged yet.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid var(--border, #eee)',
              }}
            >
              <span style={{ fontWeight: 500, minWidth: 64 }}>
                {formatMinutes(entry.minutes)}
              </span>
              <span className="muted" style={{ fontSize: 12, minWidth: 120 }}>
                {entry.user?.displayName ?? '—'} · {formatDate(entry.loggedAt)}
              </span>
              <span style={{ flex: 1 }}>{entry.description ?? <span className="muted">—</span>}</span>
              {!entry.billable ? (
                <span className="badge muted" style={{ fontSize: 11 }}>
                  Non-billable
                </span>
              ) : null}
              {entry.userId === user?.id || user?.role === 'admin' || user?.role === 'manager' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: 12 }}
                  onClick={() => onRemove(entry.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="row" style={{ marginTop: 12, alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          min={1}
          placeholder="Minutes"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          required
          style={{ maxWidth: 100 }}
        />
        <input
          placeholder="What did you work on? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 1 }}
        />
        <label className="row" style={{ gap: 4, alignItems: 'center', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
          />
          <span>Billable</span>
        </label>
        <button className="btn" type="submit">
          Log time
        </button>
      </form>
    </div>
  );
}
