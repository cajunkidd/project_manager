import { authed, createTestUser } from './helpers';

describe('portfolios', () => {
  it('manager creates a portfolio and projects can attach to it', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'm@x.com' });
    const portfolio = await authed(manager)
      .post('/api/portfolios')
      .send({ name: 'Infrastructure' });
    expect(portfolio.status).toBe(201);

    const p1 = await authed(manager)
      .post('/api/projects')
      .send({ name: 'Switch refresh', portfolioId: portfolio.body.id, budgetAmount: 50_000 });
    expect(p1.body.portfolioId).toBe(portfolio.body.id);

    const detail = await authed(manager).get(`/api/portfolios/${portfolio.body.id}`);
    expect(detail.body.projects).toHaveLength(1);

    const rollup = await authed(manager).get(`/api/portfolios/${portfolio.body.id}/rollup`);
    expect(rollup.body.total).toBe(1);
    expect(rollup.body.budgetTotal).toBe(50_000);
  });

  it('regular users cannot create portfolios', async () => {
    const user = await createTestUser();
    const res = await authed(user).post('/api/portfolios').send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});
