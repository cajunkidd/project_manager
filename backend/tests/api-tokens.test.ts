import request from 'supertest';
import { app } from './helpers';
import { authed, createTestUser } from './helpers';

describe('API tokens', () => {
  it('admin can create a token and the raw secret is only returned once', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const res = await authed(admin)
      .post('/api/api-tokens')
      .send({ name: 'CI bot', scopes: ['tasks:write', 'tasks:read'] });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^pm_/);
    expect(res.body.record.scopes).toEqual(['tasks:write', 'tasks:read']);

    const list = await authed(admin).get('/api/api-tokens');
    expect(list.body).toHaveLength(1);
    // Listing should never expose the raw token or its hash.
    expect(list.body[0]).not.toHaveProperty('tokenHash');
    expect(list.body[0]).not.toHaveProperty('token');
  });

  it('non-admin cannot manage tokens', async () => {
    const user = await createTestUser();
    const res = await authed(user).get('/api/api-tokens');
    expect(res.status).toBe(403);
  });

  it('public API rejects requests without a token', async () => {
    const res = await request(app).post('/api/v1/tasks').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('public API accepts a valid token with the right scope', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const created = await authed(admin)
      .post('/api/api-tokens')
      .send({ name: 'CI', scopes: ['tasks:write'] });
    const token = created.body.token as string;

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'External request' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('External request');
  });

  it('public API rejects a token without the required scope', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const created = await authed(admin)
      .post('/api/api-tokens')
      .send({ name: 'Read-only', scopes: ['tasks:read'] });
    const token = created.body.token as string;

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'should fail' });
    expect(res.status).toBe(403);
  });

  it('revoked token is rejected', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const created = await authed(admin)
      .post('/api/api-tokens')
      .send({ name: 'tmp', scopes: ['tasks:write'] });
    const token = created.body.token as string;

    await authed(admin).delete(`/api/api-tokens/${created.body.record.id}`);

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'fail' });
    expect(res.status).toBe(403);
  });
});
