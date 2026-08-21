import { beforeEach, describe, expect, it } from 'vitest';
import { appendConversationTurn, completeOnboarding, createPlan, createPlanItem, createSession, createUser, getProfile, listMessages, listPlans, listStoreForTestsOnly, resetStoreForTestsOnly, setPlanItemStatus, updateProfile, upsertProfile } from '@/lib/store';
import { createUserSession, hashSessionToken, passwordRecord, resolveSessionToken, verifyPassword } from '@/lib/auth';

beforeEach(() => resetStoreForTestsOnly());

describe('auth and the test-only storage adapter', () => {
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

  it('isolates concurrent user writes in the test adapter', async () => {
    const users = await Promise.all(Array.from({ length: 12 }, async (_, index) => createUser({
      email: `athlete-${index}@example.test`, ...await passwordRecord(`password-${index}-long-enough`),
    })));
    expect((await listStoreForTestsOnly()).users).toHaveLength(12);
    await Promise.all(users.map((user, index) => upsertProfile(user!.id, { name: `Athlete ${index}`, coachStyle: 'High energy', onboardingComplete: false })));
    expect((await Promise.all(users.map((user) => getProfile(user!.id)))).filter(Boolean)).toHaveLength(12);
  });

  it('completes onboarding through an atomic profile patch', async () => {
    const user = await createUser({ email: 'onboarding@example.test', ...await passwordRecord('correct horse battery staple') });
    await upsertProfile(user!.id, { name: 'Athlete', coachStyle: 'Calm & analytical', currentState: 'Recovering', onboardingComplete: false });
    await updateProfile(user!.id, { currentState: 'Ready to train' });
    await completeOnboarding(user!.id, {
      name: 'Athlete', coachStyle: 'High energy', hevyCredential: 'encrypted', hevyMaskedSuffix: '1234',
      hevyUserId: 'hevy-user', hevyUserName: 'Hevy Athlete', timezone: 'Europe/Oslo', units: 'metric',
    });
    await expect(getProfile(user!.id)).resolves.toMatchObject({
      currentState: 'Ready to train', coachStyle: 'High energy', onboardingComplete: true, hevyCredential: 'encrypted',
    });
  });

  it('rejects expired sessions', async () => {
    const user = await createUser({ email: 'athlete@example.test', ...await passwordRecord('correct horse battery staple') });
    const token = 'x'.repeat(48);
    await createSession({ userId: user!.id, tokenHash: hashSessionToken(token), expiresAt: new Date(0).toISOString() });
    await expect(resolveSessionToken(token)).resolves.toBeUndefined();
  });

  it('keeps plans, items, and chat history owner scoped', async () => {
    const password = await passwordRecord('correct horse battery staple');
    const first = await createUser({ email: 'first@example.test', ...password });
    const second = await createUser({ email: 'second@example.test', ...password });
    const plan = await createPlan(first!.id, 'Build consistency');
    const item = await createPlanItem(first!.id, plan!.id, 'Train Monday');
    await expect(createPlanItem(second!.id, plan!.id, 'Not allowed')).resolves.toBeUndefined();
    await expect(setPlanItemStatus(second!.id, plan!.id, item!.id, 'completed')).resolves.toBeUndefined();
    await appendConversationTurn(first!.id, 'What now?', 'Train Monday.');
    expect((await listPlans(first!.id))[0].items).toHaveLength(1);
    expect(await listPlans(second!.id)).toEqual([]);
    expect(await listMessages(first!.id)).toHaveLength(2);
    expect(await listMessages(second!.id)).toEqual([]);
  });
});
