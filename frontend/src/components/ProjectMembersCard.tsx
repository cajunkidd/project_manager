import { useCallback, useEffect, useMemo, useState } from 'react';
import { http } from '../api/client';
import { membersApi } from '../api/members';
import { useAuth } from '../auth/AuthContext';
import type { ProjectMember, ProjectMemberRole, User } from '../types';

const ROLE_LABELS: Record<ProjectMemberRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

export function ProjectMembersCard({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickUserId, setPickUserId] = useState('');
  const [pickRole, setPickRole] = useState<ProjectMemberRole>('editor');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    membersApi
      .list(projectId)
      .then((m) => {
        setMembers(m);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => reload(), [reload]);

  useEffect(() => {
    http
      .get<User[]>('/users')
      .then(setUsers)
      .catch(() => undefined);
  }, []);

  const myMembership = useMemo(
    () => members.find((m) => m.userId === user?.id) ?? null,
    [members, user],
  );
  const isOwner = myMembership?.role === 'owner' || user?.role === 'admin';
  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const candidates = useMemo(
    () => users.filter((u) => !memberIds.has(u.id) && u.isActive),
    [users, memberIds],
  );

  async function add() {
    if (!pickUserId) return;
    try {
      setError(null);
      await membersApi.add(projectId, pickUserId, pickRole);
      setPickUserId('');
      setPickRole('editor');
      setPicking(false);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function changeRole(userId: string, role: ProjectMemberRole) {
    try {
      setError(null);
      await membersApi.updateRole(projectId, userId, role);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function remove(userId: string) {
    try {
      setError(null);
      await membersApi.remove(projectId, userId);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

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
        <h2 style={{ margin: 0, fontSize: 16 }}>Members ({members.length})</h2>
        {isOwner && candidates.length > 0 ? (
          <button className="btn btn-secondary" onClick={() => setPicking((v) => !v)}>
            {picking ? 'Cancel' : 'Add member'}
          </button>
        ) : null}
      </div>

      {error ? <div className="error" style={{ marginBottom: 8 }}>{error}</div> : null}

      {picking ? (
        <div className="row" style={{ marginBottom: 12, gap: 8 }}>
          <select value={pickUserId} onChange={(e) => setPickUserId(e.target.value)}>
            <option value="">Choose user…</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName} ({u.email})
              </option>
            ))}
          </select>
          <select
            value={pickRole}
            onChange={(e) => setPickRole(e.target.value as ProjectMemberRole)}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
          <button className="btn" onClick={add} disabled={!pickUserId}>
            Add
          </button>
        </div>
      ) : null}

      {loading && members.length === 0 ? (
        <div className="muted">Loading…</div>
      ) : members.length === 0 ? (
        <div className="muted">No members yet.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isMe = m.userId === user?.id;
              return (
                <tr key={m.id}>
                  <td>{m.user.displayName}</td>
                  <td className="muted">{m.user.email}</td>
                  <td>
                    {isOwner ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          changeRole(m.userId, e.target.value as ProjectMemberRole)
                        }
                        style={{ maxWidth: 140 }}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="owner">Owner</option>
                      </select>
                    ) : (
                      <span className="badge">{ROLE_LABELS[m.role]}</span>
                    )}
                  </td>
                  <td>
                    {isOwner || isMe ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => remove(m.userId)}
                      >
                        {isMe ? 'Leave' : 'Remove'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
