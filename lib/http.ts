import { ZodType } from 'zod';
import { DatabaseError, NeonDbError } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';
import { StoreUnavailableError } from '@/lib/store';
export class BadRequestError extends Error { constructor(message = 'Invalid request') { super(message); } }
export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new BadRequestError('Invalid JSON'); }
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestError('Invalid request');
  return result.data;
}

export async function withStoreErrors(handler: () => Promise<Response>): Promise<Response> {
  try { return await handler(); }
  catch (error) {
    if (error instanceof StoreUnavailableError || error instanceof NeonDbError || error instanceof DatabaseError) {
      return NextResponse.json({ error: 'Service temporarily unavailable. Please try again.' }, { status: 503 });
    }
    throw error;
  }
}
