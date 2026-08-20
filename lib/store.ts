import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';
import { z } from 'zod';

const userSchema = z.object({
  id: z.string().uuid(), email: z.string().email(), passwordSalt: z.string().min(1),
  passwordHash: z.string().min(1), createdAt: z.string().datetime(),
});
const sessionSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(), createdAt: z.string().datetime(),
});
const profileSchema = z.object({
  userId: z.string().uuid(), name: z.string().min(1).max(80),
  coachStyle: z.enum(['Encouraging & direct', 'Calm & analytical', 'High energy']),
  currentState: z.string().max(2_000).optional(), primaryGoal: z.string().max(500).optional(),
  initialPlan: z.string().max(2_000).optional(), hevyCredential: z.string().optional(),
  hevyMaskedSuffix: z.string().max(8).optional(), hevyUserId: z.string().max(200).optional(),
  hevyUserName: z.string().max(200).optional(),
  onboardingComplete: z.boolean().default(false), updatedAt: z.string().datetime(),
  timezone: z.string().max(80).default('UTC'), units: z.enum(['metric','imperial']).default('metric'),
});
const planItemSchema = z.object({ id: z.string().uuid(), planId: z.string().uuid(), userId: z.string().uuid(), title: z.string().min(1).max(240), status: z.enum(['pending', 'completed']), position: z.number().int().nonnegative(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() });
const planSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid(), title: z.string().min(1).max(160), status: z.enum(['active', 'completed']), createdAt: z.string().datetime(), updatedAt: z.string().datetime() });
const goalSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), title: z.string().min(1).max(240),
  status: z.enum(['active', 'completed']), targetDate: z.string().date().optional(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
const messageSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8_000), createdAt: z.string().datetime(),
});
const storeSchema = z.object({
  version: z.literal(1), users: z.array(userSchema), sessions: z.array(sessionSchema),
  profiles: z.array(profileSchema), goals: z.array(goalSchema), messages: z.array(messageSchema), plans:z.array(planSchema).default([]), planItems:z.array(planItemSchema).default([]),
});

export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CoachMessage = z.infer<typeof messageSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanItem = z.infer<typeof planItemSchema>;
type ProfileInput = Omit<Profile, 'userId' | 'updatedAt' | 'timezone' | 'units'> & Partial<Pick<Profile, 'timezone' | 'units'>>;
export type Store = z.infer<typeof storeSchema>;
export class StoreCorruptionError extends Error {
  constructor() { super('The local data store is invalid. Restore it from a backup before continuing.'); this.name = 'StoreCorruptionError'; }
}
export class StoreBusyError extends Error {
  constructor() { super('The local data store is busy. Please retry.'); this.name = 'StoreBusyError'; }
}

