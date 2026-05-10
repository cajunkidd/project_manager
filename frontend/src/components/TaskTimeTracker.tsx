import { useEffect, useState } from 'react';
import { timeEntriesApi } from '../api/timeEntries';
import { useActiveTimer } from '../timer/ActiveTimerContext';
import type { TimeEntry } from '../types';
import { formatDateTime, formatDuration } from '../utils/format';

interface Props {
  taskId: string;
}

export function TaskTimeTracker({ taskId }: Props) {
  const { active, start, stop } = useActiveTimer();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  function refresh() {
    timeEntriesApi
      .forTask(taskId)
      .then((r) => {
        setEntries(r.entries);
        setTotalSeconds(r.totalSeconds);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, active?.id]);

  const isActiveHere = active?.taskId === taskId;

  async function onToggle() {
    setError(null);
    try {
      if (isActiveHere) {
        await stop();
        refresh();
      } else if (active) {
        // Stop current then start here
        await stop();
        await start(taskId);
      } else {
        await start(taskId);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteEntry(id: string) {
    setError(null);
    try {
      await timeEntriesApi.remove(id);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Time tracking</h2>
        <div className="row" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Total: <strong>{formatDuration(totalSeconds)}</strong>
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowManual((v) => !v)}
          >
            {showManual ? 'Cancel' : 'Add entry'}
          </button>
          <button type="button" className="btn" onClick={onToggle}>
            {isActiveHere ? 'Stop timer' : 'Start timer'}
          </button>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}

      {showManual ? (
        <ManualEntryForm
          taskId={taskId}
          onSaved={() => {
            setShowManual(false);
            refresh();
          }}
        />
      ) : null}

      {entries.length === 0 ? (
        <div className="muted">No time logged yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Who</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.user?.displayName ?? '—'}</td>
                <td className="muted">{formatDateTime(e.startedAt)}</td>
                <td>
                  {e.endedAt ? (
                    <strong>{formatDuration(e.durationSeconds)}</strong>
                  ) : (
                    <span className="badge overdue">running</span>
                  )}
                </td>
                <td className="muted">{e.note ?? ''}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: 12 }}
                    onClick={() => deleteEntry(e.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ManualEntryForm({
  taskId,
  onSaved,
}: {
  taskId: string;
  onSaved: () => void;
}) {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [startedAt, setStartedAt] = useState(toLocalInput(oneHourAgo));
  const [endedAt, setEndedAt] = useState(toLocalInput(now));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await timeEntriesApi.addManual({
        taskId,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        note: note || null,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="col"
      style={{ marginBottom: 12, padding: 8, background: 'var(--bg, #fafafa)', borderRadius: 6 }}
    >
      {error ? <div className="error">{error}</div> : null}
      <div className="grid cols-2">
        <label>
          Started
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            required
          />
        </label>
        <label>
          Ended
          <input
            type="datetime-local"
            value={endedAt}
            onChange={(e) => setEndedAt(e.target.value)}
            required
          />
        </label>
      </div>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn" type="submit">
          Save entry
        </button>
      </div>
    </form>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
