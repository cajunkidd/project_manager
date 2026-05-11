import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  aiApi,
  type CleanupSuggestion,
  type DuplicateGroup,
  type ExecSummary,
  type MeetingNotesResult,
  type PrioritySuggestion,
} from '../api/ai';

type Tab = 'exec' | 'prioritize' | 'cleanup' | 'duplicates' | 'meeting' | 'email';

const TABS: { id: Tab; label: string }[] = [
  { id: 'exec', label: 'Weekly summary' },
  { id: 'prioritize', label: 'Auto-prioritize' },
  { id: 'cleanup', label: 'Cleanup' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'meeting', label: 'Meeting notes → tasks' },
  { id: 'email', label: 'Email thread' },
];

export function AIInsightsPage() {
  const [tab, setTab] = useState<Tab>('exec');
  return (
    <div className="col">
      <div className="page-header">
        <h1>AI Insights</h1>
      </div>
      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? '' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'exec' ? <ExecPanel /> : null}
      {tab === 'prioritize' ? <PrioritizePanel /> : null}
      {tab === 'cleanup' ? <CleanupPanel /> : null}
      {tab === 'duplicates' ? <DuplicatesPanel /> : null}
      {tab === 'meeting' ? <MeetingNotesPanel /> : null}
      {tab === 'email' ? <EmailPanel /> : null}
    </div>
  );
}

