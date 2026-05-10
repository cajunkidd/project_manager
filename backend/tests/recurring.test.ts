import { computeNextRunAt } from '../src/modules/recurring/recurring.cadence';
import { recurringService } from '../src/modules/recurring/recurring.service';
import { authed, createTestUser } from './helpers';

describe('recurring task cadence math', () => {
  it('computes the next daily occurrence', () => {
    const from = new Date('2026-05-10T12:00:00Z');
    const next = computeNextRunAt(
      { cadence: 'daily', intervalCount: 1, dayOfWeek: null, dayOfMonth: null, hourOfDay: 9 },
      from,
    );
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    // Within 36 hours
    expect(next.getTime() - from.getTime()).toBeLessThan(36 * 3_600_000);
  });

  it('honors weekly day-of-week', () => {
    const from = new Date('2026-05-10T08:00:00Z'); // a Sunday
    const next = computeNextRunAt(
      { cadence: 'weekly', intervalCount: 1, dayOfWeek: 3, dayOfMonth: null, hourOfDay: 9 }, // Wednesday
      from,
    );
    expect(next.getDay()).toBe(3);
  });

  it('honors monthly day-of-month and rolls over', () => {
    const from = new Date('2026-05-15T20:00:00Z');
    const next = computeNextRunAt(
      { cadence: 'monthly', intervalCount: 1, dayOfWeek: null, dayOfMonth: 1, hourOfDay: 9 },
      from,
    );
    expect(next.getDate()).toBe(1);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it('always returns a date strictly after `from`', () => {
    const from = new Date();
    for (const cadence of ['daily', 'weekly', 'monthly'] as const) {
      const next = computeNextRunAt(
        { cadence, intervalCount: 1, dayOfWeek: null, dayOfMonth: null, hourOfDay: 9 },
        from,
      );
      expect(next.getTime()).toBeGreaterThan(from.getTime());
    }
  });
});

describe('recurring tasks API', () => {
  it('admins can create a template', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await authed(admin)
      .post('/api/recurring-tasks')
      .send({
        name: 'Daily standup notes',
        title: 'Post standup notes',
        cadence: 'daily',
        intervalCount: 1,
        hourOfDay: 9,
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Daily standup notes', cadence: 'daily' });
    expect(res.body.nextRunAt).toBeTruthy();
  });

  it('regular users cannot create or delete templates', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const user = await createTestUser({ role: 'user' });
    const res = await authed(user).post('/api/recurring-tasks').send({
      name: 'No', title: 'No', cadence: 'daily',
    });
    expect(res.status).toBe(403);

    const created = await authed(admin).post('/api/recurring-tasks').send({
      name: 'A', title: 'A', cadence: 'daily',
    });
    const del = await authed(user).delete(`/api/recurring-tasks/${created.body.id}`);
    expect(del.status).toBe(403);
  });

  it('runDue spawns a task and rearms the template', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const project = await authed(admin).post('/api/projects').send({ name: 'Ops' });

    const created = await authed(admin)
      .post('/api/recurring-tasks')
      .send({
        name: 'Weekly server patch',
        title: 'Patch production server',
        cadence: 'weekly',
        intervalCount: 1,
        dayOfWeek: 1,
        hourOfDay: 9,
        dueOffsetDays: 2,
        projectId: project.body.id,
      });

    // Force the next run into the past so it is due
    const past = new Date(Date.now() - 60_000);
    await recurringService.update(created.body.id, {});
    // Direct DB nudge via service's update would re-validate but won't change nextRunAt;
    // call runDue with a `now` far enough in the future to catch it.
    const future = new Date(Date.now() + 365 * 86_400_000);
    const result = await recurringService.runDue(future, admin.id);

    expect(result.ranTemplates).toBeGreaterThanOrEqual(1);
    expect(result.createdTaskIds.length).toBe(result.ranTemplates);

    // Created task lives under the project
    const tasks = await authed(admin).get(
      `/api/tasks?projectId=${project.body.id}`,
    );
    const titles = tasks.body.map((t: { title: string }) => t.title);
    expect(titles).toContain('Patch production server');

    // Template's nextRunAt is now in the future relative to `future`
    const refreshed = await authed(admin).get(`/api/recurring-tasks/${created.body.id}`);
    expect(new Date(refreshed.body.nextRunAt).getTime()).toBeGreaterThan(future.getTime());
    expect(refreshed.body.lastRunAt).toBeTruthy();
    void past;
  });

  it('rejects invalid cadence inputs', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await authed(admin)
      .post('/api/recurring-tasks')
      .send({ name: 'X', title: 'X', cadence: 'weekly', dayOfWeek: 9 });
    expect(res.status).toBe(400);
  });

  it('admin run-due endpoint works', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const res = await authed(admin).post('/api/recurring-tasks/run-due');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ranTemplates');
  });
});
