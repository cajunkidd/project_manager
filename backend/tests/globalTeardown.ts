export default async function globalTeardown() {
  // No-op for Postgres; globalSetup nukes and re-applies migrations next run.
}
