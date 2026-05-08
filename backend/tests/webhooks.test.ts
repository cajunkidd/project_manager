import { prisma } from '../src/db/prisma';
import { webhooksService } from '../src/modules/webhooks/webhooks.service';
import { authed, createTestUser } from './helpers';

describe('webhooks', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('admin can create a webhook subscription with a generated secret', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const res = await authed(admin)
      .post('/api/webhooks')
      .send({
        name: 'Slack relay',
        url: 'https://example.com/hook',
        events: ['task.created', 'project.created'],
      });
    expect(res.status).toBe(201);
    expect(res.body.secret).toEqual(expect.any(String));
    expect(res.body.events).toBe('task.created,project.created');
  });

  it('non-admin cannot manage webhooks', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/webhooks');
    expect(res.status).toBe(403);
  });

  it('delivers a signed payload when a subscribed event fires', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });

    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      calls.push({ url, init: init ?? {} });
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    }) as unknown as typeof globalThis.fetch;

    const sub = await authed(admin)
      .post('/api/webhooks')
      .send({
        name: 'task hook',
        url: 'https://example.com/hook',
        events: ['task.created'],
      });

    await authed(admin).post('/api/tasks').send({ title: 'fire the hook' });

    // Allow listener microtasks to flush.
    await new Promise((r) => setTimeout(r, 50));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://example.com/hook');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['X-Webhook-Event']).toBe('task.created');
    expect(headers['X-Webhook-Signature']).toMatch(/^sha256=/);

    const body = String(calls[0].init.body);
    const expectedSig = `sha256=${webhooksService.signPayload(sub.body.secret, body)}`;
    expect(headers['X-Webhook-Signature']).toBe(expectedSig);

    const deliveries = await prisma.webhookDelivery.findMany();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe('success');
    expect(deliveries[0].statusCode).toBe(200);
  });

  it('records a failed delivery when the receiver responds non-2xx', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    globalThis.fetch = (() =>
      Promise.resolve(new Response('boom', { status: 500 }))) as unknown as typeof globalThis.fetch;

    await authed(admin)
      .post('/api/webhooks')
      .send({
        name: 'flaky',
        url: 'https://example.com/hook',
        events: ['task.created'],
      });
    await authed(admin).post('/api/tasks').send({ title: 'should fail' });
    await new Promise((r) => setTimeout(r, 50));

    const deliveries = await prisma.webhookDelivery.findMany();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe('failed');
    expect(deliveries[0].statusCode).toBe(500);
  });

  it('skips inactive subscriptions', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const calls: { url: string }[] = [];
    globalThis.fetch = ((url: string) => {
      calls.push({ url });
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof globalThis.fetch;

    const sub = await authed(admin)
      .post('/api/webhooks')
      .send({
        name: 'paused',
        url: 'https://example.com/hook',
        events: ['task.created'],
      });
    await authed(admin).patch(`/api/webhooks/${sub.body.id}`).send({ isActive: false });

    await authed(admin).post('/api/tasks').send({ title: 't' });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toHaveLength(0);
  });
});
