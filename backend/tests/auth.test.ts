import request from 'supertest';
import { app } from './helpers';

describe('auth', () => {
  it('registers a new user and returns a token', async () => {
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

  it('self-heals: existing master-email account is promoted on login', async () => {
    // Simulate a master-email account that pre-dates the master rollout by
    // poking the DB directly so the create-time auto-promotion is bypassed.
    const { prisma } = await import('../src/db/prisma');
    const bcrypt = await import('bcryptjs');
    await prisma.user.create({
      data: {
        email: 'kyle.neely27@gmail.com',
        displayName: 'Kyle',
        passwordHash: await bcrypt.hash('password1234', 10),
        role: 'user',
      },
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'kyle.neely27@gmail.com',
      password: 'password1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('master');

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('master');
  });
});
