import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

let cachedSecret = null;

function devSecretFile() {
  return process.env.MEDIA_SECRET_FILE || path.join(__dirname, '../data/.media-secret');
}

// API 与 worker 是两个进程，必须拿到同一个密钥，否则 worker 签发的 URL 在 API 侧验不过。
// 未配置环境变量时落到同一个文件上，wx 让并发首启只有一个进程写成功、其余读回。
function loadDevSecret() {
  const file = devSecretFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    const generated = crypto.randomBytes(32).toString('base64url');
    fs.writeFileSync(file, generated, { flag: 'wx', mode: 0o600 });
    console.warn(`[media] MEDIA_SIGNING_SECRET 未配置，已生成开发密钥 ${file}（生产环境必须显式设置）`);
    return generated;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // 另一进程可能刚 create 还没写完；空密钥做 HMAC 会静默产生弱签名，必须拒绝。
    for (let i = 0; i < 50; i++) {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (existing) return existing;
      const until = Date.now() + 5;
      while (Date.now() < until);
    }
    throw new Error(`开发密钥文件 ${file} 为空，请删除该文件后重启`);
  }
}

function secret() {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.MEDIA_SIGNING_SECRET || process.env.SESSION_SECRET;
  if (configured) return (cachedSecret = configured);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MEDIA_SIGNING_SECRET 未配置，生产环境拒绝启动');
  }
  cachedSecret = loadDevSecret();
  return cachedSecret;
}

export function assertMediaSigningSecret() {
  secret();
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

export default { assertMediaSigningSecret, normalizeStorageKey, resolveMediaFile, signMedia, signedMediaUrl, verifyMediaSignature };
