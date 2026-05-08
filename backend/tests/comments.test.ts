import { authed, createTestUser } from './helpers';

describe('comments routes', () => {
  it('creates and lists task comments', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });

    const created = await authed(user)
      .post(`/api/tasks/${task.body.id}/comments`)
      .send({ body: 'first comment' });
    expect(created.status).toBe(201);
    expect(created.body.body).toBe('first comment');
    expect(created.body.user.id).toBe(user.id);

    const list = await authed(user).get(`/api/tasks/${task.body.id}/comments`);
    expect(list.body).toHaveLength(1);
  });

  it('creates project comments', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'p' });
    const created = await authed(user)
      .post(`/api/projects/${project.body.id}/comments`)
      .send({ body: 'hello project' });
    expect(created.status).toBe(201);

    const list = await authed(user).get(`/api/projects/${project.body.id}/comments`);
    expect(list.body).toHaveLength(1);
  });

  it('only author can edit a comment', async () => {
    const author = await createTestUser({ email: 'author@x.com' });
    const other = await createTestUser({ email: 'other@x.com' });
    const task = await authed(author).post('/api/tasks').send({ title: 't' });
    const c = await authed(author)
      .post(`/api/tasks/${task.body.id}/comments`)
      .send({ body: 'mine' });

    const stranger = await authed(other).patch(`/api/comments/${c.body.id}`).send({ body: 'no' });
    expect(stranger.status).toBe(403);

    const own = await authed(author).patch(`/api/comments/${c.body.id}`).send({ body: 'edited' });
    expect(own.status).toBe(200);
    expect(own.body.body).toBe('edited');
  });

  it('admin can delete any comment', async () => {
    const author = await createTestUser({ email: 'a@x.com' });
    const admin = await createTestUser({ email: 'admin@x.com', role: 'admin' });
    const task = await authed(author).post('/api/tasks').send({ title: 't' });
    const c = await authed(author)
      .post(`/api/tasks/${task.body.id}/comments`)
      .send({ body: 'gone' });

    const res = await authed(admin).delete(`/api/comments/${c.body.id}`);
    expect(res.status).toBe(204);
  });
});
