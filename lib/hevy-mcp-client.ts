import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createHevyMcpServer } from '@hevy-pa/hevy-mcp';
import { decrypt } from '@/lib/crypto';
import { getProfile } from '@/lib/store';

const allowedTools = new Set(['hevy_get_user_info', 'hevy_list_workouts']);
type HevyCallOptions = { baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number };
export class HevyToolError extends Error {
  constructor(public readonly code: string) { super(code); this.name = 'HevyToolError'; }
}

export async function callHevyToolWithKey(key: string, toolName: 'hevy_get_user_info' | 'hevy_list_workouts', args: Record<string, unknown> = {}, options: HevyCallOptions = {}): Promise<Record<string, any>> {
  if (!allowedTools.has(toolName)) throw new HevyToolError('unsupported_tool');
  const server = createHevyMcpServer({ apiKey: key, baseUrl: options.baseUrl || process.env.HEVY_API_BASE_URL || 'https://api.hevyapp.com/v1', fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs });
  const client = new Client({ name: 'hevy-coach-web', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const result: any = await client.callTool({ name: toolName, arguments: args });
    const text = (result.content as Array<{ type: string; text?: string }>).find((content) => content.type === 'text')?.text;
    if (!text) throw new HevyToolError('invalid_response');
    const payload = JSON.parse(text) as Record<string, any>;
    if (result.isError || payload.error) throw new HevyToolError(payload.error || 'upstream_unavailable');
    return payload;
  } catch (error) {
    if (error instanceof HevyToolError) throw error;
    throw new HevyToolError('upstream_unavailable');
  } finally {
    await client.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

export async function callUserHevyTool(userId: string, toolName: 'hevy_get_user_info' | 'hevy_list_workouts', args: Record<string, unknown> = {}, options: HevyCallOptions = {}) {
  const profile = await getProfile(userId);
  if (!profile?.hevyCredential) throw new HevyToolError('not_connected');
  const key = decrypt(profile.hevyCredential);
  return callHevyToolWithKey(key, toolName, args, options);
}
