import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

let db: PGlite;
const athlete = '11111111-1111-4111-8111-111111111111';
const otherAthlete = '22222222-2222-4222-8222-222222222222';
const plan = '33333333-3333-4333-8333-333333333333';
const now = '2026-08-20T20:00:00.000Z';

beforeEach(async () => {
  db = new PGlite();
  const migration = await readFile(path.join(process.cwd(), 'scripts', 'migrations', '001_initial.sql'), 'utf8');
  await db.exec(migration);
});
afterEach(async () => { await db.close(); });

describe('Neon-compatible Postgres schema', () => {
  it('enforces normalized user identity and profile domains', async () => {
    await db.query('INSERT INTO users(id,email,password_salt,password_hash,created_at) VALUES($1,$2,$3,$4,$5)', [athlete, 'Athlete@example.test', 'salt', 'hash', now]);
    await expect(db.query('INSERT INTO users(id,email,password_salt,password_hash,created_at) VALUES($1,$2,$3,$4,$5)', [otherAthlete, 'athlete@example.test', 'salt', 'hash', now])).rejects.toThrow();
    await expect(db.query('INSERT INTO profiles(user_id,name,coach_style,updated_at) VALUES($1,$2,$3,$4)', [athlete, 'Athlete', 'Unsupported', now])).rejects.toThrow();
  });

  it('enforces plan ownership, ordered items, and deterministic messages', async () => {
    await db.query('INSERT INTO users(id,email,password_salt,password_hash,created_at) VALUES($1,$2,$3,$4,$5),($6,$7,$3,$4,$5)', [athlete, 'athlete@example.test', 'salt', 'hash', now, otherAthlete, 'other@example.test']);
    await db.query('INSERT INTO plans(id,user_id,title,status,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$5)', [plan, athlete, 'Consistency', 'active', now]);
    await expect(db.query('INSERT INTO plan_items(id,plan_id,user_id,title,status,position,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)', ['44444444-4444-4444-8444-444444444444', plan, otherAthlete, 'Cross-owner', 'pending', 0, now])).rejects.toThrow();
    await db.query('INSERT INTO plan_items(id,plan_id,user_id,title,status,position,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)', ['55555555-5555-4555-8555-555555555555', plan, athlete, 'Train', 'pending', 0, now]);
    await expect(db.query('INSERT INTO plan_items(id,plan_id,user_id,title,status,position,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$7)', ['66666666-6666-4666-8666-666666666666', plan, athlete, 'Duplicate', 'pending', 0, now])).rejects.toThrow();
    await db.query('INSERT INTO messages(id,user_id,role,content,created_at) VALUES($1,$2,$3,$4,$5),($6,$2,$7,$8,$5)', ['77777777-7777-4777-8777-777777777777', athlete, 'user', 'First', now, '88888888-8888-4888-8888-888888888888', 'assistant', 'Second']);
    const messages = await db.query<{ content: string }>('SELECT content FROM messages WHERE user_id = $1 ORDER BY sequence', [athlete]);
    expect(messages.rows.map((row) => row.content)).toEqual(['First', 'Second']);
  });
});
