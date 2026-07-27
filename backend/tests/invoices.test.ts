import { authed, createTestUser } from './helpers';

async function makeGlCode(admin: Awaited<ReturnType<typeof createTestUser>>, code = '6000-100') {
  const res = await authed(admin).post('/api/gl-codes').send({ code, name: `GL ${code}` });
  return res.body.id as string;
}

describe('invoices routes', () => {
  it('creates an invoice associated with a GL code and a contract', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const glCodeId = await makeGlCode(admin);
    const contract = await authed(admin)
      .post('/api/contracts')
      .send({ contractNumber: 'C-1', title: 'Services', glCodeId });

    const res = await authed(admin).post('/api/invoices').send({
      invoiceNumber: 'INV-500',
      vendor: 'CleanCo',
      amount: 1500.5,
      glCodeId,
      contractId: contract.body.id,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ invoiceNumber: 'INV-500', status: 'pending', amount: 1500.5 });
    expect(res.body.glCode.id).toBe(glCodeId);
    expect(res.body.contract.id).toBe(contract.body.id);
  });

  it('rejects an invoice referencing an unknown GL code', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const res = await authed(admin).post('/api/invoices').send({
      invoiceNumber: 'INV-1',
      amount: 10,
      glCodeId: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(400);
  });

  it('requires an amount', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const res = await authed(admin).post('/api/invoices').send({ invoiceNumber: 'INV-2' });
    expect(res.status).toBe(400);
  });

  it('re-associates an invoice to a different GL code and updates status', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const glA = await makeGlCode(admin, '6000-100');
    const glB = await makeGlCode(admin, '6000-200');
    const created = await authed(admin)
      .post('/api/invoices')
      .send({ invoiceNumber: 'INV-3', amount: 100, glCodeId: glA });
    const patched = await authed(admin)
      .patch(`/api/invoices/${created.body.id}`)
      .send({ glCodeId: glB, status: 'paid' });
    expect(patched.body.glCode.id).toBe(glB);
    expect(patched.body.status).toBe('paid');
  });

  it('filters invoices by GL code and by status', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    const glA = await makeGlCode(admin, '6000-100');
    const glB = await makeGlCode(admin, '6000-200');
    await authed(admin).post('/api/invoices').send({ invoiceNumber: 'INV-A', amount: 1, glCodeId: glA, status: 'paid' });
    await authed(admin).post('/api/invoices').send({ invoiceNumber: 'INV-B', amount: 2, glCodeId: glB });

    const byGl = await authed(admin).get(`/api/invoices?glCodeId=${glA}`);
    expect(byGl.body).toHaveLength(1);
    expect(byGl.body[0].invoiceNumber).toBe('INV-A');

    const paid = await authed(admin).get('/api/invoices?status=paid');
    expect(paid.body).toHaveLength(1);
  });

  it('rejects non-privileged writes but allows reads', async () => {
    const admin = await createTestUser({ role: 'admin', email: 'a@x.com' });
    await authed(admin).post('/api/invoices').send({ invoiceNumber: 'INV-X', amount: 5 });
    const user = await createTestUser();
    const write = await authed(user).post('/api/invoices').send({ invoiceNumber: 'INV-Y', amount: 5 });
    expect(write.status).toBe(403);
    const read = await authed(user).get('/api/invoices');
    expect(read.status).toBe(200);
    expect(read.body).toHaveLength(1);
  });
});
