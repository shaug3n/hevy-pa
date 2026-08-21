import { randomUUID } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { z } from 'zod';
import { coachWorkoutCardSchema, type CoachWorkoutCard } from '@/lib/coach-contract';

const coachStyleSchema = z.enum(['Encouraging & direct', 'Calm & analytical', 'High energy']);
const profileSchema = z.object({
  userId: z.string().uuid(), name: z.string().min(1).max(80), coachStyle: coachStyleSchema,
  currentState: z.string().max(2_000).optional(), primaryGoal: z.string().max(500).optional(),
  initialPlan: z.string().max(2_000).optional(), hevyCredential: z.string().optional(),
  hevyMaskedSuffix: z.string().max(8).optional(), hevyUserId: z.string().max(200).optional(),
  hevyUserName: z.string().max(200).optional(), onboardingComplete: z.boolean(),
  updatedAt: z.string().datetime(), timezone: z.string().min(1).max(80), units: z.enum(['metric', 'imperial']),
});
const userSchema = z.object({
  id: z.string().uuid(), email: z.string().email(), passwordSalt: z.string().min(1),
  passwordHash: z.string().min(1), createdAt: z.string().datetime(),
});
const sessionSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(), createdAt: z.string().datetime(),
});
const goalSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), title: z.string().min(1).max(240),
  status: z.enum(['active', 'completed']), targetDate: z.string().date().optional(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
const messageSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8_000), cards: z.array(coachWorkoutCardSchema).max(3).optional(),
  createdAt: z.string().datetime(),
});
const planSchema = z.object({
  id: z.string().uuid(), userId: z.string().uuid(), title: z.string().min(1).max(160),
  status: z.enum(['active', 'completed']), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
const planItemSchema = z.object({
  id: z.string().uuid(), planId: z.string().uuid(), userId: z.string().uuid(), title: z.string().min(1).max(240),
  status: z.enum(['pending', 'completed']), position: z.number().int().nonnegative(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type CoachMessage = z.infer<typeof messageSchema>;
export type { CoachWorkoutCard } from '@/lib/coach-contract';
export type Plan = z.infer<typeof planSchema>;
export type PlanItem = z.infer<typeof planItemSchema>;
export type Store = { users: User[]; sessions: Session[]; profiles: Profile[]; goals: Goal[]; messages: CoachMessage[]; plans: Plan[]; planItems: PlanItem[] };

type ProfileInput = Omit<Profile, 'userId' | 'updatedAt' | 'timezone' | 'units'> & Partial<Pick<Profile, 'timezone' | 'units'>>;
type Row = Record<string, unknown>;
type Sql = NeonQueryFunction<false, false>;

export class StoreCorruptionError extends Error {
  constructor() { super('Persisted application data is invalid.'); this.name = 'StoreCorruptionError'; }
}
export class StoreUnavailableError extends Error {
  constructor() { super('Database is temporarily unavailable.'); this.name = 'StoreUnavailableError'; }
}
export class StoreBusyError extends StoreUnavailableError {}

const isTest = process.env.NODE_ENV === 'test';
const emptyStore = (): Store => ({ users: [], sessions: [], profiles: [], goals: [], messages: [], plans: [], planItems: [] });
let testStore = emptyStore();
const now = () => new Date().toISOString();
const identifier = () => randomUUID();
const iso = (value: unknown) => new Date(value as string | Date).toISOString();
const stringOrUndefined = (value: unknown) => typeof value === 'string' && value.length > 0 ? value : undefined;

function database(): Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new StoreUnavailableError();
  return neon(connectionString);
}
function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function parseCards(value: unknown): CoachWorkoutCard[] | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = z.array(coachWorkoutCardSchema).max(3).safeParse(typeof value === 'string' ? JSON.parse(value) : value);
  if (!parsed.success) throw new StoreCorruptionError();
  return parsed.data;
}
function mapUser(row: Row): User {
  return userSchema.parse({ id: row.id, email: row.email, passwordSalt: row.password_salt, passwordHash: row.password_hash, createdAt: iso(row.created_at) });
}
function mapSession(row: Row): Session {
  return sessionSchema.parse({ id: row.id, userId: row.user_id, tokenHash: row.token_hash, expiresAt: iso(row.expires_at), createdAt: iso(row.created_at) });
}
function mapProfile(row: Row): Profile {
  return profileSchema.parse({
    userId: row.user_id, name: row.name, coachStyle: row.coach_style, currentState: stringOrUndefined(row.current_state),
    primaryGoal: stringOrUndefined(row.primary_goal), initialPlan: stringOrUndefined(row.initial_plan), hevyCredential: stringOrUndefined(row.hevy_credential),
    hevyMaskedSuffix: stringOrUndefined(row.hevy_masked_suffix), hevyUserId: stringOrUndefined(row.hevy_user_id),
    hevyUserName: stringOrUndefined(row.hevy_user_name), onboardingComplete: row.onboarding_complete,
    updatedAt: iso(row.updated_at), timezone: row.timezone, units: row.units,
  });
}
function mapGoal(row: Row): Goal {
  return goalSchema.parse({ id: row.id, userId: row.user_id, title: row.title, status: row.status, targetDate: stringOrUndefined(row.target_date), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
}
function mapMessage(row: Row): CoachMessage {
  return messageSchema.parse({ id: row.id, userId: row.user_id, role: row.role, content: row.content, cards: parseCards(row.cards), createdAt: iso(row.created_at) });
}
function mapPlan(row: Row): Plan {
  return planSchema.parse({ id: row.id, userId: row.user_id, title: row.title, status: row.status, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
}
function mapPlanItem(row: Row): PlanItem {
  return planItemSchema.parse({ id: row.id, planId: row.plan_id, userId: row.user_id, title: row.title, status: row.status, position: row.position, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) });
}
function profileFromInput(userId: string, input: ProfileInput, updatedAt = now()): Profile {
  return profileSchema.parse({ ...input, userId, timezone: input.timezone ?? 'UTC', units: input.units ?? 'metric', updatedAt });
}
function testOnly() {
  if (!isTest) throw new Error('Test store is unavailable outside tests.');
}
export function resetStoreForTestsOnly() { testOnly(); testStore = emptyStore(); }

export async function getUser(id: string) {
  if (isTest) return testStore.users.find((entry) => entry.id === id);
  const rows = await database()`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? mapUser(rows[0]) : undefined;
}
export async function getUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (isTest) return testStore.users.find((entry) => entry.email === normalized);
  const rows = await database()`SELECT * FROM users WHERE email = ${normalized}`;
  return rows[0] ? mapUser(rows[0]) : undefined;
}
export async function getProfile(userId: string) {
  if (isTest) return testStore.profiles.find((entry) => entry.userId === userId);
  const rows = await database()`SELECT * FROM profiles WHERE user_id = ${userId}`;
  return rows[0] ? mapProfile(rows[0]) : undefined;
}
export async function getSessionByHash(tokenHash: string) {
  if (isTest) return testStore.sessions.find((entry) => entry.tokenHash === tokenHash);
  const rows = await database()`SELECT * FROM sessions WHERE token_hash = ${tokenHash}`;
  return rows[0] ? mapSession(rows[0]) : undefined;
}
export async function createUser(input: Omit<User, 'id' | 'createdAt'>): Promise<User | null> {
  const user: User = { ...input, id: identifier(), email: normalizeEmail(input.email), createdAt: now() };
  if (isTest) {
    if (testStore.users.some((entry) => entry.email === user.email)) return null;
    testStore.users.push(user); return user;
  }
  const rows = await database()`INSERT INTO users (id, email, password_salt, password_hash, created_at)
    VALUES (${user.id}, ${user.email}, ${user.passwordSalt}, ${user.passwordHash}, ${user.createdAt})
    ON CONFLICT DO NOTHING RETURNING *`;
  return rows[0] ? mapUser(rows[0]) : null;
}
export async function createUserWithProfile(input: Omit<User, 'id' | 'createdAt'>, name: string): Promise<User | null> {
  const user: User = { ...input, id: identifier(), email: normalizeEmail(input.email), createdAt: now() };
  const profile = profileFromInput(user.id, { name, coachStyle: 'Encouraging & direct', onboardingComplete: false });
  if (isTest) {
    if (testStore.users.some((entry) => entry.email === user.email)) return null;
    testStore.users.push(user); testStore.profiles.push(profile); return user;
  }
  const rows = await database()`WITH inserted_user AS (
      INSERT INTO users (id, email, password_salt, password_hash, created_at)
      VALUES (${user.id}, ${user.email}, ${user.passwordSalt}, ${user.passwordHash}, ${user.createdAt})
      ON CONFLICT DO NOTHING RETURNING id
    )
    INSERT INTO profiles (user_id, name, coach_style, onboarding_complete, timezone, units, updated_at)
    SELECT id, ${profile.name}, ${profile.coachStyle}, false, ${profile.timezone}, ${profile.units}, ${profile.updatedAt} FROM inserted_user
    RETURNING user_id`;
  return rows[0] ? user : null;
}
export async function createSession(input: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
  const session: Session = { ...input, id: identifier(), createdAt: now() };
  if (isTest) { testStore.sessions = testStore.sessions.filter((entry) => Date.parse(entry.expiresAt) > Date.now()); testStore.sessions.push(session); return session; }
  const sql = database();
  await sql.transaction([
    sql`DELETE FROM sessions WHERE expires_at <= now()`,
    sql`INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (${session.id}, ${session.userId}, ${session.tokenHash}, ${session.expiresAt}, ${session.createdAt})`,
  ]);
  return session;
}
export async function deleteSessionByHash(tokenHash: string) {
  if (isTest) { const before = testStore.sessions.length; testStore.sessions = testStore.sessions.filter((entry) => entry.tokenHash !== tokenHash); return before !== testStore.sessions.length; }
  const rows = await database()`DELETE FROM sessions WHERE token_hash = ${tokenHash} RETURNING id`;
  return rows.length > 0;
}
export async function upsertProfile(userId: string, input: ProfileInput): Promise<Profile> {
  const profile = profileFromInput(userId, input);
  if (isTest) {
    const index = testStore.profiles.findIndex((entry) => entry.userId === userId);
    if (index < 0) testStore.profiles.push(profile); else testStore.profiles[index] = profile;
    return profile;
  }
  const rows = await database()`WITH valid_user AS (SELECT id FROM users WHERE id = ${userId})
    INSERT INTO profiles (user_id, name, coach_style, current_state, primary_goal, initial_plan, hevy_credential, hevy_masked_suffix, hevy_user_id, hevy_user_name, onboarding_complete, timezone, units, updated_at)
    SELECT id, ${profile.name}, ${profile.coachStyle}, ${profile.currentState ?? null}, ${profile.primaryGoal ?? null}, ${profile.initialPlan ?? null}, ${profile.hevyCredential ?? null}, ${profile.hevyMaskedSuffix ?? null}, ${profile.hevyUserId ?? null}, ${profile.hevyUserName ?? null}, ${profile.onboardingComplete}, ${profile.timezone}, ${profile.units}, ${profile.updatedAt} FROM valid_user
    ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, coach_style = EXCLUDED.coach_style, current_state = EXCLUDED.current_state, primary_goal = EXCLUDED.primary_goal, initial_plan = EXCLUDED.initial_plan, hevy_credential = EXCLUDED.hevy_credential, hevy_masked_suffix = EXCLUDED.hevy_masked_suffix, hevy_user_id = EXCLUDED.hevy_user_id, hevy_user_name = EXCLUDED.hevy_user_name, onboarding_complete = EXCLUDED.onboarding_complete, timezone = EXCLUDED.timezone, units = EXCLUDED.units, updated_at = EXCLUDED.updated_at
    RETURNING *`;
  if (!rows[0]) throw new StoreUnavailableError();
  return mapProfile(rows[0]);
}
export async function updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId' | 'updatedAt'>>) {
  if (isTest) {
    const index = testStore.profiles.findIndex((entry) => entry.userId === userId);
    if (index < 0) return undefined;
    const profile = profileSchema.parse({ ...testStore.profiles[index], ...patch, userId, updatedAt: now() });
    testStore.profiles[index] = profile; return profile;
  }
  const rows = await database()`UPDATE profiles SET
      name = COALESCE(${patch.name ?? null}, name),
      coach_style = COALESCE(${patch.coachStyle ?? null}, coach_style),
      current_state = COALESCE(${patch.currentState ?? null}, current_state),
      primary_goal = COALESCE(${patch.primaryGoal ?? null}, primary_goal),
      initial_plan = COALESCE(${patch.initialPlan ?? null}, initial_plan),
      hevy_credential = COALESCE(${patch.hevyCredential ?? null}, hevy_credential),
      hevy_masked_suffix = COALESCE(${patch.hevyMaskedSuffix ?? null}, hevy_masked_suffix),
      hevy_user_id = COALESCE(${patch.hevyUserId ?? null}, hevy_user_id),
      hevy_user_name = COALESCE(${patch.hevyUserName ?? null}, hevy_user_name),
      onboarding_complete = COALESCE(${patch.onboardingComplete ?? null}, onboarding_complete),
      timezone = COALESCE(${patch.timezone ?? null}, timezone),
      units = COALESCE(${patch.units ?? null}, units),
      updated_at = now()
    WHERE user_id = ${userId} RETURNING *`;
  return rows[0] ? mapProfile(rows[0]) : undefined;
}
export async function completeOnboarding(userId: string, input: Omit<ProfileInput, 'onboardingComplete'>) {
  return updateProfile(userId, { ...input, onboardingComplete: true });
}
export async function listGoals(userId: string) {
  if (isTest) return testStore.goals.filter((entry) => entry.userId === userId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const rows = await database()`SELECT * FROM goals WHERE user_id = ${userId} ORDER BY updated_at DESC`;
  return rows.map(mapGoal);
}
export async function createGoal(userId: string, input: Pick<Goal, 'title' | 'targetDate'>): Promise<Goal> {
  const goal: Goal = { id: identifier(), userId, title: input.title, ...(input.targetDate ? { targetDate: input.targetDate } : {}), status: 'active', createdAt: now(), updatedAt: now() };
  if (isTest) { testStore.goals.push(goal); return goal; }
  const rows = await database()`INSERT INTO goals (id, user_id, title, status, target_date, created_at, updated_at)
    VALUES (${goal.id}, ${goal.userId}, ${goal.title}, ${goal.status}, ${goal.targetDate ?? null}, ${goal.createdAt}, ${goal.updatedAt}) RETURNING *`;
  return mapGoal(rows[0]);
}
export async function setGoalStatus(userId: string, goalId: string, status: Goal['status']) {
  if (isTest) {
    const index = testStore.goals.findIndex((entry) => entry.id === goalId && entry.userId === userId);
    if (index < 0) return undefined;
    const goal = { ...testStore.goals[index], status, updatedAt: now() }; testStore.goals[index] = goal; return goal;
  }
  const rows = await database()`UPDATE goals SET status = ${status}, updated_at = now() WHERE id = ${goalId} AND user_id = ${userId} RETURNING *`;
  return rows[0] ? mapGoal(rows[0]) : undefined;
}
export async function listMessages(userId: string, limit = 20) {
  if (isTest) return testStore.messages.filter((entry) => entry.userId === userId).slice(-limit);
  const rows = await database()`SELECT * FROM (SELECT * FROM messages WHERE user_id = ${userId} ORDER BY sequence DESC LIMIT ${limit}) recent ORDER BY sequence ASC`;
  return rows.map(mapMessage);
}
export async function appendConversationTurn(userId: string, userText: string, assistantText: string, cards?: CoachWorkoutCard[]) {
  const createdAt = now();
  const userMessage: CoachMessage = { id: identifier(), userId, role: 'user', content: userText, createdAt };
  const assistantMessage: CoachMessage = { id: identifier(), userId, role: 'assistant', content: assistantText, ...(cards?.length ? { cards } : {}), createdAt };
  if (isTest) {
    testStore.messages.push(userMessage, assistantMessage);
    const messages = testStore.messages.filter((entry) => entry.userId === userId).slice(-50);
    testStore.messages = testStore.messages.filter((entry) => entry.userId !== userId).concat(messages); return;
  }
  const sql = database();
  await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
    sql`INSERT INTO messages (id, user_id, role, content, cards, created_at) VALUES (${userMessage.id}, ${userId}, 'user', ${userText}, NULL, ${createdAt})`,
    sql`INSERT INTO messages (id, user_id, role, content, cards, created_at) VALUES (${assistantMessage.id}, ${userId}, 'assistant', ${assistantText}, ${cards?.length ? JSON.stringify(cards) : null}, ${createdAt})`,
    sql`DELETE FROM messages WHERE user_id = ${userId} AND sequence NOT IN (SELECT sequence FROM messages WHERE user_id = ${userId} ORDER BY sequence DESC LIMIT 50)`,
  ]);
}
export async function listPlans(userId: string) {
  if (isTest) return testStore.plans.filter((entry) => entry.userId === userId).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map((plan) => ({ ...plan, items: testStore.planItems.filter((item) => item.userId === userId && item.planId === plan.id).sort((left, right) => left.position - right.position) }));
  const sql = database();
  const [plans, items] = await Promise.all([sql`SELECT * FROM plans WHERE user_id = ${userId} ORDER BY created_at DESC`, sql`SELECT * FROM plan_items WHERE user_id = ${userId} ORDER BY position ASC`]);
  const mappedItems = items.map(mapPlanItem);
  return plans.map(mapPlan).map((plan) => ({ ...plan, items: mappedItems.filter((item) => item.planId === plan.id) }));
}
export async function createPlan(userId: string, title: string): Promise<Plan | undefined> {
  const plan: Plan = { id: identifier(), userId, title, status: 'active', createdAt: now(), updatedAt: now() };
  if (isTest) { if (!testStore.users.some((entry) => entry.id === userId)) return undefined; testStore.plans.push(plan); return plan; }
  const rows = await database()`WITH valid_user AS (SELECT id FROM users WHERE id = ${userId})
    INSERT INTO plans (id, user_id, title, status, created_at, updated_at) SELECT ${plan.id}, id, ${title}, 'active', ${plan.createdAt}, ${plan.updatedAt} FROM valid_user RETURNING *`;
  return rows[0] ? mapPlan(rows[0]) : undefined;
}
export async function setPlanStatus(userId: string, planId: string, status: Plan['status']) {
  if (isTest) {
    const index = testStore.plans.findIndex((entry) => entry.id === planId && entry.userId === userId);
    if (index < 0) return undefined;
    const plan = { ...testStore.plans[index], status, updatedAt: now() }; testStore.plans[index] = plan; return plan;
  }
  const rows = await database()`UPDATE plans SET status = ${status}, updated_at = now() WHERE id = ${planId} AND user_id = ${userId} RETURNING *`;
  return rows[0] ? mapPlan(rows[0]) : undefined;
}
export async function createPlanItem(userId: string, planId: string, title: string): Promise<PlanItem | undefined> {
  const item = { id: identifier(), createdAt: now(), updatedAt: now() };
  if (isTest) {
    if (!testStore.plans.some((entry) => entry.id === planId && entry.userId === userId)) return undefined;
    const position = testStore.planItems.filter((entry) => entry.planId === planId).length;
    const result: PlanItem = { ...item, planId, userId, title, status: 'pending', position }; testStore.planItems.push(result); return result;
  }
  const rows = await database()`WITH locked_plan AS (
      UPDATE plans SET next_item_position = next_item_position + 1 WHERE id = ${planId} AND user_id = ${userId}
      RETURNING next_item_position - 1 AS position
    )
    INSERT INTO plan_items (id, plan_id, user_id, title, status, position, created_at, updated_at)
    SELECT ${item.id}, ${planId}, ${userId}, ${title}, 'pending', position, ${item.createdAt}, ${item.updatedAt} FROM locked_plan
    RETURNING *`;
  return rows[0] ? mapPlanItem(rows[0]) : undefined;
}
export async function setPlanItemStatus(userId: string, planId: string, itemId: string, status: PlanItem['status']) {
  if (isTest) {
    const index = testStore.planItems.findIndex((entry) => entry.id === itemId && entry.planId === planId && entry.userId === userId);
    if (index < 0) return undefined;
    const item = { ...testStore.planItems[index], status, updatedAt: now() }; testStore.planItems[index] = item; return item;
  }
  const rows = await database()`UPDATE plan_items SET status = ${status}, updated_at = now() WHERE id = ${itemId} AND plan_id = ${planId} AND user_id = ${userId} RETURNING *`;
  return rows[0] ? mapPlanItem(rows[0]) : undefined;
}
export async function listStoreForTestsOnly() { testOnly(); return structuredClone(testStore); }
