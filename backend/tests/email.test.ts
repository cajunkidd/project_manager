import { getStubProvider } from '../src/modules/email/email.provider';
import { authed, createTestUser } from './helpers';

describe('email integration', () => {
  beforeEach(() => {
    getStubProvider().reset();
  });

  describe('outbound', () => {
    it('sends an email when a task is assigned to someone else', async () => {
      const author = await createTestUser({ email: 'a@x.com' });
      const assignee = await createTestUser({ email: 'b@x.com', displayName: 'Beth' });
      await authed(author).post('/api/tasks').send({
        title: 'Test it',
        assignedToId: assignee.id,
      });
      const sent = getStubProvider().sent;
      expect(sent.length).toBeGreaterThanOrEqual(1);
      const assignmentEmail = sent.find((e) => e.subject.startsWith('Task assigned'));
      expect(assignmentEmail?.to).toBe('b@x.com');
    });

    it('emails on @mention in a comment', async () => {
      const author = await createTestUser({ email: 'speaker@x.com' });
      const target = await createTestUser({ email: 'mentioned@x.com', displayName: 'Mentioned' });
      const task = await authed(author).post('/api/tasks').send({ title: 't' });
      await authed(author)
        .post(`/api/tasks/${task.body.id}/comments`)
        .send({ body: 'Heads up @mentioned' });
      const sent = getStubProvider().sent;
      const mentionEmail = sent.find((e) => e.subject === 'You were mentioned');
      expect(mentionEmail?.to).toBe('mentioned@x.com');
    });
  });

  describe('inbound', () => {
    it('admin can ingest an email and have it create a task', async () => {
      const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
      const sender = await createTestUser({ email: 'reporter@x.com' });

      const res = await authed(admin)
        .post('/api/email/inbound')
        .send({
          from: 'reporter@x.com',
          subject: 'Printer offline ASAP',
          body: 'Floor 2 printer is offline.',
        });
      expect(res.status).toBe(201);
      expect(res.body.task.title).toBe('Printer offline ASAP');
      expect(res.body.task.priority).toBe('urgent');
      expect(res.body.recognized).toBe(true);
      expect(res.body.task.assignedToId).toBe(sender.id);
    });

    it('non-admin cannot ingest', async () => {
      const user = await createTestUser();
      const res = await authed(user)
        .post('/api/email/inbound')
        .send({ from: 'a@x.com', subject: 'x', body: '' });
      expect(res.status).toBe(403);
    });
  });

  describe('digest', () => {
    it('sends a daily digest with counts and overdue/due-today lists', async () => {
      const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
      const target = await createTestUser({ email: 'target@x.com', displayName: 'Target' });

      // Pin the digest reference time to noon today so "due today task"
      // (scheduled for 23:30 today) is unambiguously in the future relative
      // to `now`, regardless of when the test happens to execute.
      const reference = new Date();
      reference.setHours(12, 0, 0, 0);

      const yesterday = new Date(reference.getTime() - 86400_000).toISOString();
      await authed(manager)
        .post('/api/tasks')
        .send({ title: 'overdue task', assignedToId: target.id, dueDate: yesterday });
      const today = new Date(reference);
      today.setHours(23, 30, 0, 0);
      await authed(manager)
        .post('/api/tasks')
        .send({ title: 'due today task', assignedToId: target.id, dueDate: today.toISOString() });

      const res = await authed(manager)
        .post('/api/email/digest')
        .send({ userId: target.id, date: reference.toISOString() });
      expect(res.body.counts.overdue).toBe(1);
      expect(res.body.counts.dueToday).toBe(1);

      const sent = getStubProvider().sent;
      const digest = sent.find((e) => e.subject.includes('Daily digest'));
      expect(digest?.to).toBe('target@x.com');
      expect(digest?.body).toContain('overdue task');
      expect(digest?.body).toContain('due today task');
    });
  });
});
