import { NextResponse } from 'next/server';
import { expiredSessionCookie, revokeCurrentSession } from '@/lib/auth';
import { withStoreErrors } from '@/lib/http';
export async function POST() {
  return withStoreErrors(async () => {
    await revokeCurrentSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(expiredSessionCookie());
    return response;
  });
}