const emptyStore = (): Store => ({ version: 1, users: [], sessions: [], profiles: [], goals: [], messages: [], plans:[], planItems:[] });
const storePath = () => process.env.DATA_STORE_PATH || path.join(process.env.LOCALAPPDATA || path.join(process.cwd(), 'data'), 'hevy-pa', 'store.json');
const lockTargetPath = () => `${storePath()}.lock-target`;
const retryableReadError = (error: unknown) => ['ENOENT', 'EPERM', 'EBUSY'].includes((error as NodeJS.ErrnoException).code || '');
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readStoreUnlocked(): Promise<Store> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await fs.readFile(storePath(), 'utf8');
      const parsed = storeSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) throw new StoreCorruptionError();
      return parsed.data;
    } catch (error) {
      if (error instanceof StoreCorruptionError || error instanceof SyntaxError) throw new StoreCorruptionError();
      if (retryableReadError(error) && attempt === 0) { await wait(15); continue; }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
      throw error;
    }
  }
  return emptyStore();
}
async function ensureLockTarget() {
  const target = lockTargetPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const handle = await fs.open(target, 'a');
  await handle.close();
}
async function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  await ensureLockTarget();
  let release: (() => Promise<void>) | undefined;
  try {
    try {
      release = await lockfile.lock(lockTargetPath(), {
        realpath: false, stale: 30_000, update: 5_000,
        retries: { retries: 100, factor: 1.15, minTimeout: 10, maxTimeout: 100 },
      });
    } catch { throw new StoreBusyError(); }
    return await operation();
  } finally {
    if (release) await release().catch(() => undefined);
  }
}
async function writeStoreUnlocked(store: Store) {
  const destination = storePath();
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const serialized = JSON.stringify(storeSchema.parse(store), null, 2);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await writeFileAtomic(destination, serialized, { encoding: 'utf8', fsync: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(code || '') || attempt === 7) {
        if (['EPERM', 'EBUSY', 'EACCES'].includes(code || '')) throw new StoreBusyError();
        throw error;
      }
      await wait(Math.min(250, 10 * 2 ** attempt) + Math.floor(Math.random() * 10));
    }
  }
}
export async function withStoreMutation<T>(mutator: (store: Store) => Promise<T> | T): Promise<T> {
  return withStoreLock(async () => {
    const store = structuredClone(await readStoreUnlocked());
    const result = await mutator(store);
    await writeStoreUnlocked(store);
    return result;
  });
}
async function readStore() { return withStoreLock(readStoreUnlocked); }
export async function getUser(id: string) { return (await readStore()).users.find((user) => user.id === id); }
export async function getUserByEmail(email: string) { return (await readStore()).users.find((user) => user.email === email.trim().toLowerCase()); }
export async function getProfile(userId: string) { return (await readStore()).profiles.find((profile) => profile.userId === userId); }
export async function getSessionByHash(tokenHash: string) { return (await readStore()).sessions.find((session) => session.tokenHash === tokenHash); }
export async function createUser(input: Omit<User, 'id' | 'createdAt'>): Promise<User | null> {
  return withStoreMutation((store) => {
    const email = input.email.trim().toLowerCase();
    if (store.users.some((user) => user.email === email)) return null;
    const user: User = { ...input, id: randomUUID(), email, createdAt: new Date().toISOString() };
    store.users.push(user); return user;
  });
}
export async function createUserWithProfile(input: Omit<User, 'id' | 'createdAt'>, name: string): Promise<User | null> {
  return withStoreMutation((store) => {
    const email = input.email.trim().toLowerCase();
    if (store.users.some((user) => user.email === email)) return null;
    const user: User = { ...input, id: randomUUID(), email, createdAt: new Date().toISOString() };
    store.users.push(user);
    store.profiles.push({ userId: user.id, name, coachStyle: 'Encouraging & direct', timezone: 'UTC', units: 'metric', onboardingComplete: false, updatedAt: new Date().toISOString() });
    return user;
  });
}
export async function createSession(input: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
  return withStoreMutation((store) => {
    const session: Session = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    store.sessions.push(session); return session;
  });
}
export async function deleteSessionByHash(tokenHash: string) {
  return withStoreMutation((store) => {
    const before = store.sessions.length;
    store.sessions = store.sessions.filter((session) => session.tokenHash !== tokenHash);
    return before !== store.sessions.length;
  });
}
export async function upsertProfile(userId: string, input: ProfileInput): Promise<Profile> {
  return withStoreMutation((store) => {
    const profile: Profile = { ...input, timezone: input.timezone ?? 'UTC', units: input.units ?? 'metric', userId, updatedAt: new Date().toISOString() };
    const index = store.profiles.findIndex((candidate) => candidate.userId === userId);
    if (index === -1) store.profiles.push(profile); else store.profiles[index] = profile;
    return profile;
  });
}
export async function updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId' | 'updatedAt'>>): Promise<Profile | undefined> {
  return withStoreMutation((store) => {
    const index = store.profiles.findIndex((profile) => profile.userId === userId);
    if (index === -1) return undefined;
    const profile: Profile = { ...store.profiles[index], ...patch, userId, updatedAt: new Date().toISOString() };
    store.profiles[index] = profile; return profile;
  });
}
export async function completeOnboarding(userId: string, input: Omit<ProfileInput, 'onboardingComplete'>): Promise<Profile | undefined> {
  return withStoreMutation((store) => {
    if (!store.users.some((user) => user.id === userId)) return undefined;
    const profile: Profile = { ...input, timezone: input.timezone ?? 'UTC', units: input.units ?? 'metric', userId, onboardingComplete: true, updatedAt: new Date().toISOString() };
    const index = store.profiles.findIndex((candidate) => candidate.userId === userId);
    if (index === -1) store.profiles.push(profile); else store.profiles[index] = profile;
    return profile;
  });
}
export async function listGoals(userId: string) {
  return (await readStore()).goals.filter((goal) => goal.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function createGoal(userId: string, input: Pick<Goal, 'title' | 'targetDate'>): Promise<Goal> {
  return withStoreMutation((store) => {
    const now = new Date().toISOString();
    const goal: Goal = { id: randomUUID(), userId, title: input.title, ...(input.targetDate ? { targetDate: input.targetDate } : {}), status: 'active', createdAt: now, updatedAt: now };
    store.goals.push(goal); return goal;
  });
}
export async function setGoalStatus(userId: string, goalId: string, status: Goal['status']): Promise<Goal | undefined> {
  return withStoreMutation((store) => {
    const index = store.goals.findIndex((goal) => goal.userId === userId && goal.id === goalId);
    if (index === -1) return undefined;
    const goal: Goal = { ...store.goals[index], status, updatedAt: new Date().toISOString() };
    store.goals[index] = goal; return goal;
  });
}
export async function listMessages(userId: string, limit = 20) {
  return (await readStore()).messages.filter((message) => message.userId === userId).slice(-limit);
}
export async function appendConversationTurn(userId: string, userText: string, assistantText: string) {
  return withStoreMutation((store) => {
    const now = new Date().toISOString();
    store.messages.push({ id: randomUUID(), userId, role: 'user', content: userText, createdAt: now }, { id: randomUUID(), userId, role: 'assistant', content: assistantText, createdAt: now });
    const all = store.messages.filter((message) => message.userId === userId);
    if (all.length > 50) {
      const keep = new Set(all.slice(-50).map((message) => message.id));
      store.messages = store.messages.filter((message) => message.userId !== userId || keep.has(message.id));
    }
  });
}
export async function listPlans(userId: string) {
  const store = await readStore();
  return store.plans.filter((plan) => plan.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((plan) => ({ ...plan, items: store.planItems.filter((item) => item.userId === userId && item.planId === plan.id).sort((a, b) => a.position - b.position) }));
}
export async function createPlan(userId: string, title: string): Promise<Plan | undefined> {
  return withStoreMutation((store) => {
    if (!store.users.some((user) => user.id === userId)) return undefined;
    const now = new Date().toISOString(), plan: Plan = { id: randomUUID(), userId, title, status: 'active', createdAt: now, updatedAt: now };
    store.plans.push(plan); return plan;
  });
}
export async function setPlanStatus(userId: string, planId: string, status: Plan['status']): Promise<Plan | undefined> {
  return withStoreMutation((store) => {
    const index = store.plans.findIndex((plan) => plan.id === planId && plan.userId === userId);
    if (index === -1) return undefined;
    const plan = { ...store.plans[index], status, updatedAt: new Date().toISOString() }; store.plans[index] = plan; return plan;
  });
}
export async function createPlanItem(userId: string, planId: string, title: string): Promise<PlanItem | undefined> {
  return withStoreMutation((store) => {
    if (!store.plans.some((plan) => plan.id === planId && plan.userId === userId)) return undefined;
    const now = new Date().toISOString(), position = store.planItems.filter((item) => item.userId === userId && item.planId === planId).length;
    const item: PlanItem = { id: randomUUID(), userId, planId, title, status: 'pending', position, createdAt: now, updatedAt: now }; store.planItems.push(item); return item;
  });
}
export async function setPlanItemStatus(userId: string, planId: string, itemId: string, status: PlanItem['status']): Promise<PlanItem | undefined> {
  return withStoreMutation((store) => {
    const index = store.planItems.findIndex((item) => item.id === itemId && item.planId === planId && item.userId === userId);
    if (index === -1) return undefined;
    const item = { ...store.planItems[index], status, updatedAt: new Date().toISOString() }; store.planItems[index] = item; return item;
  });
}
export async function listStoreForTestsOnly() { return readStore(); }
