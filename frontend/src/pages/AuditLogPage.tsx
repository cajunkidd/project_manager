import { useCallback, useEffect, useMemo, useState } from 'react';
import { auditApi, type AuditEntry, type AuditFilters } from '../api/audit';
import { formatDate } from '../utils/format';

const ENTITY_TYPES = ['', 'task', 'project', 'comment'];

function formatValue(value: string | null): string {
  if (!value) return '—';
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
  } catch {
    return value;
  }
}

export function AuditLogPage() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const effectiveFilters = useMemo<AuditFilters>(
    () => ({
      ...filters,
      from: filters.from ? new Date(filters.from).toISOString() : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : undefined,
    }),
    [filters],
  );

  const reload = useCallback(() => {
    auditApi.list(effectiveFilters).then(setEntries).catch((err) => setError(err.message));
  }, [effectiveFilters]);

  useEffect(() => {
    reload();
  }, [reload]);

  function setFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
  }

  async function onDownload() {
    try {
      await auditApi.downloadCsv(effectiveFilters);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  }

  return (
    <div className="col">
      <div className="page-header">
        <h1>Audit Log</h1>
        <button className="btn" onClick={onDownload}>
          Download CSV
        </button>
      </div>
      {error ? <div className="error">{error}</div> : null}

      <div className="card row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="col">
          <span className="muted">Entity type</span>
          <select
            value={filters.entityType ?? ''}
            onChange={(e) => setFilter('entityType', e.target.value)}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || '— Any —'}
              </option>
            ))}
          </select>
        </label>
        <label className="col">
          <span className="muted">Action</span>
          <input
            placeholder="created, updated, …"
            value={filters.action ?? ''}
            onChange={(e) => setFilter('action', e.target.value)}
          />
        </label>
        <label className="col">
          <span className="muted">Entity ID</span>
          <input
            placeholder="uuid"
            value={filters.entityId ?? ''}
            onChange={(e) => setFilter('entityId', e.target.value)}
          />
        </label>
        <label className="col">
          <span className="muted">User ID</span>
          <input
            placeholder="uuid"
            value={filters.userId ?? ''}
            onChange={(e) => setFilter('userId', e.target.value)}
          />
        </label>
        <label className="col">
          <span className="muted">From</span>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => setFilter('from', e.target.value)}
          />
        </label>
        <label className="col">
          <span className="muted">To</span>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => setFilter('to', e.target.value)}
          />
        </label>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </h2>
        {entries.length === 0 ? (
          <div className="muted">No activity matches these filters.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Old → New</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.createdAt)}</td>
                  <td className="muted">{e.user?.displayName ?? '—'}</td>
                  <td>
                    <div>{e.entityType}</div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {e.entityId.slice(0, 8)}…
                    </div>
                  </td>
                  <td>
                    <span className="badge">{e.action}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {e.oldValue ? (
                      <div className="muted">{formatValue(e.oldValue)}</div>
                    ) : null}
                    {e.newValue ? <div>{formatValue(e.newValue)}</div> : null}
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
