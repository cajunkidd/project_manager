import { authed, createTestUser } from './helpers';

describe('approvals', () => {
  it('requests, approves, and records activity + notifications', async () => {
    const requester = await createTestUser({ email: 'req-app@x.com' });
    const approver = await createTestUser({ email: 'app-app@x.com' });
    const task = await authed(requester).post('/api/tasks').send({ title: 'Spend over $5k' });

    const created = await authed(requester)
      .post(`/api/tasks/${task.body.id}/approvals`)
      .send({ approverId: approver.id, requestComment: 'For ACME order' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      taskId: task.body.id,
      status: 'pending',
      requestedById: requester.id,
      approverId: approver.id,
    });

    const inbox = await authed(approver).get('/api/notifications?unreadOnly=true');
    expect(inbox.body.some((n: { type: string }) => n.type === 'approval_requested')).toBe(true);

    const decided = await authed(approver)
      .patch(`/api/approvals/${created.body.id}`)
      .send({ status: 'approved', decisionComment: 'Within budget' });
    expect(decided.status).toBe(200);
    expect(decided.body.status).toBe('approved');
    expect(decided.body.decidedAt).not.toBeNull();

    const requesterInbox = await authed(requester).get('/api/notifications?unreadOnly=true');
    expect(requesterInbox.body.some((n: { type: string }) => n.type === 'approval_approved')).toBe(
      true,
    );
  });

  it('rejects self-approval requests', async () => {
    const user = await createTestUser({ email: 'self-app@x.com' });
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const res = await authed(user)
      .post(`/api/tasks/${task.body.id}/approvals`)
      .send({ approverId: user.id });
    expect(res.status).toBe(400);
  });

  it('blocks duplicate pending approvals from the same approver', async () => {
    const r = await createTestUser({ email: 'dup-req@x.com' });
    const a = await createTestUser({ email: 'dup-app@x.com' });
    const task = await authed(r).post('/api/tasks').send({ title: 'twice' });
    await authed(r).post(`/api/tasks/${task.body.id}/approvals`).send({ approverId: a.id });
    const second = await authed(r)
      .post(`/api/tasks/${task.body.id}/approvals`)
      .send({ approverId: a.id });
    expect(second.status).toBe(409);
  });

  it('only the designated approver (or admin) may decide', async () => {
    const requester = await createTestUser({ email: 'r2@x.com' });
    const approver = await createTestUser({ email: 'a2@x.com' });
    const stranger = await createTestUser({ email: 's2@x.com' });
    const task = await authed(requester).post('/api/tasks').send({ title: 'auth check' });
    const created = await authed(requester)
      .post(`/api/tasks/${task.body.id}/approvals`)
      .send({ approverId: approver.id });

    const blocked = await authed(stranger)
      .patch(`/api/approvals/${created.body.id}`)
      .send({ status: 'approved' });
    expect(blocked.status).toBe(403);
  });

  it('lists my pending approvals via ?mine=true&status=pending', async () => {
    const r = await createTestUser({ email: 'mine-req@x.com' });
    const a = await createTestUser({ email: 'mine-app@x.com' });
    const t1 = await authed(r).post('/api/tasks').send({ title: 'one' });
    const t2 = await authed(r).post('/api/tasks').send({ title: 'two' });
    await authed(r).post(`/api/tasks/${t1.body.id}/approvals`).send({ approverId: a.id });
    const second = await authed(r)
      .post(`/api/tasks/${t2.body.id}/approvals`)
      .send({ approverId: a.id });
    await authed(a)
      .patch(`/api/approvals/${second.body.id}`)
      .send({ status: 'rejected', decisionComment: 'nope' });

    const pending = await authed(a).get('/api/approvals?mine=true&status=pending');
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0].status).toBe('pending');
  });

  it('requester (or admin) can cancel a pending approval', async () => {
    const r = await createTestUser({ email: 'cancel-r@x.com' });
    const a = await createTestUser({ email: 'cancel-a@x.com' });
    const task = await authed(r).post('/api/tasks').send({ title: 'cancel me' });
    const created = await authed(r)
      .post(`/api/tasks/${task.body.id}/approvals`)
      .send({ approverId: a.id });

    const del = await authed(r).delete(`/api/approvals/${created.body.id}`);
    expect(del.status).toBe(204);

    const after = await authed(r).get(`/api/tasks/${task.body.id}/approvals`);
    expect(after.body).toHaveLength(0);
  });

  it('rejects deciding an already-decided approval', async () => {
    const r = await createTestUser({ email: 'twice-r@x.com' });
    const a = await createTestUser({ email: 'twice-a@x.com' });
    const task = await authed(r).post('/api/tasks').send({ title: 'closed' });
    const created = await authed(r)
      .post(`/api/tasks/${task.body.id}/approvals`)
      .send({ approverId: a.id });
    await authed(a).patch(`/api/approvals/${created.body.id}`).send({ status: 'approved' });
    const again = await authed(a)
      .patch(`/api/approvals/${created.body.id}`)
      .send({ status: 'rejected' });
    expect(again.status).toBe(409);
  });
});
