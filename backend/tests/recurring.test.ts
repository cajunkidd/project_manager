import { recurringService } from '../src/modules/recurring/recurring.service';
import { authed, createTestUser } from './helpers';

describe('recurring tasks', () => {
  it('creates a rule and materializes a task when due', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const past = new Date(Date.now() - 60_000).toISOString();
    const rule = await authed(manager)
      .post('/api/recurring')
      .send({
        name: 'Daily standup notes',
        templateTitle: 'Capture standup notes',
        frequency: 'daily',
        nextRunAt: past,
      });
    expect(rule.status).toBe(201);

    const result = await recurringService.runDue(new Date());
    expect(result.ranRules).toBe(1);
    expect(result.createdTaskIds).toHaveLength(1);

    const tasks = await authed(manager).get('/api/tasks?search=Capture standup');
    expect(tasks.body.length).toBeGreaterThanOrEqual(1);

    // Re-running with same now() shouldn't produce duplicates because nextRunAt advanced.
    const second = await recurringService.runDue(new Date());
    expect(second.ranRules).toBe(0);
  });

  it('manager-only run-due endpoint', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/recurring/run-due').send();
    expect(res.status).toBe(403);
  });
});
