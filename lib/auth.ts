import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { createSession, deleteSessionByHash, getSessionByHash, getUser, type User } from '@/lib/store';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = 'hevy_pa_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export type SafeUser = Pick<User, 'id' | 'email' | 'createdAt'>;

export async function passwordRecord(password: string) {
  const passwordSalt = randomBytes(16).toString('base64');
  const passwordHash = (await scrypt(password, Buffer.from(passwordSalt, 'base64'), 64)) as Buffer;
  return { passwordSalt, passwordHash: passwordHash.toString('base64') };
}
export async function verifyPassword(password: string, passwordSalt: string, passwordHash: string) {
  try {
    const expected = Buffer.from(passwordHash, 'base64');
    if (expected.length !== 64) return false;
    const actual = (await scrypt(password, Buffer.from(passwordSalt, 'base64'), 64)) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}
export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');
export async function createUserSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await createSession({ userId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1_000).toISOString() });
  return token;
}
export const sessionCookie = (token: string) => ({ name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_MAX_AGE_SECONDS });
export const expiredSessionCookie = () => ({ ...sessionCookie(''), maxAge: 0 });
export async function resolveSessionToken(token?: string): Promise<SafeUser | undefined> {
  if (!token || token.length < 40) return undefined;
  const tokenHash = hashSessionToken(token);
  const session = await getSessionByHash(tokenHash);
  if (!session) return undefined;
  if (Date.parse(session.expiresAt) <= Date.now()) { await deleteSessionByHash(tokenHash); return undefined; }
  const user = await getUser(session.userId);
  return user ? { id: user.id, email: user.email, createdAt: user.createdAt } : undefined;
}
export async function requireUser(): Promise<SafeUser | undefined> { return resolveSessionToken((await cookies()).get(SESSION_COOKIE)?.value); }
export async function revokeCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByHash(hashSessionToken(token));
}
