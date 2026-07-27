import { authed, createTestUser } from './helpers';

async function makeGlCode(admin: Awaited<ReturnType<typeof createTestUser>>, code = '6000-100') {
  const res = await authed(admin).post('/api/gl-codes').send({ code, name: `GL ${code}` });
  return res.body.id as string;
}

describe('contracts routes', () => {
  it('creates a contract associated with a GL code', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const glCodeId = await makeGlCode(admin);
    const res = await authed(admin).post('/api/contracts').send({
      contractNumber: 'C-1001',
      title: 'Janitorial services',
      vendor: 'CleanCo',
      amount: 12000,
      status: 'active',
      glCodeId,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ contractNumber: 'C-1001', status: 'active' });
    expect(res.body.glCode).toMatchObject({ id: glCodeId, code: '6000-100' });
  });

  it('rejects a contract referencing an unknown GL code', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const res = await authed(admin).post('/api/contracts').send({
      contractNumber: 'C-2',
      title: 'Bad',
      glCodeId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(400);
  });

  it('rejects associating an inactive GL code', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const glCodeId = await makeGlCode(admin);
    await authed(admin).patch(`/api/gl-codes/${glCodeId}`).send({ isActive: false });
    const res = await authed(admin)
      .post('/api/contracts')
      .send({ contractNumber: 'C-3', title: 'X', glCodeId });
    expect(res.status).toBe(400);
  });

  it('re-associates a contract to a different GL code', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const glA = await makeGlCode(admin, '6000-100');
    const glB = await makeGlCode(admin, '6000-200');
    const created = await authed(admin)
      .post('/api/contracts')
      .send({ contractNumber: 'C-4', title: 'Move me', glCodeId: glA });
    const patched = await authed(admin)
      .patch(`/api/contracts/${created.body.id}`)
      .send({ glCodeId: glB });
    expect(patched.body.glCode.id).toBe(glB);
  });

  it('filters contracts by GL code and rejects non-privileged writes', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const glA = await makeGlCode(admin, '6000-100');
    const glB = await makeGlCode(admin, '6000-200');
    await authed(admin).post('/api/contracts').send({ contractNumber: 'C-5', title: 'A', glCodeId: glA });
    await authed(admin).post('/api/contracts').send({ contractNumber: 'C-6', title: 'B', glCodeId: glB });

    const filtered = await authed(admin).get(`/api/contracts?glCodeId=${glA}`);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].contractNumber).toBe('C-5');

    const user = await createTestUser();
    const write = await authed(user).post('/api/contracts').send({ contractNumber: 'C-7', title: 'Nope' });
    expect(write.status).toBe(403);
    const read = await authed(user).get('/api/contracts');
    expect(read.status).toBe(200);
  });

  it('rejects duplicate contract numbers', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    await authed(admin).post('/api/contracts').send({ contractNumber: 'C-9', title: 'First' });
    const dup = await authed(admin).post('/api/contracts').send({ contractNumber: 'C-9', title: 'Second' });
    expect(dup.status).toBe(409);
  });
});