function ExecPanel() {
  const [data, setData] = useState<ExecSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    aiApi.execSummary().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="muted">Loading…</div>;
  return (
    <div className="col">
      <div className="card ai-card">
        <h2 style={{ margin: 0, fontSize: 16 }}>Executive summary</h2>
        <p style={{ marginTop: 8 }}>{data.headline}</p>
        <div className="grid cols-4">
          <Stat label="Active projects" value={data.metrics.activeProjects} />
          <Stat label="Completed" value={data.metrics.completedProjects} />
          <Stat label="Tasks done" value={data.metrics.tasksCompleted} />
          <Stat label="Tasks overdue" value={data.metrics.tasksOverdue} danger={data.metrics.tasksOverdue > 0} />
        </div>
        <h3 style={{ marginTop: 16, fontSize: 14 }}>Recommendations</h3>
        <ul className="ai-bullets">
          {data.recommendations.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
      {data.topRisks.length > 0 ? (
        <div className="card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Top risks</h2>
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Overdue</th>
                <th>Blocked</th>
                <th>Days since update</th>
              </tr>
            </thead>
            <tbody>
              {data.topRisks.map((r) => (
                <tr key={r.projectId}>
                  <td>
                    <Link to={`/projects/${r.projectId}`}>{r.name}</Link>
                  </td>
                  <td>{r.overdueTasks}</td>
                  <td>{r.blockedTasks}</td>
                  <td>{r.daysSinceUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function PrioritizePanel() {
  const [items, setItems] = useState<PrioritySuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    aiApi.prioritize().then((r) => setItems(r.suggestions)).catch((err) => setError(err.message));
  }, []);
  if (error) return <div className="error">{error}</div>;
  if (!items) return <div className="muted">Loading…</div>;
  if (items.length === 0) return <div className="muted">No priority changes suggested.</div>;
  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Current</th>
            <th>Suggested</th>
            <th>Confidence</th>
            <th>Reasons</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.taskId}>
              <td>
                <Link to={`/tasks/${s.taskId}`}>{s.title}</Link>
              </td>
              <td>
                <span className="badge">{s.currentPriority}</span>
              </td>
              <td>
                <span className="badge status-active">{s.suggestedPriority}</span>
              </td>
              <td className="muted">{s.confidence}</td>
              <td className="muted" style={{ fontSize: 12 }}>
                {s.reasons.join(' · ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CleanupPanel() {
  const [items, setItems] = useState<CleanupSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    aiApi.cleanup().then((r) => setItems(r.suggestions)).catch((err) => setError(err.message));
  }, []);
  if (error) return <div className="error">{error}</div>;
  if (!items) return <div className="muted">Loading…</div>;
  if (items.length === 0) return <div className="muted">Backlog looks tidy.</div>;
  return (
    <div className="card">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Action</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, idx) => (
            <tr key={`${s.taskId}:${s.action}:${idx}`}>
              <td>
                <Link to={`/tasks/${s.taskId}`}>{s.title}</Link>
              </td>
              <td>
                <span className="badge">{s.action}</span>
              </td>
              <td className="muted">{s.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DuplicatesPanel() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    aiApi.duplicates().then((r) => setGroups(r.groups)).catch((err) => setError(err.message));
  }, []);
  if (error) return <div className="error">{error}</div>;
  if (!groups) return <div className="muted">Loading…</div>;
  if (groups.length === 0) return <div className="muted">No likely duplicates found.</div>;
  return (
    <div className="col">
      {groups.map((g, idx) => (
        <div key={idx} className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Similarity {Math.round(g.similarity * 100)}%</strong>
            <span className="muted">{g.tasks.length} task(s)</span>
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {g.tasks.map((t) => (
              <li key={t.id}>
                <Link to={`/tasks/${t.id}`}>{t.title}</Link>{' '}
                <span className="muted" style={{ fontSize: 12 }}>({t.status})</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MeetingNotesPanel() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<MeetingNotesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function onRun() {
    setError(null);
    try {
      setResult(await aiApi.meetingNotes(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }
  return (
    <div className="col">
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Paste meeting notes</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={`Weekly Sync — 2026-05-08\n\nAttendees: Alice, Bob\n\nDecisions:\n- Approved switch upgrade\n\nAction Items:\n- Replace switch by 2026-05-15 (Alice)\n- @bob document the runbook`}
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={onRun} disabled={!text.trim()}>
            Parse notes
          </button>
        </div>
        {error ? <div className="error">{error}</div> : null}
      </div>
      {result ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Parsed</h3>
          <p className="muted">{result.summary}</p>
          {result.attendees.length ? (
            <p>
              <strong>Attendees:</strong> {result.attendees.join(', ')}
            </p>
          ) : null}
          {result.decisions.length ? (
            <>
              <h4>Decisions</h4>
              <ul>
                {result.decisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </>
          ) : null}
          {result.actionItems.length ? (
            <>
              <h4>Action items</h4>
              <ul>
                {result.actionItems.map((a, i) => (
                  <li key={i}>
                    <strong>{a.title}</strong>
                    {a.assignee ? ` — ${a.assignee}` : null}
                    {a.dueDate ? ` (due ${new Date(a.dueDate).toLocaleDateString()})` : null}{' '}
                    <span className="badge">{a.priority}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmailPanel() {
  const [body, setBody] = useState('');
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof aiApi.summarizeEmail>> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function onRun() {
    setError(null);
    try {
      setResult(await aiApi.summarizeEmail([{ from: from || 'unknown@example.com', subject, body }]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }
  return (
    <div className="col">
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Summarize a single message</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Paste one email message (or several joined together) and we'll pull out
          action items, questions, and urgency cues.
        </p>
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="From (alice@example.com)"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="Paste the email body…"
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={onRun} disabled={!body.trim()}>
            Summarize
          </button>
        </div>
        {error ? <div className="error">{error}</div> : null}
      </div>
      {result ? (
        <div className="card">
          <p className="muted">{result.summary}</p>
          {result.urgent ? <span className="badge overdue">Urgent</span> : null}
          <h4>Key points</h4>
          <ul>
            {result.keyPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          {result.actionItems.length ? (
            <>
              <h4>Action items</h4>
              <ul>
                {result.actionItems.map((a, i) => (
                  <li key={i}>
                    {a.title} <span className="badge">{a.priority}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {result.questions.length ? (
            <>
              <h4>Open questions</h4>
              <ul>
                {result.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value" style={{ color: danger ? '#b91c1c' : undefined }}>
        {value}
      </div>
    </div>
  );
}
