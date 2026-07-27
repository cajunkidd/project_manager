import { authed, createTestUser } from './helpers';

describe('GL codes routes', () => {
  it('lets a manager create a GL code and lists it', async () => {
    const manager = await createTestUser({ role: 'manager', email: 'mgr@x.com' });
    const res = await authed(manager)
      .post('/api/gl-codes')
      .send({ code: '6000-100', name: 'Office supplies', category: 'expense' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ code: '6000-100', name: 'Office supplies', isActive: true });

    const list = await authed(manager).get('/api/gl-codes');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]._count).toEqual({ contracts: 0, invoices: 0 });
  });

  it('rejects GL code writes from non-privileged users but allows reads', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    await authed(admin).post('/api/gl-codes').send({ code: '7000', name: 'Travel' });

    const user = await createTestUser();
    const write = await authed(user).post('/api/gl-codes').send({ code: '8000', name: 'Nope' });
    expect(write.status).toBe(403);

    const read = await authed(user).get('/api/gl-codes');
    expect(read.status).toBe(200);
    expect(read.body).toHaveLength(1);
  });

  it('rejects duplicate codes', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    await authed(admin).post('/api/gl-codes').send({ code: '6000-100', name: 'First' });
    const dup = await authed(admin).post('/api/gl-codes').send({ code: '6000-100', name: 'Second' });
    expect(dup.status).toBe(409);
  });

  it('bulk uploads GL codes from a JSON array, upserting on re-upload', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const first = await authed(admin)
      .post('/api/gl-codes/upload')
      .send({
        codes: [
          { code: '6000-100', name: 'Office supplies', category: 'expense' },
          { code: '6000-200', name: 'Software', category: 'expense' },
          { code: '', name: 'Bad row' },
        ],
      });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ created: 2, updated: 0, total: 2 });
    expect(first.body.errors).toHaveLength(1);
    expect(first.body.errors[0]).toMatchObject({ row: 3, message: 'Missing GL code' });

    // Re-upload with an updated name -> should update, not duplicate.
    const second = await authed(admin)
      .post('/api/gl-codes/upload')
      .send({ codes: [{ code: '6000-100', name: 'Office supplies (updated)' }] });
    expect(second.body).toMatchObject({ created: 0, updated: 1 });

    const list = await authed(admin).get('/api/gl-codes');
    expect(list.body).toHaveLength(2);
    const updated = list.body.find((g: { code: string }) => g.code === '6000-100');
    expect(updated.name).toBe('Office supplies (updated)');
  });

  it('bulk uploads GL codes from CSV text with a header row', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const csv = [
      'code,name,description,category',
      '6000-100,Office supplies,"Pens, paper",expense',
      '4000-000,Product revenue,,revenue',
    ].join('\n');
    const res = await authed(admin).post('/api/gl-codes/upload').send({ csv });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: 2, updated: 0 });

    const list = await authed(admin).get('/api/gl-codes?search=Pens');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].description).toBe('Pens, paper');
  });

  it('updates and deactivates a GL code', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const created = await authed(admin).post('/api/gl-codes').send({ code: '9000', name: 'Old' });
    const patched = await authed(admin)
      .patch(`/api/gl-codes/${created.body.id}`)
      .send({ name: 'New', isActive: false });
    expect(patched.body).toMatchObject({ name: 'New', isActive: false });

    const activeOnly = await authed(admin).get('/api/gl-codes?active=true');
    expect(activeOnly.body).toHaveLength(0);
  });

  it('blocks deleting a GL code that has associations', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const gl = await authed(admin).post('/api/gl-codes').send({ code: '6000-100', name: 'Supplies' });
    await authed(admin)
      .post('/api/contracts')
      .send({ contractNumber: 'C-1', title: 'Cleaning', glCodeId: gl.body.id });

    const del = await authed(admin).delete(`/api/gl-codes/${gl.body.id}`);
    expect(del.status).toBe(409);
  });
});
