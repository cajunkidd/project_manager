import { useCallback, useEffect, useRef, useState } from 'react';
import { attachmentsApi } from '../api/attachments';
import type { Attachment } from '../types';
import { formatDate } from '../utils/format';

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type Props =
  | { taskId: string; projectId?: undefined }
  | { taskId?: undefined; projectId: string };

export function AttachmentsCard(props: Props) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    const loader = props.taskId
      ? attachmentsApi.listForTask(props.taskId)
      : attachmentsApi.listForProject(props.projectId as string);
    loader.then(setItems).catch((err) => setError(err.message));
  }, [props.taskId, props.projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onUpload(file: File) {
    setError(null);
    setBusy(true);
    try {
      if (props.taskId) await attachmentsApi.uploadToTask(props.taskId, file);
      else await attachmentsApi.uploadToProject(props.projectId as string, file);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function onDownload(att: Attachment) {
    try {
      await attachmentsApi.download(att.id, att.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  async function onRemove(id: string) {
    if (!window.confirm('Remove this attachment?')) return;
    await attachmentsApi.remove(id);
    reload();
  }

  return (
    <div className="card">
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Attachments</h2>
      {error ? <div className="error">{error}</div> : null}
      {items.length === 0 ? (
        <div className="muted">No attachments yet.</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {items.map((att) => (
            <li
              key={att.id}
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
                className="link-button"
                onClick={() => onDownload(att)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {att.fileName}
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                {formatBytes(att.fileSize)} · {att.uploadedBy?.displayName ?? 'unknown'} ·{' '}
                {formatDate(att.createdAt)}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 12 }}
                onClick={() => onRemove(att.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 12 }}>
        <input
          ref={inputRef}
          type="file"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
        {busy ? <span className="muted" style={{ marginLeft: 8 }}>Uploading…</span> : null}
      </div>
    </div>
  );
}
