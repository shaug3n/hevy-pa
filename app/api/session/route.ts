import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getProfile } from '@/lib/store';
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ user: null });
  const profile = await getProfile(user.id);
  return NextResponse.json({ user, profile: profile ? { name: profile.name, onboardingComplete: profile.onboardingComplete } : null });
}
