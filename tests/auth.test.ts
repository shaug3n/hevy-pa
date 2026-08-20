import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createSession, createUser, getProfile, listStoreForTestsOnly, upsertProfile } from '@/lib/store';
import { createUserSession, hashSessionToken, passwordRecord, resolveSessionToken, verifyPassword } from '@/lib/auth';

const testRoot = path.join(process.cwd(), '.test-data');

beforeEach(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  process.env.DATA_STORE_PATH = path.join(testRoot, `store-${crypto.randomUUID()}.json`);
});
afterEach(async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  delete process.env.DATA_STORE_PATH;
});

describe('auth and durable local storage', () => {
  it('uses unique salts and verifies passwords safely', async () => {
    const first = await passwordRecord('correct horse battery staple');
    const second = await passwordRecord('correct horse battery staple');
    expect(first.passwordSalt).not.toBe(second.passwordSalt);
    expect(first.passwordHash).not.toBe(second.passwordHash);
    await expect(verifyPassword('correct horse battery staple', first.passwordSalt, first.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong password at least ten', first.passwordSalt, first.passwordHash)).resolves.toBe(false);
  });

  it('normalizes emails and stores only a session hash', async () => {
    const record = await passwordRecord('correct horse battery staple');
    const user = await createUser({ email: '  ATHLETE@example.test ', ...record });
    expect(user?.email).toBe('athlete@example.test');
    await expect(createUser({ email: 'athlete@example.test', ...record })).resolves.toBeNull();
    const token = await createUserSession(user!.id);
    const store = await listStoreForTestsOnly();
    expect(store.sessions[0].tokenHash).toBe(hashSessionToken(token));
    expect(store.sessions[0].tokenHash).not.toContain(token);
    await expect(resolveSessionToken(token)).resolves.toMatchObject({ id: user!.id });
    await expect(resolveSessionToken(user!.id)).resolves.toBeUndefined();
  });

  it('serializes concurrent owner-scoped writes', async () => {
    const users = await Promise.all(Array.from({ length: 12 }, async (_, index) => createUser({
      email: `athlete-${index}@example.test`, ...await passwordRecord(`password-${index}-long-enough`),
    })));
    expect((await listStoreForTestsOnly()).users).toHaveLength(12);
    await Promise.all(users.map((user, index) => upsertProfile(user!.id, {
      name: `Athlete ${index}`, coachStyle: 'High energy', onboardingComplete: false,
    })));
    expect((await Promise.all(users.map((user) => getProfile(user!.id)))).filter(Boolean)).toHaveLength(12);
  });

  it('does not overwrite corrupted data', async () => {
    const target = process.env.DATA_STORE_PATH!;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, '{not json');
    await expect(listStoreForTestsOnly()).rejects.toThrow('local data store is invalid');
  });

  it('rejects expired sessions', async () => {
    const user = await createUser({ email: 'athlete@example.test', ...await passwordRecord('correct horse battery staple') });
    const token = 'x'.repeat(48);
    await createSession({ userId: user!.id, tokenHash: hashSessionToken(token), expiresAt: new Date(0).toISOString() });
    await expect(resolveSessionToken(token)).resolves.toBeUndefined();
  });
});
