import { authed, createTestUser } from './helpers';

describe('notifications', () => {
  it('creates a notification when a task is assigned to someone else', async () => {
    const author = await createTestUser({ email: 'creator@x.com' });
    const assignee = await createTestUser({ email: 'assignee@x.com' });

    await authed(author).post('/api/tasks').send({
      title: 'Please do this',
      assignedToId: assignee.id,
    });

    const list = await authed(assignee).get('/api/notifications');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      type: 'task_assigned',
      isRead: false,
    });
  });

  it('does not notify when self-assigning', async () => {
    const user = await createTestUser();
    await authed(user).post('/api/tasks').send({
      title: 'Mine',
      assignedToId: user.id,
    });
    const list = await authed(user).get('/api/notifications');
    expect(list.body).toHaveLength(0);
  });

  it('notifies the assignee on @mention in a comment', async () => {
    const author = await createTestUser({ email: 'speaker@x.com', displayName: 'Speaker' });
    const target = await createTestUser({ email: 'mentioned@x.com', displayName: 'Mentioned' });
    const task = await authed(author).post('/api/tasks').send({ title: 't' });

    await authed(author)
      .post(`/api/tasks/${task.body.id}/comments`)
      .send({ body: 'Heads up @mentioned, please review' });

    const list = await authed(target).get('/api/notifications');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].type).toBe('mention');
  });

  it('exposes unread count and supports mark-all-read', async () => {
    const author = await createTestUser({ email: 'a@x.com' });
    const assignee = await createTestUser({ email: 'b@x.com' });
    await authed(author).post('/api/tasks').send({ title: 'a', assignedToId: assignee.id });
    await authed(author).post('/api/tasks').send({ title: 'b', assignedToId: assignee.id });

    const count1 = await authed(assignee).get('/api/notifications/unread-count');
    expect(count1.body.count).toBe(2);

    const readAll = await authed(assignee).patch('/api/notifications/read-all');
    expect(readAll.body.updated).toBe(2);

    const count2 = await authed(assignee).get('/api/notifications/unread-count');
    expect(count2.body.count).toBe(0);
  });

  it('only the owner can mark a notification as read', async () => {
    const author = await createTestUser({ email: 'a@x.com' });
    const assignee = await createTestUser({ email: 'b@x.com' });
    const stranger = await createTestUser({ email: 'c@x.com' });
    await authed(author).post('/api/tasks').send({ title: 't', assignedToId: assignee.id });

    const list = await authed(assignee).get('/api/notifications');
    const id = list.body[0].id;

    const forbidden = await authed(stranger).patch(`/api/notifications/${id}/read`);
    expect(forbidden.status).toBe(403);

    const ok = await authed(assignee).patch(`/api/notifications/${id}/read`);
    expect(ok.status).toBe(200);
    expect(ok.body.isRead).toBe(true);
  });
});
