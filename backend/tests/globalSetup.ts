import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./test.db';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

  const dbFile = join(__dirname, '..', 'prisma', 'test.db');
  if (existsSync(dbFile)) unlinkSync(dbFile);
  const dbJournal = `${dbFile}-journal`;
  if (existsSync(dbJournal)) unlinkSync(dbJournal);

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
}
