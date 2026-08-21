import { afterEach, describe, expect, it, vi } from 'vitest';
import { NeonDbError } from '@neondatabase/serverless';
import { StoreUnavailableError } from '@/lib/store';
import { withStoreErrors } from '@/lib/http';

const originalNodeEnv = process.env.NODE_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV; else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDatabaseUrl;
  vi.resetModules();
});

describe('database availability boundary', () => {
  it('returns a generic 503 for unavailable store and Neon errors', async () => {
    const unavailable = await withStoreErrors(async () => { throw new StoreUnavailableError(); });
    const neonFailure = await withStoreErrors(async () => { throw new NeonDbError('connection refused'); });
    expect(unavailable.status).toBe(503);
    expect(neonFailure.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ error: 'Service temporarily unavailable. Please try again.' });
  });

  it('turns missing DATABASE_URL during signup into a 503 response', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { POST } = await import('@/app/api/auth/signup/route');
    const response = await POST(new Request('http://localhost/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Athlete', email: 'athlete@example.test', password: 'correct horse battery staple' }),
    }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Service temporarily unavailable. Please try again.' });
  });
});
