import { ZodType } from 'zod';
export class BadRequestError extends Error { constructor(message = 'Invalid request') { super(message); } }
export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new BadRequestError('Invalid JSON'); }
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestError('Invalid request');
  return result.data;
}
