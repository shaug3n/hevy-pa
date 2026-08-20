import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getProfile } from '@/lib/store';
import { callUserHevyTool, HevyToolError } from '@/lib/hevy-mcp-client';
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await getProfile(user.id);
  if (!profile?.onboardingComplete) return NextResponse.json({ error: 'Complete onboarding first' }, { status: 409 });
  try {
    const result = await callUserHevyTool(user.id, 'hevy_list_workouts', { page: 1, pageSize: 5 });
    return NextResponse.json({ workouts: result.workouts || [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof HevyToolError && error.code === 'rate_limited' ? 429 : 503;
    return NextResponse.json({ error: 'Hevy is temporarily unavailable. Please try again.' }, { status });
  }
}
