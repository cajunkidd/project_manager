process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://pmuser:pmpass@localhost:5432/project_manager_test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
