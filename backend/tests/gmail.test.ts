import { authed, createTestUser } from './helpers';
import { prisma } from '../src/db/prisma';
import { gmailService } from '../src/modules/integrations/gmail.service';
import { setGmailTransport, type FetchLike } from '../src/modules/integrations/gmail.client';

interface FakeRoute {
  match: (url: string, init?: { method?: string }) => boolean;
  respond: () => { status: number; body: unknown };
}

function fakeTransport(routes: FakeRoute[]): FetchLike {
  return async (url, init) => {
    for (const r of routes) {
      if (r.match(url, init)) {
        const { status, body } = r.respond();
        return {
          ok: status >= 200 && status < 300,
          status,
          json: async () => body,
          text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        };
      }
    }
    throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`);
  };
}

function base64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

beforeEach(() => {
  process.env.GMAIL_CLIENT_ID = 'test-client';
  process.env.GMAIL_CLIENT_SECRET = 'test-secret';
});
afterEach(() => {
  setGmailTransport(null);
});

describe('Gmail — OAuth start', () => {
  it('returns a Google authorize URL with state for the current user', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/integrations/gmail/oauth/start');
    expect(res.status).toBe(200);
    const url: string = res.body.authorizeUrl;
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=test-client');
    expect(url).toContain('state=');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('scope=');
  });

  it('errors clearly when client id/secret are missing', async () => {
    delete process.env.GMAIL_CLIENT_ID;
    const user = await createTestUser();
    const res = await authed(user).get('/api/integrations/gmail/oauth/start');
    expect(res.status).toBe(400);
  });
});

describe('Gmail — OAuth callback', () => {
  it('exchanges the code and stores a connection', async () => {
    const user = await createTestUser();
    const startRes = await authed(user).get('/api/integrations/gmail/oauth/start');
    const authorizeUrl = new URL(startRes.body.authorizeUrl);
    const state = authorizeUrl.searchParams.get('state')!;

    setGmailTransport(
      fakeTransport([
        {
          match: (u, init) => u.startsWith('https://oauth2.googleapis.com/token') && init?.method === 'POST',
          respond: () => ({
            status: 200,
            body: {
              access_token: 'access-1',
              refresh_token: 'refresh-1',
              expires_in: 3600,
              scope: 'gmail.modify userinfo.email',
              token_type: 'Bearer',
            },
          }),
        },
        {
          match: (u) => u.startsWith('https://www.googleapis.com/oauth2/v2/userinfo'),
          respond: () => ({ status: 200, body: { email: user.email } }),
        },
      ]),
    );

    const res = await authed(user).get(
      `/api/integrations/gmail/oauth/callback?code=abc&state=${encodeURIComponent(state)}`,
    );
    expect(res.status).toBe(200);
    expect(res.text).toContain('Gmail connected');

    const conn = await prisma.gmailConnection.findUnique({ where: { userId: user.id } });
    expect(conn).not.toBeNull();
    expect(conn!.email).toBe(user.email);
    expect(conn!.refreshToken).toBe('refresh-1');
    expect(conn!.scopes).toContain('gmail.modify');
  });

  it('rejects a tampered state', async () => {
    const user = await createTestUser();
    const res = await authed(user).get(
      '/api/integrations/gmail/oauth/callback?code=abc&state=not.a.valid.state',
    );
    expect(res.status).toBe(400);
  });
});

describe('Gmail — status and disconnect', () => {
  it('returns connected status after OAuth and clears it on disconnect', async () => {
    const user = await createTestUser();
    await prisma.gmailConnection.create({
      data: {
        userId: user.id,
        email: user.email,
        refreshToken: 'r',
        scopes: 'gmail.modify',
      },
    });

    const status = await authed(user).get('/api/integrations/gmail/status');
    expect(status.body.connected).toBe(true);
    expect(status.body.email).toBe(user.email);

    const removed = await authed(user).delete('/api/integrations/gmail/connection');
    expect(removed.status).toBe(204);

    const cleared = await authed(user).get('/api/integrations/gmail/status');
    expect(cleared.body.connected).toBe(false);
  });
});

describe('Gmail — label poller', () => {
  it('ingests an unread labeled message as a task and marks it read', async () => {
    const user = await createTestUser();
    const conn = await prisma.gmailConnection.create({
      data: {
        userId: user.id,
        email: user.email,
        accessToken: 'still-valid',
        refreshToken: 'r',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: 'gmail.modify',
        labelName: 'ProjectManager',
      },
    });

    const labelId = 'Label_42';
    const messageId = 'msg-1';
    const modifyCalls: { url: string; body: string | undefined }[] = [];

    setGmailTransport(
      fakeTransport([
        {
          match: (u) => u.endsWith('/labels'),
          respond: () => ({
            status: 200,
            body: { labels: [{ id: labelId, name: 'ProjectManager' }] },
          }),
        },
        {
          match: (u) => u.includes('/messages?') && u.includes('q='),
          respond: () => ({
            status: 200,
            body: { messages: [{ id: messageId }] },
          }),
        },
        {
          match: (u) => u.includes(`/messages/${messageId}?format=full`),
          respond: () => ({
            status: 200,
            body: {
              id: messageId,
              snippet: 'URGENT: replace VPN cert',
              payload: {
                mimeType: 'text/plain',
                headers: [
                  { name: 'Subject', value: 'URGENT: replace VPN cert' },
                  { name: 'From', value: 'alice@example.com' },
                ],
                body: { data: base64url('Cert expires tomorrow. Please rotate.') },
              },
            },
          }),
        },
        {
          match: (u, init) => u.endsWith(`/messages/${messageId}/modify`) && init?.method === 'POST',
          respond: () => {
            modifyCalls.push({ url: 'modify', body: undefined });
            return { status: 200, body: {} };
          },
        },
      ]),
    );

    const result = await gmailService.pollConnection(conn.id, 'http://localhost/cb');
    expect(result.processed).toBe(1);
    expect(result.taskIds).toHaveLength(1);

    const task = await prisma.task.findUnique({ where: { id: result.taskIds[0] } });
    expect(task?.title).toContain('VPN cert');
    expect(task?.priority).toBe('urgent');
    expect(task?.assignedToId).toBe(user.id);
    expect(modifyCalls).toHaveLength(1);

    const refreshed = await prisma.gmailConnection.findUnique({ where: { id: conn.id } });
    expect(refreshed?.lastPolledAt).not.toBeNull();
    expect(refreshed?.lastError).toBeNull();
  });

  it('refreshes an expired access token before polling', async () => {
    const user = await createTestUser();
    const conn = await prisma.gmailConnection.create({
      data: {
        userId: user.id,
        email: user.email,
        accessToken: 'expired',
        refreshToken: 'r',
        expiresAt: new Date(Date.now() - 60_000),
        scopes: 'gmail.modify',
        labelName: 'ProjectManager',
      },
    });

    let refreshed = false;
    setGmailTransport(
      fakeTransport([
        {
          match: (u, init) => u.startsWith('https://oauth2.googleapis.com/token') && init?.method === 'POST',
          respond: () => {
            refreshed = true;
            return {
              status: 200,
              body: {
                access_token: 'fresh',
                expires_in: 3600,
                scope: 'gmail.modify',
                token_type: 'Bearer',
              },
            };
          },
        },
        {
          match: (u) => u.endsWith('/labels'),
          respond: () => ({ status: 200, body: { labels: [{ id: 'L', name: 'ProjectManager' }] } }),
        },
        {
          match: (u) => u.includes('/messages?'),
          respond: () => ({ status: 200, body: {} }),
        },
      ]),
    );

    await gmailService.pollConnection(conn.id, 'http://localhost/cb');
    expect(refreshed).toBe(true);
    const updated = await prisma.gmailConnection.findUnique({ where: { id: conn.id } });
    expect(updated?.accessToken).toBe('fresh');
  });

  it('captures errors into lastError without throwing', async () => {
    const user = await createTestUser();
    const conn = await prisma.gmailConnection.create({
      data: {
        userId: user.id,
        email: user.email,
        accessToken: 'still-valid',
        refreshToken: 'r',
        expiresAt: new Date(Date.now() + 3600_000),
        scopes: 'gmail.modify',
        labelName: 'ProjectManager',
      },
    });

    setGmailTransport(
      fakeTransport([
        {
          match: (u) => u.endsWith('/labels'),
          respond: () => ({ status: 401, body: 'unauthorized' }),
        },
      ]),
    );

    const result = await gmailService.pollConnection(conn.id, 'http://localhost/cb');
    expect(result.error).toContain('401');
    const refreshed = await prisma.gmailConnection.findUnique({ where: { id: conn.id } });
    expect(refreshed?.lastError).toContain('401');
  });
});
