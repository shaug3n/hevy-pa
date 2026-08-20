import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normalizeWorkouts, userInfoSchema, workoutsSchema } from './hevy-schemas.js';

type Options = { apiKey: string; baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number };
type SafeError = 'invalid_credentials' | 'rate_limited' | 'timeout' | 'upstream_unavailable' | 'invalid_response';
const error = (code: SafeError) => ({ isError: true as const, content: [{ type: 'text' as const, text: JSON.stringify({ error: code }) }] });

export function createHevyMcpServer({ apiKey, baseUrl = 'https://api.hevyapp.com/v1', fetchImpl = fetch, timeoutMs = 5_000 }: Options) {
  const url = new URL(baseUrl);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Hevy base URL must use HTTPS');
  const request = async (pathname: string, search = '') => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(new URL(`${pathname}${search}`, `${url.toString().replace(/\/$/, '')}/`), { method: 'GET', headers: { 'api-key': apiKey }, signal: controller.signal });
      if (!response.ok) {
        if ([401, 403, 404].includes(response.status)) return { code: 'invalid_credentials' as const };
        if (response.status === 429) return { code: 'rate_limited' as const };
        return { code: 'upstream_unavailable' as const };
      }
      try { return { data: await response.json() as unknown }; } catch { return { code: 'invalid_response' as const }; }
    } catch (caught) {
      return { code: (caught as Error).name === 'AbortError' ? 'timeout' as const : 'upstream_unavailable' as const };
    } finally { clearTimeout(timer); }
  };
  const server = new McpServer({ name: 'hevy-readonly', version: '1.0.0' });
  server.registerTool('hevy_get_user_info', { description: 'Read the authenticated Hevy account profile. This tool cannot write data.' }, async () => {
    const result = await request('user/info');
    if ('code' in result) return error(result.code || 'invalid_response');
    const parsed = userInfoSchema.safeParse(result.data);
    return parsed.success ? { content: [{ type: 'text' as const, text: JSON.stringify({ user: { id: parsed.data.data.id, name: parsed.data.data.name } }) }] } : error('invalid_response');
  });
  server.registerTool('hevy_list_workouts', { description: 'List recent Hevy workouts. This tool cannot write data.', inputSchema: { page: z.number().int().positive().optional(), pageSize: z.number().int().min(1).max(10).optional() } }, async ({ page = 1, pageSize = 5 }) => {
    const result = await request('workouts', `?page=${page}&pageSize=${pageSize}`);
    if ('code' in result) return error(result.code || 'invalid_response');
    const parsed = workoutsSchema.safeParse(result.data);
    return parsed.success ? { content: [{ type: 'text' as const, text: JSON.stringify({ page: parsed.data.page, pageCount: parsed.data.page_count, workouts: normalizeWorkouts(parsed.data) }) }] } : error('invalid_response');
  });
  return server;
}
