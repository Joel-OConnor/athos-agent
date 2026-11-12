/**
 * Reads `.env` in the working directory into process.env, when there is one.
 *
 * Node's own loader, no dependency. A variable already in the environment
 * wins, so `EXTRACT_PROVIDER=anthropic npm run eval:replies` still overrides
 * the file. Only the entry points call this (cli, server, eval): the library
 * never reads a file behind its caller's back, and the tests never pick up a
 * developer's .env.
 */
export function loadDotEnv(path = '.env'): void {
  try {
    process.loadEnvFile(path);
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') return;
    throw err;
  }
}

/**
 * One setting, with a blank value treated as unset. `.env.example` leaves
 * values blank on purpose, and `??` would read that blank as a real value:
 * `EXTRACT_CONCURRENCY=` must mean "the default", not zero workers.
 */
export function setting(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}
