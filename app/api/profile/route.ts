import { NextResponse } from 'next/server';
import { getProfile, upsertProfile, updateProfile } from '@/lib/store';
import { requireUser } from '@/lib/auth';
import { BadRequestError, parseJson } from '@/lib/http';
import { profileSchema } from '@/lib/schemas';

const publicProfile = (profile: Awaited<ReturnType<typeof getProfile>>) => profile && ({
  name: profile.name, coachStyle: profile.coachStyle, currentState: profile.currentState,
  primaryGoal: profile.primaryGoal, initialPlan: profile.initialPlan, onboardingComplete: profile.onboardingComplete,
  hasHevyConnection: Boolean(profile.hevyCredential), hevyMaskedSuffix: profile.hevyMaskedSuffix, timezone: profile.timezone || 'UTC', units: profile.units || 'metric',
});
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ profile: publicProfile(await getProfile(user.id)) });
}
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await parseJson(request, profileSchema);
    const existing = await getProfile(user.id);
    const profile = existing ? await updateProfile(user.id, input) : await upsertProfile(user.id, { ...input, onboardingComplete: false });
    return NextResponse.json({ profile: publicProfile(profile) });
  } catch (error) {
    if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
