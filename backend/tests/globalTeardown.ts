import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

export default async function globalTeardown() {
  const dbFile = join(__dirname, '..', 'prisma', 'test.db');
  if (existsSync(dbFile)) unlinkSync(dbFile);
  const dbJournal = `${dbFile}-journal`;
  if (existsSync(dbJournal)) unlinkSync(dbJournal);
}
