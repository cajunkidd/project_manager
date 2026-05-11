import { useEffect, useRef, useState } from 'react';
import {
  apiTokensApi,
  externalSystemsApi,
  gmailApi,
  mondayApi,
  outlookApi,
  webhooksApi,
  type ApiTokenRecord,
  type ApiTokenScope,
  type ExternalSystem,
  type ExternalSystemKind,
  type GmailStatus,
  type WebhookEvent,
  type WebhookSubscription,
} from '../api/integrations';
import { formatDate } from '../utils/format';

type Tab = 'tokens' | 'webhooks' | 'gmail' | 'integrations' | 'imports';

const SCOPES: ApiTokenScope[] = [
  'tasks:read',
  'tasks:write',
  'projects:read',
  'projects:write',
  'forms:submit',
];

const EVENTS: WebhookEvent[] = [
  'task.created',
  'task.updated',
  'task.status_changed',
  'project.created',
  'project.updated',
  'comment.created',
  'form.submitted',
];

const SYSTEM_KINDS: ExternalSystemKind[] = [
  'teams',
  'outlook',
  'erp',
  'asset',
  'intranet',
  'monday',
  'other',
];

const TABS: { id: Tab; label: string }[] = [
  { id: 'tokens', label: 'API tokens' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'gmail', label: 'Gmail' },
  { id: 'integrations', label: 'External systems' },
  { id: 'imports', label: 'Monday import' },
];

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('tokens');

  return (
    <div className="col">
      <div className="page-header">
        <h1>Settings</h1>
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
      {tab === 'tokens' ? <ApiTokensTab /> : null}
      {tab === 'webhooks' ? <WebhooksTab /> : null}
      {tab === 'gmail' ? <GmailTab /> : null}
      {tab === 'integrations' ? <ExternalSystemsTab /> : null}
      {tab === 'imports' ? <MondayImportTab /> : null}
    </div>
  );
}

