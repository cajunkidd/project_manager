import { authed, createTestUser } from './helpers';

const smallPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

describe('attachments', () => {
  it('uploads an attachment to a task and lists it', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 'with file' });

    const upload = await authed(user).post(`/api/tasks/${task.body.id}/attachments`).send({
      fileName: 'pixel.png',
      mimeType: 'image/png',
      content: smallPngBase64,
    });
    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({
      fileName: 'pixel.png',
      mimeType: 'image/png',
      taskId: task.body.id,
    });
    expect(upload.body.fileSize).toBeGreaterThan(0);
    expect(upload.body).not.toHaveProperty('content');

    const list = await authed(user).get(`/api/tasks/${task.body.id}/attachments`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].uploadedBy?.id).toBe(user.id);
  });

  it('rejects unsupported mime types', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const res = await authed(user).post(`/api/tasks/${task.body.id}/attachments`).send({
      fileName: 'evil.exe',
      mimeType: 'application/x-msdownload',
      content: smallPngBase64,
    });
    expect(res.status).toBe(400);
  });

  it('rejects oversized files', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const oversize = Buffer.alloc(6 * 1024 * 1024, 0x41).toString('base64');
    const res = await authed(user).post(`/api/tasks/${task.body.id}/attachments`).send({
      fileName: 'big.txt',
      mimeType: 'text/plain',
      content: oversize,
    });
    expect(res.status).toBe(400);
  });

  it('downloads the attachment with original content and headers', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const upload = await authed(user).post(`/api/tasks/${task.body.id}/attachments`).send({
      fileName: 'pixel.png',
      mimeType: 'image/png',
      content: smallPngBase64,
    });

    const dl = await authed(user).get(`/api/attachments/${upload.body.id}/download`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toContain('image/png');
    expect(dl.headers['content-disposition']).toContain('pixel.png');
    expect(Buffer.from(dl.body).toString('base64')).toBe(smallPngBase64);
  });

  it('uploads attachments to projects and deletes them', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'P' });
    const upload = await authed(user)
      .post(`/api/projects/${project.body.id}/attachments`)
      .send({
        fileName: 'notes.txt',
        mimeType: 'text/plain',
        content: Buffer.from('hello world').toString('base64'),
      });
    expect(upload.status).toBe(201);

    const before = await authed(user).get(`/api/projects/${project.body.id}/attachments`);
    expect(before.body).toHaveLength(1);

    const del = await authed(user).delete(`/api/attachments/${upload.body.id}`);
    expect(del.status).toBe(204);

    const after = await authed(user).get(`/api/projects/${project.body.id}/attachments`);
    expect(after.body).toHaveLength(0);
  });

  it('cascades attachments when their task is deleted', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const upload = await authed(user).post(`/api/tasks/${task.body.id}/attachments`).send({
      fileName: 'a.txt',
      mimeType: 'text/plain',
      content: Buffer.from('hi').toString('base64'),
    });
    await authed(user).delete(`/api/tasks/${task.body.id}`);
    const dl = await authed(user).get(`/api/attachments/${upload.body.id}/download`);
    expect(dl.status).toBe(404);
  });
});
