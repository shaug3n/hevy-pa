import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createPlan, listPlans } from '@/lib/store';
import { BadRequestError, parseJson } from '@/lib/http';
import { planCreateSchema } from '@/lib/schemas';
export async function GET() { const user = await requireUser(); return user ? NextResponse.json({ plans: await listPlans(user.id) }) : NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
export async function POST(request: Request) {
  const user = await requireUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { const plan = await createPlan(user.id, (await parseJson(request, planCreateSchema)).title); return plan ? NextResponse.json({ plan }, { status: 201 }) : NextResponse.json({ error: 'Not found' }, { status: 404 }); }
  catch (error) { if (error instanceof BadRequestError) return NextResponse.json({ error: error.message }, { status: 400 }); throw error; }
}
