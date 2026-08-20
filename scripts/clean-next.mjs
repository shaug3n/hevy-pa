import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = await fs.realpath(process.cwd());
const target = path.join(root, '.next');
if (path.basename(target) !== '.next' || path.dirname(target) !== root) throw new Error('Refusing to clean an unexpected path.');
try {
  await fs.rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
} catch (error) {
  if (['EPERM', 'EINVAL', 'EBUSY'].includes(error?.code)) throw new Error('Could not clean .next. Stop the dev server or OneDrive file holder, then retry.');
  throw error;
}
