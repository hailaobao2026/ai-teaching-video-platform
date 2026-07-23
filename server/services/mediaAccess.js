import crypto from 'crypto';
import path from 'path';

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function secret() {
  return process.env.MEDIA_SIGNING_SECRET || process.env.SESSION_SECRET || 'atv-development-media-secret';
}

export function normalizeStorageKey(value) {
  const raw = String(value || '').replace(/^\/+(uploads\/)?/, '');
  const normalized = path.posix.normalize(raw.replaceAll('\\', '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error('媒体路径无效');
  }
  return normalized;
}

export function resolveMediaFile(uploadsDir, storagePath) {
  const key = normalizeStorageKey(storagePath);
  const root = path.resolve(uploadsDir);
  const file = path.resolve(root, key);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error('媒体路径越界');
  return file;
}

export function signMedia(assetId, expiresAt = Math.floor(Date.now() / 1000) + DEFAULT_TTL_SECONDS) {
  const expires = Number(expiresAt);
  const payload = `${assetId}.${expires}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return { expires, sig };
}

export function signedMediaUrl(assetId, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const { expires, sig } = signMedia(assetId, Math.floor(Date.now() / 1000) + ttlSeconds);
  return `/media/${encodeURIComponent(assetId)}?expires=${expires}&sig=${encodeURIComponent(sig)}`;
}

export function verifyMediaSignature(assetId, expiresAt, signature) {
  const expires = Number(expiresAt);
  if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signMedia(assetId, expires).sig;
  const actual = String(signature || '');
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export default { normalizeStorageKey, resolveMediaFile, signMedia, signedMediaUrl, verifyMediaSignature };
