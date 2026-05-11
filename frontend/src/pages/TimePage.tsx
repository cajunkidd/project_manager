import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { http } from '../api/client';
import {
  formatMinutes,
  timeEntriesApi,
  type SummaryGroupBy,
  type TimeEntry,
  type TimeSummary,
} from '../api/time-entries';
import type { Project } from '../types';
import { formatDate } from '../utils/format';

function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

export function TimePage() {
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [groupBy, setGroupBy] = useState<SummaryGroupBy>('project');
  const [from, setFrom] = useState(startOfWeek().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      mine: scope === 'mine',
      projectId: projectId || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    }),
    [scope, projectId, from, to],
  );

  const reload = useCallback(() => {
    Promise.all([
      timeEntriesApi.list(filters),
      timeEntriesApi.summary(groupBy, filters),
    ])
      .then(([list, sum]) => {
        setEntries(list);
        setSummary(sum);
      })
      .catch((err) => setError(err.message));
  }, [filters, groupBy]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    http.get<Project[]>('/projects').then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <div className="col">
      <div className="page-header">
        <h1>Time</h1>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="card row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {isManager ? (
          <label className="col">
            <span className="muted">Scope</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as 'mine' | 'team')}>
              <option value="mine">My time</option>
              <option value="team">All users</option>
            </select>
          </label>
        ) : null}
        <label className="col">
          <span className="muted">Project</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— All projects —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="col">
          <span className="muted">From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="col">
          <span className="muted">To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="col">
          <span className="muted">Group by</span>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as SummaryGroupBy)}>
            <option value="project">Project</option>
            <option value="task">Task</option>
            <option value="user">User</option>
            <option value="day">Day</option>
          </select>
        </label>
      </div>

      {summary ? (
        <div className="card">
          <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
            Summary —{' '}
            <span className="muted" style={{ fontWeight: 400 }}>
              {formatMinutes(summary.totals.minutes)} total ·{' '}
              {formatMinutes(summary.totals.billableMinutes)} billable ·{' '}
              {summary.totals.entries} entries
            </span>
          </h2>
          {summary.rows.length === 0 ? (
            <div className="muted">No time logged in this range.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{summary.groupBy === 'day' ? 'Day' : summary.groupBy}</th>
                  <th>Total</th>
                  <th>Billable</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td>{formatMinutes(r.minutes)}</td>
                    <td>{formatMinutes(r.billableMinutes)}</td>
                    <td>{r.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Entries ({entries.length})</h2>
        {entries.length === 0 ? (
          <div className="muted">No entries to show.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Task</th>
                <th>Minutes</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.loggedAt)}</td>
                  <td className="muted">{e.user?.displayName ?? '—'}</td>
                  <td>
                    {e.task ? <Link to={`/tasks/${e.task.id}`}>{e.task.title}</Link> : '—'}
                  </td>
                  <td>
                    {formatMinutes(e.minutes)}
                    {!e.billable ? (
                      <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>
                        (non-billable)
                      </span>
                    ) : null}
                  </td>
                  <td className="muted">{e.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
