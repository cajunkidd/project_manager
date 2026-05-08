import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formsApi } from '../api/forms';
import { useAuth } from '../auth/AuthContext';
import type { FormSubmission, IntakeForm } from '../types';
import { formatDate } from '../utils/format';

export function FormsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    formsApi
      .list({ onlyActive: !isAdmin })
      .then(setForms)
      .catch((err) => setError(err.message));
    formsApi
      .submissions({ mine: !isAdmin })
      .then(setSubmissions)
      .catch(() => undefined);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  return (
    <div className="col">
      <div className="page-header">
        <h1>Intake Forms</h1>
        {isAdmin ? (
          <Link to="/forms/new" className="btn">
            New form
          </Link>
        ) : null}
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Available forms</h2>
        {forms.length === 0 ? (
          <div className="muted">No forms available.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Default project</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.name}</strong>
                  </td>
                  <td className="muted">{f.description ?? '—'}</td>
                  <td className="muted">{f.defaultProject?.name ?? '—'}</td>
                  <td>
                    <span className={`badge${f.isActive ? ' status-active' : ' status-cancelled'}`}>
                      {f.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/forms/${f.id}/submit`} className="btn btn-secondary">
                      Submit
                    </Link>{' '}
                    {isAdmin ? <Link to={`/forms/${f.id}/edit`}>Edit</Link> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>
          {isAdmin ? 'Recent submissions' : 'My submissions'}
        </h2>
        {submissions.length === 0 ? (
          <div className="muted">No submissions yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Form</th>
                <th>Submitted</th>
                <th>By</th>
                <th>Created task</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>{s.form?.name ?? '—'}</td>
                  <td className="muted">{formatDate(s.createdAt)}</td>
                  <td className="muted">{s.submittedBy?.displayName ?? 'Unknown'}</td>
                  <td>
                    {s.createdTask ? (
                      <Link to={`/tasks/${s.createdTask.id}`}>{s.createdTask.title}</Link>
                    ) : (
                      '—'
                    )}
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
