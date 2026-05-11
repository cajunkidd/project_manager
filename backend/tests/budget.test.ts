import { authed, createTestUser } from './helpers';

describe('budget tracking', () => {
  it('records planned/actual entries and rolls them up', async () => {
    const user = await createTestUser();
    const project = await authed(user)
      .post('/api/projects')
      .send({ name: 'Build', budgetAmount: 10_000, budgetCurrency: 'USD' });

    await authed(user)
      .post(`/api/projects/${project.body.id}/budget`)
      .send({ kind: 'planned', amount: 4_000, description: 'Phase 1' });
    await authed(user)
      .post(`/api/projects/${project.body.id}/budget`)
      .send({ kind: 'actual', amount: 1_500, description: 'Hardware' });
    await authed(user)
      .post(`/api/projects/${project.body.id}/budget`)
      .send({ kind: 'actual', amount: 500, description: 'Cables' });

    const rollup = await authed(user).get(`/api/projects/${project.body.id}/budget/rollup`);
    expect(rollup.status).toBe(200);
    expect(rollup.body.budget).toBe(10_000);
    expect(rollup.body.planned).toBe(4_000);
    expect(rollup.body.actual).toBe(2_000);
    expect(rollup.body.remaining).toBe(8_000);
    expect(rollup.body.utilization).toBeCloseTo(0.2);
  });
});
