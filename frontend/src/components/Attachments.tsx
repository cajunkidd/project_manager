import { useEffect, useRef, useState } from 'react';
import { attachmentsApi } from '../api/attachments';
import type { AttachmentSummary } from '../types';
import { formatDate } from '../utils/format';

interface Props {
  scope: { type: 'task'; id: string } | { type: 'project'; id: string };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function Attachments({ scope }: Props) {
  const [items, setItems] = useState<AttachmentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function refresh() {
    const p =
      scope.type === 'task'
        ? attachmentsApi.listForTask(scope.id)
        : attachmentsApi.listForProject(scope.id);
    p.then(setItems).catch((e) => setError(e.message));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.type, scope.id]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      if (scope.type === 'task') await attachmentsApi.uploadToTask(scope.id, file);
      else await attachmentsApi.uploadToProject(scope.id, file);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function download(att: AttachmentSummary) {
    setError(null);
    try {
      const blob = await attachmentsApi.fetchBlob(att.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await attachmentsApi.remove(id);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Attachments</h2>
        <div>
          <input
            ref={inputRef}
            type="file"
            onChange={onPick}
            disabled={busy}
            style={{ display: 'none' }}
            id={`upload-${scope.type}-${scope.id}`}
          />
          <label
            htmlFor={`upload-${scope.type}-${scope.id}`}
            className="btn btn-secondary"
            style={{ cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Uploading…' : 'Upload file'}
          </label>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {items.length === 0 ? (
        <div className="muted">No attachments yet.</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {items.map((a) => (
            <li
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderBottom: '1px solid var(--border, #eee)',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '2px 8px' }}
                onClick={() => download(a)}
              >
                {a.fileName}
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                {formatBytes(a.fileSize)} · {formatDate(a.createdAt)}
                {a.uploadedBy ? ` · ${a.uploadedBy.displayName}` : ''}
              </span>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: 12 }}
                onClick={() => remove(a.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
