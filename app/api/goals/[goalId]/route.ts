import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { setGoalStatus } from '@/lib/store';
import { BadRequestError, parseJson } from '@/lib/http';
import { withStoreErrors } from '@/lib/http';
import { goalPatchSchema } from '@/lib/schemas';
export async function PATCH(request: Request, { params }: { params: Promise<{ goalId: string }> }) {
  return withStoreErrors(async () => {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsedId = z.string().uuid().safeParse((await params).goalId);
  if (!parsedId.success) return NextResponse.json({ error: 'Invalid goal' }, { status: 400 });
  try {
    const goal = await setGoalStatus(user.id, parsedId.data, (await parseJson(request, goalPatchSchema)).status);
    return goal ? NextResponse.json({ goal }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error) { if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 }); throw error; }
  });
}
