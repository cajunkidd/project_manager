import { useCallback, useEffect, useState } from 'react';
import { approvalsApi, type Approval } from '../api/approvals';
import { http } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { User } from '../types';
import { formatDate } from '../utils/format';

interface Props {
  taskId: string;
}

export function ApprovalsCard({ taskId }: Props) {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [approverId, setApproverId] = useState('');
  const [comment, setComment] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    approvalsApi.listForTask(taskId).then(setApprovals).catch((err) => setError(err.message));
  }, [taskId]);

  useEffect(() => {
    reload();
    http.get<User[]>('/users').then(setUsers).catch(() => setUsers([]));
  }, [reload]);

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await approvalsApi.request(taskId, {
        approverId,
        requestComment: comment || null,
      });
      setApproverId('');
      setComment('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request approval');
    }
  }

  async function onDecide(approval: Approval, status: 'approved' | 'rejected') {
    try {
      await approvalsApi.decide(approval.id, {
        status,
        decisionComment: decisionComment || null,
      });
      setDecisionComment('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decide');
    }
  }

  async function onCancel(id: string) {
    if (!window.confirm('Cancel this approval request?')) return;
    await approvalsApi.cancel(id);
    reload();
  }

  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Approvals</h2>
      {error ? <div className="error">{error}</div> : null}

      {pending.length === 0 ? (
        <div className="muted">No pending approvals.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {pending.map((a) => {
            const isApprover = a.approverId === user?.id;
            const isRequester = a.requestedById === user?.id;
            return (
              <li
                key={a.id}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border, #eee)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge">Pending</span>
                  <span>
                    <strong>{a.requestedBy?.displayName ?? 'Someone'}</strong> asked{' '}
                    <strong>{a.approver?.displayName ?? 'someone'}</strong>
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {formatDate(a.requestedAt)}
                  </span>
                </div>
                {a.requestComment ? (
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    “{a.requestComment}”
                  </div>
                ) : null}
                {isApprover ? (
                  <div className="col" style={{ gap: 6, marginTop: 8 }}>
                    <input
                      placeholder="Optional decision comment"
                      value={decisionComment}
                      onChange={(e) => setDecisionComment(e.target.value)}
                    />
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => onDecide(a, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onDecide(a, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : isRequester ? (
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => onCancel(a.id)}
                    >
                      Cancel request
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 ? (
        <ul style={{ margin: '8px 0 0', paddingLeft: 0, listStyle: 'none' }}>
          {decided.map((a) => (
            <li
              key={a.id}
              style={{ padding: '4px 0', fontSize: 13 }}
              className="muted"
            >
              <span
                className="badge"
                style={{ background: a.status === 'approved' ? '#d4f8d4' : '#fde2e2' }}
              >
                {a.status}
              </span>{' '}
              by {a.approver?.displayName ?? '—'} · {formatDate(a.decidedAt)}
              {a.decisionComment ? <em> — “{a.decisionComment}”</em> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onRequest} className="row" style={{ marginTop: 12, gap: 8 }}>
        <select
          value={approverId}
          onChange={(e) => setApproverId(e.target.value)}
          required
          style={{ flex: 1 }}
        >
          <option value="">Request approval from…</option>
          {users
            .filter((u) => u.id !== user?.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
        </select>
        <input
          placeholder="Optional context"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn" type="submit" disabled={!approverId}>
          Request
        </button>
      </form>
    </div>
  );
}
