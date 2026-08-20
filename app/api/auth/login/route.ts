import { NextResponse } from 'next/server';
import { createUserSession, passwordRecord, sessionCookie, verifyPassword } from '@/lib/auth';
import { getUserByEmail } from '@/lib/store';
import { BadRequestError, parseJson } from '@/lib/http';
import { credentialsSchema } from '@/lib/schemas';
export async function POST(request: Request) {
  try {
    const input = await parseJson(request, credentialsSchema);
    const user = await getUserByEmail(input.email);
    const valid = user ? await verifyPassword(input.password, user.passwordSalt, user.passwordHash) : (await passwordRecord(input.password), false);
    if (!user || !valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    const response = NextResponse.json({ user: { id: user.id, email: user.email } });
    response.cookies.set(sessionCookie(await createUserSession(user.id)));
    return response;
  } catch (error) {
    if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