function ApiTokensTab() {
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiTokenScope[]>(['tasks:read']);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    apiTokensApi.list().then(setTokens).catch((err) => setError(err.message));
  }
  useEffect(() => {
    reload();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedToken(null);
    try {
      const res = await apiTokensApi.create({ name, scopes });
      setCreatedToken(res.token);
      setName('');
      setScopes(['tasks:read']);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }
  async function onRevoke(id: string) {
    if (!window.confirm('Revoke this token? Calls using it will start failing.')) return;
    await apiTokensApi.revoke(id);
    reload();
  }
  function toggleScope(scope: ApiTokenScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  return (
    <div className="col">
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Create new token</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Use Bearer tokens against the public API at <code>/api/v1/*</code>. The raw
          token value is only shown once.
        </p>
        <form onSubmit={onCreate} className="col">
          <div>
            <label htmlFor="token-name">Name</label>
            <input
              id="token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. CI bot"
            />
          </div>
          <div>
            <label>Scopes</label>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {SCOPES.map((scope) => (
                <label
                  key={scope}
                  className="row"
                  style={{ cursor: 'pointer', gap: 4, marginBottom: 0 }}
                >
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    style={{ width: 'auto' }}
                  />
                  <code style={{ fontSize: 13 }}>{scope}</code>
                </label>
              ))}
            </div>
          </div>
          {error ? <div className="error">{error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" type="submit" disabled={!name || scopes.length === 0}>
              Create token
            </button>
          </div>
        </form>
        {createdToken ? (
          <div className="subtle-card" style={{ marginTop: 12, borderColor: 'var(--primary)' }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Save this token — it will not be shown again
            </div>
            <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{createdToken}</code>
          </div>
        ) : null}
      </div>
      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Existing tokens</h2>
        {tokens.length === 0 ? (
          <div className="muted">No API tokens yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th>Created</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.name}</strong>
                  </td>
                  <td>
                    <code>{t.prefix}…</code>
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {t.scopes.join(', ')}
                  </td>
                  <td className="muted">{formatDate(t.lastUsedAt)}</td>
                  <td className="muted">{formatDate(t.createdAt)}</td>
                  <td>
                    <span
                      className={`badge${t.isActive ? ' status-active' : ' status-cancelled'}`}
                    >
                      {t.isActive ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {t.isActive ? (
                      <button
                        type="button"
                        className="link"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => onRevoke(t.id)}
                      >
                        Revoke
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

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<WebhookEvent[]>(['task.created']);
  const [createdSecret, setCreatedSecret] = useState<{ name: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    webhooksApi.list().then(setWebhooks).catch((err) => setError(err.message));
  }
  useEffect(() => {
    reload();
  }, []);
  function toggleEvent(event: WebhookEvent) {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }
  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedSecret(null);
    try {
      const res = await webhooksApi.create({ name, url, events });
      setCreatedSecret({ name: res.name, secret: res.secret });
      setName('');
      setUrl('');
      setEvents(['task.created']);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }
  async function toggleActive(sub: WebhookSubscription) {
    await webhooksApi.update(sub.id, { isActive: !sub.isActive });
    reload();
  }
  async function onRemove(id: string) {
    if (!window.confirm('Delete this webhook subscription?')) return;
    await webhooksApi.remove(id);
    reload();
  }

  return (
    <div className="col">
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>New webhook</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Each delivery includes <code>X-Webhook-Event</code> and an HMAC-SHA256
          <code> X-Webhook-Signature</code> header signed with the subscription secret.
        </p>
        <form onSubmit={onCreate} className="form-grid">
          <div className="full">
            <label htmlFor="hook-name">Name</label>
            <input id="hook-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="full">
            <label htmlFor="hook-url">Delivery URL</label>
            <input
              id="hook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://example.com/webhook"
            />
          </div>
          <div className="full">
            <label>Events</label>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {EVENTS.map((event) => (
                <label
                  key={event}
                  className="row"
                  style={{ cursor: 'pointer', gap: 4, marginBottom: 0 }}
                >
                  <input
                    type="checkbox"
                    checked={events.includes(event)}
                    onChange={() => toggleEvent(event)}
                    style={{ width: 'auto' }}
                  />
                  <code style={{ fontSize: 13 }}>{event}</code>
                </label>
              ))}
            </div>
          </div>
          {error ? <div className="full error">{error}</div> : null}
          <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" type="submit" disabled={!name || !url || events.length === 0}>
              Create webhook
            </button>
          </div>
        </form>
        {createdSecret ? (
          <div className="subtle-card" style={{ marginTop: 12, borderColor: 'var(--primary)' }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Webhook secret for "{createdSecret.name}"
            </div>
            <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{createdSecret.secret}</code>
          </div>
        ) : null}
      </div>
      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Subscriptions</h2>
        {webhooks.length === 0 ? (
          <div className="muted">No webhooks configured.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Events</th>
                <th>Deliveries</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id}>
                  <td>
                    <strong>{w.name}</strong>
                  </td>
                  <td className="muted" style={{ wordBreak: 'break-all' }}>
                    {w.url}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {w.events.join(', ')}
                  </td>
                  <td className="muted">{w.deliveryCount ?? 0}</td>
                  <td>
                    <span
                      className={`badge${w.isActive ? ' status-active' : ' status-cancelled'}`}
                    >
                      {w.isActive ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="link" onClick={() => toggleActive(w)}>
                      {w.isActive ? 'Disable' : 'Enable'}
                    </button>{' '}
                    <button
                      type="button"
                      className="link"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => onRemove(w.id)}
                    >
                      Delete
                    </button>
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

function GmailTab() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollResult, setPollResult] = useState<string | null>(null);

  function reload() {
    gmailApi.status().then(setStatus).catch((err) => setError(err.message));
  }
  useEffect(() => {
    reload();
    outlookApi.myCalendarUrl().then((d) => setCalendarUrl(d.url)).catch(() => undefined);
  }, []);

  async function onConnect() {
    setError(null);
    try {
      const res = await gmailApi.startOAuth();
      window.open(res.authorizeUrl, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth');
    }
  }
  async function onDisconnect() {
    if (!window.confirm('Disconnect this Gmail account from Project Manager?')) return;
    await gmailApi.disconnect();
    reload();
  }
  async function onSaveLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    await gmailApi.setLabel(label.trim());
    setLabel('');
    reload();
  }
  async function onPoll() {
    setPolling(true);
    setPollResult(null);
    try {
      const res = await gmailApi.pollNow();
      setPollResult(
        res.error
          ? `Failed: ${res.error}`
          : `Imported ${res.processed} message(s), created ${res.taskIds.length} task(s).`,
      );
      reload();
    } finally {
      setPolling(false);
    }
  }

  return (
    <div className="col">
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Gmail connection</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Connect your Gmail account to ingest labeled emails as tasks. Requires
          <code> GMAIL_CLIENT_ID</code> / <code>GMAIL_CLIENT_SECRET</code> to be configured
          on the server.
        </p>
        {error ? <div className="error">{error}</div> : null}
        {!status ? (
          <div className="muted">Loading…</div>
        ) : status.connected ? (
          <div className="col">
            <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Connected as</div>
                <strong>{status.email}</strong>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Label</div>
                <code>{status.labelName}</code>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Last poll</div>
                <div>{formatDate(status.lastPolledAt ?? null)}</div>
              </div>
            </div>
            {status.lastError ? (
              <div className="error" style={{ fontSize: 12 }}>
                Last poll error: {status.lastError}
              </div>
            ) : null}
            <form onSubmit={onSaveLabel} className="row" style={{ alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="gmail-label">Change polled label</label>
                <input
                  id="gmail-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={status.labelName}
                />
              </div>
              <button className="btn btn-secondary" type="submit" disabled={!label.trim()}>
                Save label
              </button>
            </form>
            <div className="row">
              <button className="btn" type="button" onClick={onPoll} disabled={polling}>
                {polling ? 'Polling…' : 'Poll Gmail now'}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={onDisconnect}
                style={{ color: 'var(--danger)' }}
              >
                Disconnect
              </button>
            </div>
            {pollResult ? <div className="muted">{pollResult}</div> : null}
          </div>
        ) : (
          <div className="col">
            <p style={{ marginTop: 0 }}>
              Not connected. Click below to authorize Gmail access. A new browser tab
              opens for Google's consent screen, then closes itself.
            </p>
            <button className="btn" type="button" onClick={onConnect} style={{ width: 220 }}>
              Connect Gmail
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Outlook calendar feed</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Subscribe to this URL in Outlook (Add calendar → From internet) to see
          your tasks alongside your meetings. The URL contains a private token —
          don't share it.
        </p>
        {calendarUrl ? (
          <div className="subtle-card">
            <code style={{ wordBreak: 'break-all', fontSize: 12 }}>{calendarUrl}</code>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigator.clipboard.writeText(calendarUrl)}
              >
                Copy
              </button>
            </div>
          </div>
        ) : (
          <div className="muted">Loading…</div>
        )}
      </div>
    </div>
  );
}

function ExternalSystemsTab() {
  const [systems, setSystems] = useState<ExternalSystem[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ExternalSystemKind>('teams');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [linkTemplate, setLinkTemplate] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reload() {
    externalSystemsApi.list().then(setSystems).catch((err) => setError(err.message));
  }
  useEffect(() => {
    reload();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const config: Record<string, unknown> = {};
    if (webhookUrl) config.webhookUrl = webhookUrl;
    if (linkTemplate) config.linkTemplate = linkTemplate;
    try {
      await externalSystemsApi.create({ name, kind, config });
      setName('');
      setWebhookUrl('');
      setLinkTemplate('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }
  async function onToggle(sys: ExternalSystem) {
    await externalSystemsApi.update(sys.id, { isActive: !sys.isActive });
    reload();
  }
  async function onRemove(id: string) {
    if (!window.confirm('Delete this external system?')) return;
    await externalSystemsApi.remove(id);
    reload();
  }

  return (
    <div className="col">
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Register external system</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          <strong>Teams:</strong> set webhook URL → posts task/project events as
          MessageCards. <strong>ERP / Asset / Intranet:</strong> set a link
          template like <code>{'https://erp.example.com/wo/{id}'}</code> so links
          created on tasks auto-render the right URL.
        </p>
        <form onSubmit={onCreate} className="form-grid">
          <div>
            <label htmlFor="sys-name">Name</label>
            <input id="sys-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="sys-kind">Kind</label>
            <select
              id="sys-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ExternalSystemKind)}
            >
              {SYSTEM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="full">
            <label htmlFor="sys-webhook">Webhook URL (Teams)</label>
            <input
              id="sys-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://outlook.office.com/webhook/…"
            />
          </div>
          <div className="full">
            <label htmlFor="sys-template">Link template (ERP/Asset/Intranet)</label>
            <input
              id="sys-template"
              value={linkTemplate}
              onChange={(e) => setLinkTemplate(e.target.value)}
              placeholder="https://erp.example.com/wo/{id}"
            />
          </div>
          {error ? <div className="full error">{error}</div> : null}
          <div className="full" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" type="submit" disabled={!name}>
              Add system
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Registered systems</h2>
        {systems.length === 0 ? (
          <div className="muted">No external systems yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Config</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {systems.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>
                    <span className="badge">{s.kind}</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                    {JSON.stringify(s.config)}
                  </td>
                  <td>
                    <span
                      className={`badge${s.isActive ? ' status-active' : ' status-cancelled'}`}
                    >
                      {s.isActive ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="link" onClick={() => onToggle(s)}>
                      {s.isActive ? 'Disable' : 'Enable'}
                    </button>{' '}
                    <button
                      type="button"
                      className="link"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => onRemove(s.id)}
                    >
                      Delete
                    </button>
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

function MondayImportTab() {
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = await file.text();
    setText(body);
  }

  async function onRun() {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const parsed = JSON.parse(text);
      const summary = await mondayApi.import(parsed);
      setResult(
        `Imported ${summary.projectsCreated} project(s) and ${summary.tasksCreated} task(s). ` +
          `Matched ${summary.usersMatched} user(s), provisioned ${summary.usersCreated}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="col">
      <div className="card">
        <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>Monday.com import</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Paste a Monday.com JSON export, or upload the file. We accept the
          GraphQL <code>boards {'{ items_page { items { ... } } }'}</code>
          shape, normalize status and priority enums, and link assignees to
          existing users by email (creating placeholders for unknown emails).
        </p>
        <div className="col">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder='{"boards":[{"name":"…","items":[…]}]}'
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          {error ? <div className="error">{error}</div> : null}
          {result ? <div className="subtle-card">{result}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn" type="button" disabled={!text || running} onClick={onRun}>
              {running ? 'Importing…' : 'Run import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
