import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { callHevyToolWithKey, HevyToolError } from '@/lib/hevy-mcp-client';
import { BadRequestError, parseJson } from '@/lib/http';
import { onboardingSchema } from '@/lib/schemas';
import { completeOnboarding } from '@/lib/store';

const statusFor = (code: string) => code === 'rate_limited' ? 429 : ['timeout', 'upstream_unavailable'].includes(code) ? 503 : 400;
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await parseJson(request, onboardingSchema);
    const result = await callHevyToolWithKey(input.hevyKey, 'hevy_get_user_info');
    const hevy = result.user as { id: string; name: string };
    if (!hevy?.id || !hevy.name) throw new HevyToolError('invalid_response');
    const profile = await completeOnboarding(user.id, {
      name: input.name, coachStyle: input.coachStyle, currentState: input.currentState, primaryGoal: input.primaryGoal,
      ...(input.initialPlan ? { initialPlan: input.initialPlan } : {}), timezone: input.timezone || 'UTC', units: input.units || 'metric', hevyCredential: encrypt(input.hevyKey),
      hevyMaskedSuffix: `••••${input.hevyKey.slice(-4)}`, hevyUserId: hevy.id, hevyUserName: hevy.name,
    });
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ profile: { name: profile.name, coachStyle: profile.coachStyle, timezone: profile.timezone, units: profile.units, onboardingComplete: true, hasHevyConnection: true, hevyMaskedSuffix: profile.hevyMaskedSuffix } });
  } catch (error) {
    if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof HevyToolError) return NextResponse.json({ error: error.code === 'invalid_credentials' ? 'Hevy key could not be validated.' : 'Hevy is temporarily unavailable. Please try again.' }, { status: statusFor(error.code) });
    throw error;
  }
}
