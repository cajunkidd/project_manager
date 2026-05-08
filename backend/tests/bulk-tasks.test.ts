import { authed, createTestUser } from './helpers';

describe('bulk task operations', () => {
  it('bulk-updates priority on a list of tasks', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });
    const c = await authed(user).post('/api/tasks').send({ title: 'c' });

    const res = await authed(user)
      .patch('/api/tasks/bulk')
      .send({ ids: [a.body.id, b.body.id], patch: { priority: 'urgent' } });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);

    const all = await authed(user).get('/api/tasks');
    const byId = new Map(all.body.map((t: { id: string; priority: string }) => [t.id, t.priority]));
    expect(byId.get(a.body.id)).toBe('urgent');
    expect(byId.get(b.body.id)).toBe('urgent');
    expect(byId.get(c.body.id)).toBe('normal');
  });

  it('bulk status change stamps completedAt for moves to done', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });

    await authed(user)
      .patch('/api/tasks/bulk')
      .send({ ids: [a.body.id, b.body.id], patch: { status: 'done' } });

    const all = await authed(user).get('/api/tasks');
    for (const t of all.body) {
      expect(t.status).toBe('done');
      expect(t.completedAt).not.toBeNull();
    }
  });

  it('bulk reassignment updates assignedToId', async () => {
    const user = await createTestUser({ email: 'u1@x.com' });
    const target = await createTestUser({ email: 'u2@x.com', displayName: 'Target' });
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });

    const res = await authed(user)
      .patch('/api/tasks/bulk')
      .send({ ids: [a.body.id, b.body.id], patch: { assignedToId: target.id } });
    expect(res.body.updated).toBe(2);

    const detail = await authed(user).get(`/api/tasks/${a.body.id}`);
    expect(detail.body.assignedToId).toBe(target.id);
  });

  it('reports failures per id without aborting the whole batch', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const res = await authed(user)
      .patch('/api/tasks/bulk')
      .send({ ids: [a.body.id, fakeId], patch: { priority: 'high' } });
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].id).toBe(fakeId);
  });

  it('rejects empty id list and empty patch', async () => {
    const user = await createTestUser();
    const empty = await authed(user)
      .patch('/api/tasks/bulk')
      .send({ ids: [], patch: { status: 'done' } });
    expect(empty.status).toBe(400);

    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const noPatch = await authed(user)
      .patch('/api/tasks/bulk')
      .send({ ids: [a.body.id], patch: {} });
    expect(noPatch.status).toBe(400);
  });

  it('bulk-deletes tasks', async () => {
    const user = await createTestUser();
    const a = await authed(user).post('/api/tasks').send({ title: 'a' });
    const b = await authed(user).post('/api/tasks').send({ title: 'b' });

    const res = await authed(user)
      .post('/api/tasks/bulk-delete')
      .send({ ids: [a.body.id, b.body.id] });
    expect(res.body.removed).toBe(2);

    const after = await authed(user).get('/api/tasks');
    expect(after.body).toHaveLength(0);
  });

  it('rejects unauthenticated bulk requests', async () => {
    const fake = { id: 'x', email: 'x', role: 'user', token: 'invalid' };
    const res = await authed(fake)
      .patch('/api/tasks/bulk')
      .send({ ids: ['00000000-0000-0000-0000-000000000000'], patch: { status: 'done' } });
    expect(res.status).toBe(401);
  });
});
