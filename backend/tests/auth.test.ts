import request from 'supertest';
import { app, createTestUser } from './helpers';

describe('auth', () => {
  it('registers a new user and returns a token', async () => {
    // Seed an existing user so this registration does not get auto-promoted to admin.
    await createTestUser({ email: 'seed@example.com' });

    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      displayName: 'Alice',
      password: 'password1234',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: 'alice@example.com',
      displayName: 'Alice',
      role: 'user',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('promotes the first registered user to admin', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'firstadmin@example.com',
      displayName: 'First Admin',
      password: 'password1234',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'dup@example.com',
      displayName: 'Dup',
      password: 'password1234',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'dup@example.com',
      displayName: 'Dup2',
      password: 'password1234',
    });
    expect(res.status).toBe(409);
  });

  it('logs in with valid credentials', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      displayName: 'Bob',
      password: 'password1234',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'bob@example.com',
      password: 'password1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('rejects bad credentials', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'bob2@example.com',
      displayName: 'Bob2',
      password: 'password1234',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'bob2@example.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });

  it('returns the current user from /me when authenticated', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'me@example.com',
      displayName: 'Me',
      password: 'password1234',
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@example.com');
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
