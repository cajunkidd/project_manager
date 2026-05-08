import { execSync } from 'node:child_process';
import { join } from 'node:path';

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://pmuser:pmpass@localhost:5432/project_manager_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';

  // Drop and recreate the public schema, then apply migrations. This is the
  // Postgres equivalent of nuking the SQLite file before each suite run.
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
}
