import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeApi } from '../api/advanced';
import type { TimeEntry } from '../types';
import { formatDate } from '../utils/format';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function TimePage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    timeApi.mine().then(setEntries).catch((err) => setError(err.message));
  }, []);

  useEffect(() => reload(), [reload]);

  const total = entries.reduce((sum, e) => sum + e.minutes, 0);

  return (
    <div className="col">
      <div className="page-header">
        <h1>My time</h1>
        <div className="muted">Total logged: {formatMinutes(total)}</div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        {entries.length === 0 ? (
          <div className="muted">
            No time logged. Use the time card on a task detail page to log hours.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Duration</th>
                <th>Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.task ? <Link to={`/tasks/${e.task.id}`}>{e.task.title}</Link> : '—'}
                  </td>
                  <td>{formatMinutes(e.minutes)}</td>
                  <td className="muted">{formatDate(e.occurredAt)}</td>
                  <td className="muted">{e.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
