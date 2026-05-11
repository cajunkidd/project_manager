import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi, type DuplicateGroup, type ExtractedTask } from '../api/ai';
import { http } from '../api/client';
import { projectsApi } from '../api/projects';
import { tasksApi } from '../api/tasks';
import { PriorityBadge } from '../components/PriorityBadge';
import type { Priority, Project, TaskStatus, User } from '../types';
import { formatDate } from '../utils/format';

interface DraftTask extends ExtractedTask {
  selected: boolean;
  assignedToId: string | null;
}

const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent'];

export function AITasksPage() {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<DraftTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[] | null>(null);
  const [dupBusy, setDupBusy] = useState(false);
  const [dupProjectId, setDupProjectId] = useState('');

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(() => undefined);
    http.get<User[]>('/users').then(setUsers).catch(() => undefined);
  }, []);

  async function scanDuplicates() {
    setDupBusy(true);
    try {
      const res = await aiApi.findDuplicates(
        dupProjectId ? { projectId: dupProjectId } : {},
      );
      setDupGroups(res.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan duplicates');
    } finally {
      setDupBusy(false);
    }
  }

  async function extract() {
    setError(null);
    setBusy(true);
    setCreatedCount(0);
    try {
      const res = await aiApi.extractTasks(text);
      setDrafts(
        res.tasks.map((t) => ({
          ...t,
          selected: true,
          assignedToId: null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(idx: number, patch: Partial<DraftTask>) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }

  async function createSelected() {
    if (!drafts.some((d) => d.selected)) return;
    setBusy(true);
    setError(null);
    setCreatedCount(0);
    try {
      let count = 0;
      for (const draft of drafts) {
        if (!draft.selected) continue;
        await tasksApi.create({
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          status: draft.status,
          dueDate: draft.dueDate,
          projectId: projectId || null,
          assignedToId: draft.assignedToId || null,
        });
        count += 1;
      }
      setCreatedCount(count);
      setDrafts([]);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>AI task extraction</h1>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        Paste meeting notes, an email thread, or any rough plan. The system will
        suggest discrete tasks for review before anything is created.
      </p>

      <div className="card col">
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Example:\n- Replace the switch in Lake Charles\n- Verify cabling\n- Update documentation by Friday\n- Notify the store manager once complete`}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setText('');
              setDrafts([]);
              setError(null);
              setCreatedCount(0);
            }}
            disabled={busy}
          >
            Clear
          </button>
          <button
            className="btn"
            type="button"
            onClick={extract}
            disabled={busy || !text.trim()}
          >
            {busy ? 'Working…' : 'Extract tasks'}
          </button>
        </div>
        {error ? <div className="error">{error}</div> : null}
        {createdCount > 0 ? (
          <div className="muted">
            Created {createdCount} task{createdCount === 1 ? '' : 's'}.
          </div>
        ) : null}
      </div>

      <div className="card col">
        <div className="page-header" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Duplicate task detection</h2>
          <div className="row" style={{ gap: 8 }}>
            <select
              value={dupProjectId}
              onChange={(e) => setDupProjectId(e.target.value)}
              style={{ maxWidth: 240 }}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button className="btn" type="button" onClick={scanDuplicates} disabled={dupBusy}>
              {dupBusy ? 'Scanning…' : 'Scan for duplicates'}
            </button>
          </div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Compares open task titles using token Jaccard similarity. Closed and
          cancelled tasks are skipped.
        </p>
        {dupGroups === null ? null : dupGroups.length === 0 ? (
          <div className="muted">No duplicate clusters found.</div>
        ) : (
          <ul style={{ paddingLeft: 0, listStyle: 'none', margin: 0 }}>
            {dupGroups.map((group, idx) => (
              <li
                key={idx}
                style={{
                  border: '1px solid var(--border, #eee)',
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>
                  Similarity ≈ {(group.similarity * 100).toFixed(0)}%
                </div>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {group.tasks.map((t) => (
                    <li key={t.id}>
                      <Link to={`/tasks/${t.id}`}>{t.title}</Link>
                      <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>
                        ({t.status})
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {drafts.length > 0 ? (
        <div className="card">
          <div className="page-header" style={{ marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Suggested tasks ({drafts.length})</h2>
            <div className="row">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{ maxWidth: 240 }}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="btn" type="button" onClick={createSelected} disabled={busy}>
                {busy ? 'Creating…' : `Create selected`}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Title</th>
                <th>Priority</th>
                <th>Due</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="checkbox"
                      checked={d.selected}
                      onChange={(e) => updateDraft(idx, { selected: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                  </td>
                  <td>
                    <input
                      value={d.title}
                      onChange={(e) => updateDraft(idx, { title: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={d.priority}
                      onChange={(e) => updateDraft(idx, { priority: e.target.value as Priority })}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>{' '}
                    <PriorityBadge priority={d.priority} />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={d.dueDate ? d.dueDate.slice(0, 10) : ''}
                      onChange={(e) =>
                        updateDraft(idx, {
                          dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                    />
                    {d.dueDate ? (
                      <div className="muted" style={{ fontSize: 11 }}>
                        {formatDate(d.dueDate)}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <select
                      value={d.assignedToId ?? ''}
                      onChange={(e) =>
                        updateDraft(idx, { assignedToId: e.target.value || null })
                      }
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
