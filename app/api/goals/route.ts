import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createGoal, listGoals } from '@/lib/store';
import { BadRequestError, parseJson } from '@/lib/http';
import { withStoreErrors } from '@/lib/http';
import { goalCreateSchema } from '@/lib/schemas';
export async function GET() {
  return withStoreErrors(async () => {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ goals: await listGoals(user.id) });
  });
}
export async function POST(request: Request) {
  return withStoreErrors(async () => {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ goal: await createGoal(user.id, await parseJson(request, goalCreateSchema)) }, { status: 201 }); }
  catch (error) { if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 }); throw error; }
  });
}
