import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const encryptionKey = () => {
  const configured = process.env.HEVY_ENCRYPTION_KEY;
  if (!configured) throw new Error('HEVY_ENCRYPTION_KEY must be configured');
  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new Error('HEVY_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
};
export function encrypt(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${ciphertext.toString('base64')}`;
}
export function decrypt(value: string) {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Malformed encrypted credential');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}
