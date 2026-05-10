import request from 'supertest';
import { app, authed, createTestUser } from './helpers';

const helloB64 = Buffer.from('hello world', 'utf8').toString('base64');

describe('attachments', () => {
  it('uploads, lists, downloads, and deletes a task attachment', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'A' });

    const upload = await authed(user)
      .post(`/api/tasks/${t.body.id}/attachments`)
      .send({ fileName: 'note.txt', mimeType: 'text/plain', data: helloB64 });
    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({
      fileName: 'note.txt',
      mimeType: 'text/plain',
      fileSize: 11,
      taskId: t.body.id,
    });

    const list = await authed(user).get(`/api/tasks/${t.body.id}/attachments`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty('data');

    const download = await request(app)
      .get(`/api/attachments/${upload.body.id}/download`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/plain');
    expect(download.text).toBe('hello world');

    const del = await authed(user).delete(`/api/attachments/${upload.body.id}`);
    expect(del.status).toBe(204);

    const after = await authed(user).get(`/api/tasks/${t.body.id}/attachments`);
    expect(after.body).toHaveLength(0);
  });

  it('attaches a file to a project', async () => {
    const user = await createTestUser();
    const project = await authed(user).post('/api/projects').send({ name: 'P' });
    const upload = await authed(user)
      .post(`/api/projects/${project.body.id}/attachments`)
      .send({ fileName: 'spec.md', mimeType: 'text/markdown', data: helloB64 });
    expect(upload.status).toBe(201);

    const list = await authed(user).get(`/api/projects/${project.body.id}/attachments`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].projectId).toBe(project.body.id);
  });

  it('rejects oversized files', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'big' });
    const big = Buffer.alloc(6 * 1024 * 1024).toString('base64'); // 6 MB
    const res = await authed(user)
      .post(`/api/tasks/${t.body.id}/attachments`)
      .send({ fileName: 'big.bin', mimeType: 'application/octet-stream', data: big });
    expect(res.status).toBe(400);
  });

  it('rejects unsupported mime types', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'exe' });
    const res = await authed(user)
      .post(`/api/tasks/${t.body.id}/attachments`)
      .send({ fileName: 'x.exe', mimeType: 'application/x-msdownload', data: helloB64 });
    expect(res.status).toBe(400);
  });

  it('rejects empty data', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 't' });
    const res = await authed(user)
      .post(`/api/tasks/${t.body.id}/attachments`)
      .send({ fileName: 'empty.txt', mimeType: 'text/plain', data: '' });
    expect(res.status).toBe(400);
  });

  it('cascades attachments when the task is deleted', async () => {
    const user = await createTestUser();
    const t = await authed(user).post('/api/tasks').send({ title: 'gone' });
    const upload = await authed(user)
      .post(`/api/tasks/${t.body.id}/attachments`)
      .send({ fileName: 'note.txt', mimeType: 'text/plain', data: helloB64 });

    await authed(user).delete(`/api/tasks/${t.body.id}`);

    const dl = await authed(user).get(`/api/attachments/${upload.body.id}/download`);
    expect(dl.status).toBe(404);
  });
});
