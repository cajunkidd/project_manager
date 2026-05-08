import request from 'supertest';
import { app, authed, createTestUser } from './helpers';

describe('attachments', () => {
  it('uploads an attachment to a task and lists it', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });

    const upload = await request(app)
      .post(`/api/tasks/${task.body.id}/attachments`)
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', Buffer.from('hello world'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });
    expect(upload.status).toBe(201);
    expect(upload.body.fileName).toBe('note.txt');
    expect(upload.body.fileSize).toBe('hello world'.length);

    const list = await authed(user).get(`/api/tasks/${task.body.id}/attachments`);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].uploadedBy.id).toBe(user.id);
  });

  it('downloads the original bytes', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const payload = Buffer.from('the bytes');
    const upload = await request(app)
      .post(`/api/tasks/${task.body.id}/attachments`)
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', payload, { filename: 'data.bin', contentType: 'text/plain' });

    const download = await request(app)
      .get(`/api/attachments/${upload.body.id}/download`)
      .set('Authorization', `Bearer ${user.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.headers['content-disposition']).toContain('data.bin');
    expect((download.body as Buffer).toString('utf8')).toBe('the bytes');
  });

  it('rejects disallowed MIME types', async () => {
    const user = await createTestUser();
    const task = await authed(user).post('/api/tasks').send({ title: 't' });
    const res = await request(app)
      .post(`/api/tasks/${task.body.id}/attachments`)
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', Buffer.from('x'), {
        filename: 'evil.exe',
        contentType: 'application/x-msdownload',
      });
    expect(res.status).toBe(400);
  });

  it('lets uploader and admin delete; blocks others', async () => {
    const author = await createTestUser({ email: 'a@x.com' });
    const stranger = await createTestUser({ email: 'b@x.com' });
    const admin = await createTestUser({ role: 'admin', email: 'admin@x.com' });
    const task = await authed(author).post('/api/tasks').send({ title: 't' });

    const upload = await request(app)
      .post(`/api/tasks/${task.body.id}/attachments`)
      .set('Authorization', `Bearer ${author.token}`)
      .attach('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });

    const blocked = await authed(stranger).delete(`/api/attachments/${upload.body.id}`);
    expect(blocked.status).toBe(403);

    const ok = await authed(admin).delete(`/api/attachments/${upload.body.id}`);
    expect(ok.status).toBe(204);
  });
});
