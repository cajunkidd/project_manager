import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeEntriesApi } from '../api/timeEntries';
import type { ProjectTimeSummary as Summary } from '../types';
import { formatDuration } from '../utils/format';

interface Props {
  projectId: string;
}

export function ProjectTimeSummary({ projectId }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    timeEntriesApi
      .projectSummary(projectId)
      .then(setSummary)
      .catch((e) => setError(e.message));
  }, [projectId]);

  if (error) return <div className="error">{error}</div>;
  if (!summary) return null;
  if (summary.totalSeconds === 0) return null; // hide until somebody logs time

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
        Time logged · <span className="muted">{formatDuration(summary.totalSeconds)} total</span>
      </h2>
      <div className="grid cols-2">
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            By person
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.byUser.map((row) => (
              <li key={row.user.id}>
                {row.user.displayName} — <strong>{formatDuration(row.seconds)}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            By task
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {summary.byTask.slice(0, 8).map((row) => (
              <li key={row.task.id}>
                <Link to={`/tasks/${row.task.id}`}>{row.task.title}</Link> —{' '}
                <strong>{formatDuration(row.seconds)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
