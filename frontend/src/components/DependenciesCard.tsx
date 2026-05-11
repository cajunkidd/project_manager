import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dependenciesApi } from '../api/advanced';
import { tasksApi } from '../api/tasks';
import { StatusBadge } from './StatusBadge';
import type { Task, TaskDependencyGraph } from '../types';

export function DependenciesCard({ taskId }: { taskId: string }) {
  const [graph, setGraph] = useState<TaskDependencyGraph | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState('');

  const reload = useCallback(() => {
    dependenciesApi
      .list(taskId)
      .then(setGraph)
      .catch((err) => setError(err.message));
  }, [taskId]);

  useEffect(() => {
    reload();
    tasksApi.list().then(setTasks).catch(() => undefined);
  }, [reload]);

  async function add() {
    if (!pick) return;
    try {
      await dependenciesApi.add(taskId, pick);
      setPick('');
      setPicking(false);
      setError(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function remove(blockerTaskId: string) {
    await dependenciesApi.remove(taskId, blockerTaskId);
    reload();
  }

  const candidates = tasks.filter(
    (t) =>
      t.id !== taskId &&
      !graph?.blockedBy.some((b) => b.blockerTaskId === t.id),
  );

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>Dependencies</h2>
        <button className="btn btn-secondary" onClick={() => setPicking((v) => !v)}>
          {picking ? 'Cancel' : 'Add blocker'}
        </button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {picking ? (
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Choose blocker task…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} {t.project ? `(${t.project.name})` : ''}
              </option>
            ))}
          </select>
          <button className="btn" onClick={add} disabled={!pick}>
            Add
          </button>
        </div>
      ) : null}

      <div className="grid cols-2">
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            Blocked by
          </div>
          {graph && graph.blockedBy.length > 0 ? (
            <ul className="ai-bullets">
              {graph.blockedBy.map((b) => (
                <li key={b.id}>
                  <Link to={`/tasks/${b.blockerTask.id}`}>{b.blockerTask.title}</Link>{' '}
                  <StatusBadge status={b.blockerTask.status} />{' '}
                  <button
                    className="btn btn-secondary"
                    style={{ marginLeft: 8 }}
                    onClick={() => remove(b.blockerTask.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">No blockers.</div>
          )}
        </div>
        <div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            Blocking
          </div>
          {graph && graph.blocking.length > 0 ? (
            <ul className="ai-bullets">
              {graph.blocking.map((b) => (
                <li key={b.id}>
                  <Link to={`/tasks/${b.blockedTask.id}`}>{b.blockedTask.title}</Link>{' '}
                  <StatusBadge status={b.blockedTask.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted">Not blocking anything.</div>
          )}
        </div>
      </div>
    </div>
  );
}
