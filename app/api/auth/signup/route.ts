import { NextResponse } from 'next/server';
import { createUserWithProfile } from '@/lib/store';
import { createUserSession, passwordRecord, sessionCookie } from '@/lib/auth';
import { BadRequestError, parseJson } from '@/lib/http';
import { signupSchema } from '@/lib/schemas';
export async function POST(request: Request) {
  try {
    const input = await parseJson(request, signupSchema);
    const user = await createUserWithProfile({ email: input.email, ...(await passwordRecord(input.password)) }, input.name);
    if (!user) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: input.name } }, { status: 201 });
    response.cookies.set(sessionCookie(await createUserSession(user.id)));
    return response;
  } catch (error) {
    if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
