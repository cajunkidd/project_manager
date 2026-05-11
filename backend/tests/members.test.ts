import { authed, createTestUser } from './helpers';

describe('project members', () => {
  it('creator is auto-added as owner', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'P' });

    const members = await authed(user).get(`/api/projects/${project.body.id}/members`);
    expect(members.status).toBe(200);
    expect(members.body).toHaveLength(1);
    expect(members.body[0]).toMatchObject({ role: 'owner' });
    expect(members.body[0].user.id).toBe(user.id);
  });

  it('non-members cannot see another user\'s project', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Alice only' });

    const list = await authed(bob).get('/api/projects');
    expect(list.body).toHaveLength(0);

    const get = await authed(bob).get(`/api/projects/${project.body.id}`);
    expect(get.status).toBe(403);

    const update = await authed(bob)
      .patch(`/api/projects/${project.body.id}`)
      .send({ name: 'hacked' });
    expect(update.status).toBe(403);
  });

  it('owner can add an editor who then sees the project', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Shared' });

    const added = await authed(alice)
      .post(`/api/projects/${project.body.id}/members`)
      .send({ userId: bob.id, role: 'editor' });
    expect(added.status).toBe(201);

    const list = await authed(bob).get('/api/projects');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(project.body.id);

    const task = await authed(bob)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'from bob' });
    expect(task.status).toBe(201);
  });

  it('viewer cannot create tasks on the project', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'View only' });

    await authed(alice)
      .post(`/api/projects/${project.body.id}/members`)
      .send({ userId: bob.id, role: 'viewer' });

    const get = await authed(bob).get(`/api/projects/${project.body.id}`);
    expect(get.status).toBe(200);

    const task = await authed(bob)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'denied' });
    expect(task.status).toBe(403);
  });

  it('admins bypass project membership', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const admin = await createTestUser({ email: 'admin@x.com', role: 'admin' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Private' });

    const list = await authed(admin).get('/api/projects');
    expect(list.body.some((p: { id: string }) => p.id === project.body.id)).toBe(true);

    const update = await authed(admin)
      .patch(`/api/projects/${project.body.id}`)
      .send({ priority: 'high' });
    expect(update.status).toBe(200);
  });

  it('cannot remove the last owner', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'Lonely' });

    const res = await authed(alice).delete(
      `/api/projects/${project.body.id}/members/${alice.id}`,
    );
    expect(res.status).toBe(409);
  });

  it('non-owners cannot manage members', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const carol = await createTestUser({ email: 'carol@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'X' });
    await authed(alice)
      .post(`/api/projects/${project.body.id}/members`)
      .send({ userId: bob.id, role: 'editor' });

    const denied = await authed(bob)
      .post(`/api/projects/${project.body.id}/members`)
      .send({ userId: carol.id, role: 'editor' });
    expect(denied.status).toBe(403);
  });

  it('project tasks are hidden from non-members in the task list', async () => {
    const alice = await createTestUser({ email: 'alice@x.com' });
    const bob = await createTestUser({ email: 'bob@x.com' });
    const project = await authed(alice).post('/api/projects').send({ name: 'P' });
    await authed(alice)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'secret' });

    const list = await authed(bob).get('/api/tasks');
    expect(list.body.map((t: { title: string }) => t.title)).not.toContain('secret');
  });
});
