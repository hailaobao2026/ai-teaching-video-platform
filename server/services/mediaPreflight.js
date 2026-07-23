import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveSkillRoot } from './teachingMediaPipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function pathResolveHyperframes() {
  const candidates = [
    process.env.HYPERFRAMES_BIN,
    path.resolve(__dirname, '../node_modules/hyperframes/bin/hyperframes.mjs'),
    path.resolve(__dirname, '../node_modules/.bin/hyperframes')
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const execFileAsync = promisify(execFile);
const IMAGE_KEYS = {
  mulerun: 'MULERUN_API_KEY', apimart: 'APIMART_API_KEY',
  atlascloud: 'ATLASCLOUD_API_KEY', agnes: 'AGNES_API_KEY', volcengine: 'VOLCENGINE_API_KEY'
};
const IMAGE_PROFILES = new Set(['image_generation', 'infographic_only', 'short_video_cover', 'tech_article_diagram', 'package_all']);
const VIDEO_PROFILES = new Set(['teaching_video_full', 'article_explainer_video', 'package_all']);

async function commandCheck(command, args = ['--version'], opts = {}) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: opts.timeout ?? 8000,
      env: { ...process.env, ...(opts.env || {}) },
      maxBuffer: 2 * 1024 * 1024
    });
    const detail = String(result.stdout || result.stderr || '').trim().split('\n')[0] || `${command} ok`;
    return { ok: true, detail };
  } catch (error) {
    return { ok: false, detail: error.code === 'ENOENT' ? '未找到命令' : String(error.message || error).slice(0, 240) };
  }
}

async function pythonPackageCheck(python, packageName) {
  try {
    await execFileAsync(python, ['-c', `import ${packageName}`], {
      timeout: 8000,
      env: {
        ...process.env,
        PYTHONPATH: [
          process.env.PYTHONPATH || '',
          `${process.env.HOME || ''}/.local/lib/python3.10/site-packages`,
          `${process.env.HOME || ''}/.local/lib/python3.11/site-packages`,
          `${process.env.HOME || ''}/.local/lib/python3.12/site-packages`,
          '/usr/local/lib/python3.11/dist-packages',
          '/usr/lib/python3/dist-packages'
        ].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')
      }
    });
    return { ok: true, detail: `${packageName} 可用` };
  } catch (error) {
    return { ok: false, detail: `${packageName} 未安装` };
  }
}

function pythonBin() { return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3'); }

export async function runMediaPreflight(outputProfile = 'teaching_video_full', options = {}) {
  const checks = [];
  const add = (name, required, result) => checks.push({ name, required, ...result });
  let skillRoot = null;
  try {
    skillRoot = resolveSkillRoot(options.skillRoot || process.env.TEACHING_MEDIA_ROOT);
    add('ai-teaching-media', true, { ok: true, detail: skillRoot });
  } catch (error) {
    add('ai-teaching-media', true, { ok: false, detail: error.message });
  }
  const python = pythonBin();
  add('python', true, await commandCheck(python, ['--version']));
  if (IMAGE_PROFILES.has(outputProfile)) {
    const requested = options.imageProvider || process.env.DEFAULT_IMAGE_PROVIDER;
    const keyName = requested && IMAGE_KEYS[requested] ? IMAGE_KEYS[requested] : null;
    const hasImageKey = (name, key) => Boolean(process.env[key] || (name === 'volcengine' && process.env.ARK_API_KEY));
    const available = Object.entries(IMAGE_KEYS).filter(([name, key]) => hasImageKey(name, key)).map(([name]) => name);
    const requestedReady = keyName
      ? Boolean(process.env[keyName] || (requested === 'volcengine' && process.env.ARK_API_KEY))
      : available.length > 0;
    add('image-api-key', true, {
      ok: requestedReady,
      detail: keyName
        ? (requestedReady ? `${keyName} 已设置` : `${keyName} 未设置`)
        : (available.length ? `可用 provider: ${available.join(', ')}` : '未设置任何图片 API Key')
    });
    if (skillRoot) add('image-generator', true, { ok: fs.existsSync(`${skillRoot}/ai-image-generator/scripts/generate.py`), detail: 'generate.py' });
  }
  if (VIDEO_PROFILES.has(outputProfile)) {
    const node = await commandCheck(process.execPath, ['--version']);
    const nodeMajor = Number(String(node.detail || '').match(/v(\d+)/)?.[1] || 0);
    add('node', true, { ...node, ok: node.ok && nodeMajor >= 22, detail: node.ok && nodeMajor < 22 ? `${node.detail}，需要 Node.js >= 22` : node.detail });
    add('ffmpeg', true, await commandCheck('ffmpeg', ['-version']));
    add('ffprobe', true, await commandCheck('ffprobe', ['-version']));
    add('npx', true, await commandCheck('npx', ['--version']));
    // Prefer local package bin via node (avoids npx postinstall hangs).
    const localHyper = pathResolveHyperframes();
    let hyper;
    if (localHyper) {
      hyper = await commandCheck(process.execPath, [localHyper, '--version'], { timeout: 12000 });
      if (hyper.ok && hyper.detail === `${process.execPath} ok`) hyper.detail = 'hyperframes local';
    } else {
      hyper = await commandCheck('hyperframes', ['--version'], { timeout: 12000 });
    }
    add('hyperframes', true, hyper);
    const ttsProvider = options.ttsProvider || process.env.DEFAULT_TTS_PROVIDER || 'edge';
    if (ttsProvider === 'minimax') {
      add('minimax-api-key', true, { ok: Boolean(process.env.MINIMAX_API_KEY), detail: process.env.MINIMAX_API_KEY ? 'MINIMAX_API_KEY 已设置' : 'MINIMAX_API_KEY 未设置' });
    } else if (ttsProvider === 'seed') {
      const seedKey = process.env.SEED_TTS_API_KEY || process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY;
      const keyName = process.env.SEED_TTS_API_KEY ? 'SEED_TTS_API_KEY' : (process.env.VOLCENGINE_API_KEY ? 'VOLCENGINE_API_KEY' : (process.env.ARK_API_KEY ? 'ARK_API_KEY' : 'SEED_TTS_API_KEY'));
      add('seed-tts-api-key', true, { ok: Boolean(seedKey), detail: seedKey ? `${keyName} 已设置` : 'SEED_TTS_API_KEY / VOLCENGINE_API_KEY 未设置' });
    } else if (ttsProvider === 'say') {
      add('macos-say', true, { ok: process.platform === 'darwin', detail: process.platform === 'darwin' ? 'say available' : 'say 仅 macOS' });
    } else {
      add('edge-tts', true, await pythonPackageCheck(python, 'edge_tts'));
    }
    if (skillRoot) {
      const script = outputProfile === 'article_explainer_video' ? 'article-explainer-video/scripts/tts_pipeline.py' : 'edu-teaching-animation/scripts/minimax_tts.py';
      add('tts-script', true, { ok: fs.existsSync(`${skillRoot}/${script}`), detail: script });
    }
  }
  const missing = checks.filter(item => item.required && !item.ok);
  return { ok: missing.length === 0, outputProfile, checkedAt: new Date().toISOString(), checks, missing: missing.map(item => item.name) };
}

export function assertPreflight(result) {
  if (!result.ok) throw new Error(`媒体依赖未就绪: ${result.missing.join(', ')}`);
}

export default { runMediaPreflight, assertPreflight };
