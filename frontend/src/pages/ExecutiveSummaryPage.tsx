import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi, type ExecutiveProjectRow, type ExecutiveSummary } from '../api/ai';
import { RiskBadge } from '../components/RiskBadge';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, formatDateTime, formatDuration } from '../utils/format';

export function ExecutiveSummaryPage() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [windowDays, setWindowDays] = useState(7);
  const [department, setDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    aiApi
      .executiveSummary({ windowDays, department: department || undefined })
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowDays, department]);

  return (
    <div className="col">
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>Executive summary</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            Portfolio rollup across active projects, recomputed on demand.
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <label>
            Window
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              style={{ marginLeft: 6 }}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </label>
          <label>
            Department
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="(any)"
              style={{ marginLeft: 6, width: 140 }}
            />
          </label>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {!summary ? <div className="muted">Loading…</div> : <SummaryBody summary={summary} />}
    </div>
  );
}

function SummaryBody({ summary }: { summary: ExecutiveSummary }) {
  return (
    <>
      <div className="card ai-card">
        <div className="ai-headline">{summary.headline}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Generated {formatDateTime(summary.generatedAt)} · window {summary.windowDays} days
        </div>
      </div>

      <div className="grid cols-4">
        <Stat label="Active projects" value={summary.totals.activeProjects} />
        <Stat label="Open tasks" value={summary.totals.openTasks} />
        <Stat
          label="Overdue tasks"
          value={summary.totals.overdueTasks}
          danger={summary.totals.overdueTasks > 0}
        />
        <Stat label="Blocked tasks" value={summary.totals.blockedTasks} />
        <Stat label={`Done in last ${summary.windowDays}d`} value={summary.totals.completedThisWeek} />
        <Stat label={`Logged hours (${summary.windowDays}d)`} value={summary.totals.loggedHoursThisWeek} />
      </div>

      <div className="grid cols-2">
        <ProjectList title="Needs attention" rows={summary.attention} emptyText="No risky projects." showRisk />
        <ProjectList
          title={`Top movers · last ${summary.windowDays} days`}
          rows={summary.movers}
          emptyText="No tasks completed in this window."
          metric={(r) => `${r.taskCompletionsThisWeek} done`}
        />
        <ProjectList
          title="Stalled (active, no recent activity)"
          rows={summary.stalled}
          emptyText="Everything has had recent activity."
          metric={(r) => `last activity ${formatDate(r.recentlyUpdatedAt)}`}
        />
        <DepartmentTable rows={summary.byDepartment} />
      </div>
    </>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="subtle-card">
      <div className="muted">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: danger ? 'var(--danger)' : undefined }}>
        {value}
      </div>
    </div>
  );
}

function ProjectList({
  title,
  rows,
  emptyText,
  metric,
  showRisk,
}: {
  title: string;
  rows: ExecutiveProjectRow[];
  emptyText: string;
  metric?: (r: ExecutiveProjectRow) => string;
  showRisk?: boolean;
}) {
  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{title}</h2>
      {rows.length === 0 ? (
        <div className="muted">{emptyText}</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {rows.map((r) => (
            <li
              key={r.projectId}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                padding: '6px 0',
                borderBottom: '1px solid var(--border, #eee)',
              }}
            >
              <Link to={`/projects/${r.projectId}`} style={{ flex: 1 }}>
                {r.name}
              </Link>
              <StatusBadge status={r.status} />
              {showRisk ? <RiskBadge risk={r.risk} /> : null}
              <span className="muted" style={{ fontSize: 12, minWidth: 120, textAlign: 'right' }}>
                {metric ? metric(r) : `${r.openTasks} open · ${formatDuration(r.loggedSeconds)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DepartmentTable({
  rows,
}: {
  rows: { department: string; activeProjects: number; openTasks: number; overdueTasks: number }[];
}) {
  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>By department</h2>
      {rows.length === 0 ? (
        <div className="muted">No departments yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Active</th>
              <th>Open</th>
              <th>Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.department}>
                <td>{r.department}</td>
                <td>{r.activeProjects}</td>
                <td>{r.openTasks}</td>
                <td style={{ color: r.overdueTasks > 0 ? 'var(--danger)' : undefined }}>
                  {r.overdueTasks}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
