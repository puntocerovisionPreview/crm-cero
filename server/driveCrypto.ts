import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(): Buffer {
  const value = Buffer.from(process.env.GOOGLE_OAUTH_ENCRYPTION_KEY || '', 'base64');
  if (value.length !== 32) throw new Error('Falta configurar GOOGLE_OAUTH_ENCRYPTION_KEY (32 bytes en base64).');
  return value;
}
export function encryptDriveSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from('cero-drive-v1'));
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(v => v.toString('base64url')).join('.');
}
export function decryptDriveSecret(value: string): string {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Credencial de Drive inválida. Volvé a conectar.');
  const [iv, tag, body] = parts.map(v => Buffer.from(v, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from('cero-drive-v1'));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}
