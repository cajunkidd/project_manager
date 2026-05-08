import { useEffect, useRef, useState } from 'react';
import { timeTrackingApi, type TimeEntry } from '../api/time-tracking';
import { formatDateTime, formatDuration } from '../utils/format';

interface TaskTimerProps {
  taskId: string;
  entries: TimeEntry[];
  active: TimeEntry | null;
  onChange: () => void;
}

export function TaskTimer({ taskId, entries, active, onChange }: TaskTimerProps) {
  const [now, setNow] = useState<number>(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (active && active.taskId === taskId) {
      tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
      return () => {
        if (tickRef.current !== null) window.clearInterval(tickRef.current);
      };
    }
    return undefined;
  }, [active, taskId]);

  const isMineRunning = active?.taskId === taskId;
  const elapsed = isMineRunning ? now - new Date(active!.startedAt).getTime() : 0;

  const totalLogged = entries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      if (active && active.taskId !== taskId) {
        await timeTrackingApi.stop(active.id);
      }
      await timeTrackingApi.start(taskId);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start timer');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!isMineRunning) return;
    setBusy(true);
    setError(null);
    try {
      await timeTrackingApi.stop(active!.id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop timer');
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm('Delete this time entry?')) return;
    await timeTrackingApi.remove(id);
    onChange();
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Time tracking</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Total logged: <strong>{formatDuration(totalLogged)}</strong>
            {isMineRunning ? (
              <>
                {' '}· Running: <strong>{formatDuration(elapsed)}</strong>
              </>
            ) : null}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {isMineRunning ? (
            <button type="button" className="btn btn-danger" onClick={stop} disabled={busy}>
              Stop timer
            </button>
          ) : (
            <button type="button" className="btn" onClick={start} disabled={busy}>
              {active ? 'Switch timer to this task' : 'Start timer'}
            </button>
          )}
        </div>
      </div>
      {error ? <div className="error" style={{ marginTop: 8 }}>{error}</div> : null}

      {entries.length === 0 ? (
        <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          No time logged yet.
        </div>
      ) : (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Started</th>
              <th>Ended</th>
              <th>Duration</th>
              <th>Note</th>
              <th>Who</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="muted">{formatDateTime(e.startedAt)}</td>
                <td className="muted">{e.endedAt ? formatDateTime(e.endedAt) : 'running'}</td>
                <td>{formatDuration(e.durationMs)}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {e.note ?? '—'}
                </td>
                <td className="muted">{e.user?.displayName ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  {e.endedAt ? (
                    <button
                      type="button"
                      className="link"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => deleteEntry(e.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
