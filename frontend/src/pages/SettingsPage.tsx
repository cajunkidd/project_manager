import { useEffect, useState } from 'react';
import {
  apiTokensApi,
  webhooksApi,
  type ApiTokenRecord,
  type ApiTokenScope,
  type WebhookEvent,
  type WebhookSubscription,
} from '../api/integrations';
import { formatDate } from '../utils/format';

type Tab = 'tokens' | 'webhooks';

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

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('tokens');

  return (
    <div className="col">
      <div className="page-header">
        <h1>Settings</h1>
      </div>
      <div className="row" style={{ gap: 4 }}>
        <button
          type="button"
          className={`btn ${tab === 'tokens' ? '' : 'btn-secondary'}`}
          onClick={() => setTab('tokens')}
        >
          API tokens
        </button>
        <button
          type="button"
          className={`btn ${tab === 'webhooks' ? '' : 'btn-secondary'}`}
          onClick={() => setTab('webhooks')}
        >
          Webhooks
        </button>
      </div>
      {tab === 'tokens' ? <ApiTokensTab /> : <WebhooksTab />}
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
          Use Bearer tokens against the public API at <code>/api/v1/*</code>. The
          raw token value is only shown once.
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
          <div
            className="subtle-card"
            style={{ marginTop: 12, borderColor: 'var(--primary)' }}
          >
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
          <code> X-Webhook-Signature</code> header signed with the
          subscription secret.
        </p>
        <form onSubmit={onCreate} className="form-grid">
          <div className="full">
            <label htmlFor="hook-name">Name</label>
            <input
              id="hook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
          <div
            className="subtle-card"
            style={{ marginTop: 12, borderColor: 'var(--primary)' }}
          >
            <div className="muted" style={{ fontSize: 12 }}>
              Webhook secret for "{createdSecret.name}" — also retrievable from
              the API; treat it like a password
            </div>
            <code style={{ wordBreak: 'break-all', fontSize: 13 }}>
              {createdSecret.secret}
            </code>
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
