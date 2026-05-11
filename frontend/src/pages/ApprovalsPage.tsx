import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsApi } from '../api/advanced';
import { useAuth } from '../auth/AuthContext';
import type { ApprovalRequest, ApprovalStatus } from '../types';
import { formatDate } from '../utils/format';

export function ApprovalsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<ApprovalStatus | ''>('pending');
  const [error, setError] = useState<string | null>(null);

  const canDecide = user?.role === 'admin' || user?.role === 'manager';

  const reload = useCallback(() => {
    approvalsApi
      .list({ status: filter || undefined })
      .then(setRequests)
      .catch((err) => setError(err.message));
  }, [filter]);

  useEffect(() => reload(), [reload]);

  async function decide(id: string, decision: 'approve' | 'reject') {
    const note = window.prompt(`Optional note for ${decision}:`) ?? '';
    try {
      if (decision === 'approve') await approvalsApi.approve(id, note);
      else await approvalsApi.reject(id, note);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function cancel(id: string) {
    await approvalsApi.cancel(id);
    reload();
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Approvals</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ApprovalStatus | '')}
          style={{ maxWidth: 200 }}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        {requests.length === 0 ? (
          <div className="muted">No requests match.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Requester</th>
                <th>Reason</th>
                <th>Target status</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.entityType === 'task' ? (
                      <Link to={`/tasks/${r.entityId}`}>task</Link>
                    ) : (
                      <Link to={`/projects/${r.entityId}`}>project</Link>
                    )}
                  </td>
                  <td className="muted">{r.requestedBy?.displayName ?? '—'}</td>
                  <td className="muted">{r.reason ?? '—'}</td>
                  <td className="muted">{r.targetStatus ?? '—'}</td>
                  <td>
                    <span className={`badge${r.status === 'rejected' ? ' overdue' : ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="muted">{formatDate(r.createdAt)}</td>
                  <td className="row" style={{ gap: 6 }}>
                    {r.status === 'pending' && canDecide ? (
                      <>
                        <button className="btn" onClick={() => decide(r.id, 'approve')}>
                          Approve
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => decide(r.id, 'reject')}
                        >
                          Reject
                        </button>
                      </>
                    ) : null}
                    {r.status === 'pending' && r.requestedById === user?.id ? (
                      <button className="btn btn-secondary" onClick={() => cancel(r.id)}>
                        Cancel
                      </button>
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
