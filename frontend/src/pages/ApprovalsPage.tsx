import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsApi, type Approval, type ApprovalStatus } from '../api/approvals';
import { formatDate } from '../utils/format';

const STATUSES: { value: ApprovalStatus | ''; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export function ApprovalsPage() {
  const [status, setStatus] = useState<ApprovalStatus | ''>('pending');
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    approvalsApi
      .list({ mine: true, status: status || undefined })
      .then(setApprovals)
      .catch((err) => setError(err.message));
  }, [status]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function decide(id: string, newStatus: 'approved' | 'rejected') {
    await approvalsApi.decide(id, { status: newStatus });
    reload();
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>My Approvals</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value as ApprovalStatus | '')}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        {approvals.length === 0 ? (
          <div className="muted">Nothing to review.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>From</th>
                <th>Requested</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.task ? <Link to={`/tasks/${a.task.id}`}>{a.task.title}</Link> : '—'}
                    {a.requestComment ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        “{a.requestComment}”
                      </div>
                    ) : null}
                  </td>
                  <td className="muted">{a.requestedBy?.displayName ?? '—'}</td>
                  <td className="muted">{formatDate(a.requestedAt)}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background:
                          a.status === 'approved'
                            ? '#d4f8d4'
                            : a.status === 'rejected'
                              ? '#fde2e2'
                              : undefined,
                      }}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td>
                    {a.status === 'pending' ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '2px 8px', fontSize: 12 }}
                          onClick={() => decide(a.id, 'approved')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '2px 8px', fontSize: 12 }}
                          onClick={() => decide(a.id, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    ) : a.decisionComment ? (
                      <span className="muted" style={{ fontSize: 12 }}>
                        “{a.decisionComment}”
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
