import { authed, createTestUser } from './helpers';

describe('AI — weekly executive summary', () => {
  it('returns metrics and recommendations for the period', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const project = await authed(admin).post('/api/projects').send({ name: 'Exec Project' });

    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await authed(admin).post('/api/tasks').send({
      projectId: project.body.id,
      title: 'Past due thing',
      dueDate: yesterday,
    });
    const done = await authed(admin)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Shipped feature' });
    await authed(admin).patch(`/api/tasks/${done.body.id}/status`).send({ status: 'done' });

    const res = await authed(admin).get('/api/ai/exec-summary');
    expect(res.status).toBe(200);
    expect(res.body.period.days).toBeGreaterThanOrEqual(1);
    expect(res.body.metrics).toMatchObject({
      activeProjects: expect.any(Number),
      tasksCompleted: expect.any(Number),
      tasksCreated: expect.any(Number),
      tasksOverdue: expect.any(Number),
    });
    expect(res.body.metrics.tasksOverdue).toBeGreaterThanOrEqual(1);
    expect(res.body.headline).toEqual(expect.any(String));
    expect(Array.isArray(res.body.recommendations)).toBe(true);
  });

  it('forbids regular users from running the exec summary', async () => {
    const user = await createTestUser({ role: 'user' });
    const res = await authed(user).get('/api/ai/exec-summary');
    expect(res.status).toBe(403);
  });
});

describe('AI — auto-prioritization', () => {
  it('suggests bumping priority for overdue or upcoming tasks', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'Priorities' });

    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const overdue = await authed(user).post('/api/tasks').send({
      projectId: project.body.id,
      title: 'Patch firewall',
      dueDate: yesterday,
      priority: 'normal',
    });
    await authed(user).post('/api/tasks').send({
      projectId: project.body.id,
      title: 'URGENT: restore VPN access',
      priority: 'normal',
    });

    const res = await authed(user).get(`/api/ai/prioritize?projectId=${project.body.id}`);
    expect(res.status).toBe(200);
    const suggestions = res.body.suggestions as Array<{
      taskId: string;
      suggestedPriority: string;
      reasons: string[];
    }>;
    const forOverdue = suggestions.find((s) => s.taskId === overdue.body.id);
    expect(forOverdue?.suggestedPriority).toBe('urgent');
    const fromKeyword = suggestions.find((s) => s.reasons.join(' ').toLowerCase().includes('urgent'));
    expect(fromKeyword).toBeDefined();
  });
});

describe('AI — cleanup recommendations', () => {
  it('flags in-progress tasks missing owner and due date', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const project = await authed(admin).post('/api/projects').send({ name: 'Cleanup' });
    const t = await authed(admin)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Active but unowned work' });
    await authed(admin).patch(`/api/tasks/${t.body.id}/status`).send({ status: 'in_progress' });

    const res = await authed(admin).get(`/api/ai/cleanup?projectId=${project.body.id}`);
    expect(res.status).toBe(200);
    const actions = (res.body.suggestions as Array<{ taskId: string; action: string }>)
      .filter((s) => s.taskId === t.body.id)
      .map((s) => s.action);
    expect(actions).toEqual(expect.arrayContaining(['assign_owner', 'add_due_date']));
  });
});

describe('AI — duplicate detection', () => {
  it('groups tasks with highly similar titles', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'Dupes' });
    const a = await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Replace switch in Lake Charles office' });
    const b = await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Replace switch Lake Charles office' });
    await authed(user)
      .post('/api/tasks')
      .send({ projectId: project.body.id, title: 'Order new monitor cables' });

    const res = await authed(user).get(`/api/ai/duplicates?projectId=${project.body.id}`);
    expect(res.status).toBe(200);
    const groups = res.body.groups as Array<{ tasks: Array<{ id: string }> }>;
    const match = groups.find((g) => {
      const ids = g.tasks.map((t) => t.id);
      return ids.includes(a.body.id) && ids.includes(b.body.id);
    });
    expect(match).toBeDefined();
  });
});

describe('AI — meeting notes', () => {
  it('parses attendees, decisions, and action items', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/ai/meeting-notes')
      .send({
        text: `Weekly IT Sync — 2026-05-08

Attendees: Alice, Bob, Carlos

Agenda:
- Network refresh
- Vendor escalations

Decisions:
- Approved switch replacement budget
- Pause printer rollout until Q3

Action Items:
- Replace switch in Lake Charles by 2026-05-15 (Alice)
- @bob document the runbook
- Follow up with vendor about SLA — Carlos`,
      });
    expect(res.status).toBe(200);
    expect(res.body.attendees).toEqual(expect.arrayContaining(['Alice', 'Bob', 'Carlos']));
    expect(res.body.decisions.length).toBe(2);
    expect(res.body.actionItems.length).toBeGreaterThanOrEqual(3);
    const titles = res.body.actionItems.map((a: { title: string }) => a.title.toLowerCase());
    expect(titles.some((t: string) => t.includes('replace switch'))).toBe(true);
    const assignees = res.body.actionItems.map((a: { assignee: string | null }) => a.assignee);
    expect(assignees).toEqual(expect.arrayContaining(['bob']));
  });

  it('rejects empty input', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/ai/meeting-notes').send({ text: '' });
    expect(res.status).toBe(400);
  });
});

describe('AI — email thread summarization', () => {
  it('summarizes participants, action items, and urgency', async () => {
    const user = await createTestUser();
    const res = await authed(user)
      .post('/api/ai/summarize-email')
      .send({
        thread: [
          {
            from: 'manager@example.com',
            to: ['ops@example.com'],
            subject: 'URGENT: production DB latency',
            body: 'We are seeing critical latency on the primary DB. Please investigate immediately.\n\nThanks',
          },
          {
            from: 'ops@example.com',
            to: ['manager@example.com'],
            subject: 'Re: URGENT: production DB latency',
            body: "Looking into it. Can you confirm when this started? I'll patch the failing replica.\n\n> We are seeing critical latency on the primary DB.",
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.messageCount).toBe(2);
    expect(res.body.participants).toEqual(
      expect.arrayContaining(['manager@example.com', 'ops@example.com']),
    );
    expect(res.body.urgent).toBe(true);
    expect(res.body.subject).toContain('production DB latency');
    expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.actionItems.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty thread', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/ai/summarize-email').send({ thread: [] });
    expect(res.status).toBe(400);
  });
});
