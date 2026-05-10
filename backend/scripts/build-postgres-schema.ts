/**
 * Generates prisma/schema.postgres.prisma by swapping the datasource block
 * in schema.prisma to PostgreSQL. The two schemas are otherwise identical,
 * which keeps the SQLite-friendly model definitions usable on Postgres
 * without code changes elsewhere.
 *
 * Usage: ts-node scripts/build-postgres-schema.ts
 *        (invoked automatically by the prisma:postgres:* npm scripts)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', 'prisma');
const src = readFileSync(join(root, 'schema.prisma'), 'utf8');

const swapped = src.replace(
  /datasource db \{[\s\S]*?\}/m,
  `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`,
);

const header = `// AUTO-GENERATED from schema.prisma by scripts/build-postgres-schema.ts.\n// Do not edit by hand — re-run \`npm run prisma:postgres:generate\` instead.\n\n`;

writeFileSync(join(root, 'schema.postgres.prisma'), header + swapped, 'utf8');
console.log('Wrote prisma/schema.postgres.prisma');
