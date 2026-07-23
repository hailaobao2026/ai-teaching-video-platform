import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { buildKnowledgeStoryboard, fillTeachingIndexHtml } from './storyboardBuilder.js';
import { enhanceTeachingAnimations } from './teachingSceneAnimator.js';
import { buildArticleStoryboard } from './articleStoryboardBuilder.js';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OUTPUT_PROFILES = new Set([
  'image_generation',
  'infographic_only',
  'teaching_video_full',
  'package_all',
  'tech_article_diagram',
  'article_explainer_video',
  'short_video_cover'
]);

const IMAGE_KEYS = {
  mulerun: 'MULERUN_API_KEY',
  apimart: 'APIMART_API_KEY',
  atlascloud: 'ATLASCLOUD_API_KEY',
  agnes: 'AGNES_API_KEY',
  volcengine: 'VOLCENGINE_API_KEY'
};

function providerRuntimeEnv(input = {}) {
  const env = input.providerRuntimeEnv || input.provider_runtime_env || input.runtimeEnv || {};
  return env && typeof env === 'object' ? env : {};
}

function withProviderEnv(input = {}, extra = {}) {
  return {
    ...extra,
    ...providerRuntimeEnv(input)
  };
}

function resolveModelField(input, config, field, configKey, envKey, fallback) {
  const snap = input?.modelSnapshot || {};
  if (input?.[field] != null && input[field] !== '') return input[field];
  if (snap?.[field] != null && snap[field] !== '') return snap[field];
  if (config?.[configKey] != null && config[configKey] !== '') return config[configKey];
  if (envKey && process.env[envKey]) return process.env[envKey];
  return fallback;
}

function resolveTtsProvider(input, config = {}) {
  return resolveModelField(input, config, 'ttsProvider', 'default_tts_provider', 'DEFAULT_TTS_PROVIDER', 'edge');
}

function resolveTtsVoice(input, config = {}) {
  const provider = resolveTtsProvider(input, config);
  if (provider === 'seed') {
    return resolveModelField(input, config, 'ttsVoice', 'default_seed_voice', 'DEFAULT_SEED_VOICE', 'zh_female_vv_uranus_bigtts');
  }
  return resolveModelField(input, config, 'ttsVoice', 'default_edge_voice', 'DEFAULT_EDGE_VOICE', 'zh-CN-XiaoxiaoNeural');
}

function resolveTtsSpeed(input, config = {}) {
  const raw = resolveModelField(input, config, 'ttsSpeed', null, 'DEFAULT_TTS_SPEED', 1);
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(2, Math.max(0.5, n));
}

function resolveVideoQuality(input, config = {}) {
  return resolveModelField(input, config, 'videoQuality', 'hyperframes_quality', 'HYPERFRAMES_QUALITY', 'standard');
}


export class PipelineCancelledError extends Error {
  constructor(message = '生成任务已取消') {
    super(message);
    this.name = 'PipelineCancelledError';
    this.code = 'PIPELINE_CANCELLED';
  }
}

function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    try { child.kill('SIGTERM'); } catch { /* process already exited */ }
  }
  const forceTimer = setTimeout(() => {
    if (child.exitCode !== null) return;
    try {
      if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch { /* process already exited */ }
  }, Number(process.env.WORKER_KILL_TIMEOUT_MS || 3000));
  forceTimer.unref?.();
}

export class CommandTimeoutError extends Error {
  constructor(message, timeoutMs) {
    super(message);
    this.name = 'CommandTimeoutError';
    this.code = 'COMMAND_TIMEOUT';
    this.timeoutMs = timeoutMs;
  }
}

function envInt(name, fallback, { min = 0 } = {}) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

/** Resolve image provider HTTP timeout/retry + hard process timeout for generate.py. */
export function resolveImageGenLimits(provider = process.env.DEFAULT_IMAGE_PROVIDER || 'volcengine') {
  const isAgnes = String(provider || '').toLowerCase() === 'agnes';
  const httpTimeoutSec = envInt(
    isAgnes ? 'AGNES_HTTP_TIMEOUT' : 'IMAGE_HTTP_TIMEOUT',
    envInt('IMAGE_HTTP_TIMEOUT', isAgnes ? 90 : 120),
    { min: 5 }
  );
  const httpRetries = envInt(
    isAgnes ? 'AGNES_HTTP_RETRIES' : 'IMAGE_HTTP_RETRIES',
    envInt('IMAGE_HTTP_RETRIES', isAgnes ? 1 : 2),
    { min: 0 }
  );
  // Hard wall-clock for the child process. Default covers request budget + download slack.
  const defaultProcessMs = (httpTimeoutSec * (httpRetries + 1) + 45) * 1000;
  const processTimeoutMs = envInt('IMAGE_GEN_TIMEOUT_MS', defaultProcessMs, { min: 5000 });
  return { provider, httpTimeoutSec, httpRetries, processTimeoutMs };
}

export function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new PipelineCancelledError());
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env || {}) },
      shell: process.platform === 'win32',
      windowsHide: true,
      detached: process.platform !== 'win32'
    });
    let stdout = '';
    let stderr = '';
    let aborted = false;
    let timedOut = false;
    let timer = null;
    const timeoutMs = Number(opts.timeoutMs || 0);
    const onAbort = () => {
      aborted = true;
      terminateProcessTree(child);
    };
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        terminateProcessTree(child);
      }, timeoutMs);
      timer.unref?.();
    }
    child.stdout.on('data', data => { stdout += data; opts.onLog?.(data.toString()); });
    child.stderr.on('data', data => { stderr += data; opts.onLog?.(data.toString()); });
    child.on('error', error => {
      if (timer) clearTimeout(timer);
      reject(aborted ? new PipelineCancelledError() : timedOut ? new CommandTimeoutError(`${cmd} timed out after ${timeoutMs}ms`, timeoutMs) : error);
    });
    child.on('close', code => {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      if (aborted || opts.signal?.aborted) return reject(new PipelineCancelledError());
      if (timedOut) {
        return reject(new CommandTimeoutError(
          `${cmd} ${args.join(' ')} timed out after ${timeoutMs}ms: ${(stderr || stdout).slice(-2000)}`,
          timeoutMs
        ));
      }
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code}): ${(stderr || stdout).slice(-4000)}`));
    });
  });
}

function pythonBin() {
  return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
}

function resolveHyperframesCommand() {
  const configured = process.env.HYPERFRAMES_BIN;
  if (configured) {
    // Allow "node /path/to/hyperframes.mjs" style via HYPERFRAMES_BIN + HYPERFRAMES_ARGS not needed;
    // if path points to a .mjs/.js file, run with node for portability.
    if (/\.(mjs|cjs|js)$/i.test(configured)) {
      return { cmd: process.execPath, argsPrefix: [configured] };
    }
    return { cmd: configured, argsPrefix: [] };
  }
  // Prefer package entry via node. Spawning .bin shim can EACCES when file mode is 644.
  const localMjs = path.resolve(__dirname, '../node_modules/hyperframes/bin/hyperframes.mjs');
  if (fs.existsSync(localMjs)) return { cmd: process.execPath, argsPrefix: [localMjs] };
  const localBin = path.resolve(__dirname, '../node_modules/.bin/hyperframes');
  if (fs.existsSync(localBin)) return { cmd: process.execPath, argsPrefix: [localBin] };
  return { cmd: 'npx', argsPrefix: ['--yes', 'hyperframes'] };
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
}

function newestFile(root, extension) {
  if (!fs.existsSync(root)) return null;
  return fs.readdirSync(root)
    .filter(name => name.toLowerCase().endsWith(extension))
    .map(name => ({ path: path.join(root, name), mtime: fs.statSync(path.join(root, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.path || null;
}

/** HyperFrames capture stays at a single "render 55%" for minutes; map frames → 55..90 for UI. */
export const RENDER_PROGRESS_START = 55;
export const RENDER_PROGRESS_CAPTURE_END = 88;
export const RENDER_PROGRESS_END = 90;

export function estimateRenderFrameTarget(workDir, { fps } = {}) {
  const resolvedFps = Number(fps || process.env.HYPERFRAMES_FPS || 30);
  const safeFps = Number.isFinite(resolvedFps) && resolvedFps > 0 ? resolvedFps : 30;

  const durationsPath = path.join(workDir, 'audio', 'durations.json');
  try {
    if (fs.existsSync(durationsPath)) {
      const data = JSON.parse(fs.readFileSync(durationsPath, 'utf8'));
      const total = Number(data.total);
      if (Number.isFinite(total) && total > 0) return Math.max(1, Math.ceil(total * safeFps));
      const segments = Array.isArray(data.segments) ? data.segments : [];
      const sum = segments.reduce((acc, seg) => acc + (Number(seg.duration) || Number(seg.audio_duration) || 0), 0);
      if (sum > 0) return Math.max(1, Math.ceil(sum * safeFps));
    }
  } catch {
    /* ignore malformed durations */
  }

  const storyboardPath = path.join(workDir, 'storyboard.json');
  try {
    if (fs.existsSync(storyboardPath)) {
      const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
      const segments = storyboard.segments || storyboard.scenes || [];
      const sum = (Array.isArray(segments) ? segments : []).reduce(
        (acc, seg) => acc + (Number(seg.duration) || Number(seg.min_duration) || 0),
        0
      );
      if (sum > 0) return Math.max(1, Math.ceil(sum * safeFps));
    }
  } catch {
    /* ignore malformed storyboard */
  }

  return Math.ceil(60 * safeFps);
}

export function countCapturedFrames(workDir) {
  const rendersDir = path.join(workDir, 'renders');
  if (!fs.existsSync(rendersDir)) return 0;
  let count = 0;
  const stack = [rendersDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/^frame_\d+\.(jpe?g|png)$/i.test(entry.name)) count += 1;
    }
  }
  return count;
}

export function mapHyperframesRenderProgress({
  frameCount = 0,
  frameTarget = 0,
  hasOutput = false,
  startedAt = Date.now(),
  now = Date.now()
} = {}) {
  if (hasOutput) return RENDER_PROGRESS_END;

  const target = Math.max(1, Number(frameTarget) || estimateRenderFrameTarget('.', { fps: 30 }));
  const frames = Math.max(0, Number(frameCount) || 0);
  const ratio = Math.min(1, frames / target);
  const elapsedMs = Math.max(0, now - startedAt);

  // No frames yet: creep 55→60 so UI is not frozen while Chrome starts.
  if (frames === 0) {
    const creep = Math.min(5, Math.floor(elapsedMs / 60_000));
    return RENDER_PROGRESS_START + creep;
  }

  // Capture maps to 55→88.
  let progress = RENDER_PROGRESS_START + ratio * (RENDER_PROGRESS_CAPTURE_END - RENDER_PROGRESS_START);

  // Near/full capture while encode still running: ease 88→89.
  if (ratio >= 0.98) {
    const encodeCreep = Math.min(1, Math.floor(elapsedMs / 90_000));
    progress = Math.max(progress, RENDER_PROGRESS_CAPTURE_END + encodeCreep);
  }

  return Math.min(
    RENDER_PROGRESS_END - 1,
    Math.max(RENDER_PROGRESS_START, Math.round(progress))
  );
}


/**
 * Map quality tier + env overrides to HyperFrames CLI flags.
 * Priority: explicit env override > quality-tier defaults > built-in fallback.
 */
export function resolveHyperframesRenderOptions({ quality, fps, workers } = {}) {
  const q = String(quality || process.env.HYPERFRAMES_QUALITY || 'standard').toLowerCase();
  const tier = ['draft', 'standard', 'high'].includes(q) ? q : 'standard';

  const tierDefaults = {
    draft: { fps: 20, workers: '6', fastCapture: true, lowMemoryMode: false },
    standard: { fps: 30, workers: '4', fastCapture: true, lowMemoryMode: false },
    high: { fps: 30, workers: 'auto', fastCapture: false, lowMemoryMode: false }
  };
  const defaults = tierDefaults[tier];

  // fps: explicit arg > HYPERFRAMES_FPS > tier default
  let resolvedFps = fps != null && fps !== '' ? Number(fps) : null;
  if (!Number.isFinite(resolvedFps) || resolvedFps <= 0) {
    const envFps = process.env.HYPERFRAMES_FPS;
    resolvedFps = envFps != null && envFps !== '' ? Number(envFps) : defaults.fps;
  }
  if (!Number.isFinite(resolvedFps) || resolvedFps <= 0) resolvedFps = defaults.fps;
  resolvedFps = Math.max(1, Math.min(240, Math.round(resolvedFps)));

  // workers: explicit > HYPERFRAMES_WORKERS > tier default (number or 'auto')
  let resolvedWorkers = workers != null && workers !== '' ? String(workers) : (process.env.HYPERFRAMES_WORKERS || defaults.workers);
  resolvedWorkers = String(resolvedWorkers || defaults.workers).trim();
  if (resolvedWorkers.toLowerCase() !== 'auto') {
    const n = Number(resolvedWorkers);
    if (!Number.isFinite(n) || n <= 0) resolvedWorkers = String(defaults.workers);
    else resolvedWorkers = String(Math.max(1, Math.min(32, Math.floor(n))));
  } else {
    resolvedWorkers = 'auto';
  }

  const parseBool = (value, fallback) => {
    if (value == null || value === '') return fallback;
    const s = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(s)) return true;
    if (['0', 'false', 'no', 'off'].includes(s)) return false;
    return fallback;
  };

  const fastCapture = parseBool(process.env.HYPERFRAMES_FAST_CAPTURE, defaults.fastCapture);
  // Explicit force flags win; else follow tier lowMemory default (usually false on our 15G hosts)
  let lowMemoryMode = defaults.lowMemoryMode;
  if (process.env.HYPERFRAMES_LOW_MEMORY_MODE != null && process.env.HYPERFRAMES_LOW_MEMORY_MODE !== '') {
    lowMemoryMode = parseBool(process.env.HYPERFRAMES_LOW_MEMORY_MODE, lowMemoryMode);
  }

  const extraArgs = [];
  const extraRaw = process.env.HYPERFRAMES_EXTRA_ARGS || '';
  if (extraRaw.trim()) {
    // simple whitespace split; supports: --browser-gpu --no-low-memory-mode
    extraArgs.push(...extraRaw.trim().split(/\s+/).filter(Boolean));
  }

  const args = [
    '--quality', tier,
    '--fps', String(resolvedFps),
    '--workers', resolvedWorkers
  ];
  if (fastCapture) args.push('--experimental-fast-capture');
  else args.push('--experimental-fast-capture=false');
  if (lowMemoryMode) args.push('--low-memory-mode');
  else args.push('--no-low-memory-mode');
  args.push(...extraArgs);

  return {
    quality: tier,
    fps: resolvedFps,
    workers: resolvedWorkers,
    fastCapture,
    lowMemoryMode,
    extraArgs,
    args
  };
}

async function runHyperframesRender({ workDir, outPath, quality, fps, workers, signal, report }) {
  report('render', RENDER_PROGRESS_START);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const hyper = resolveHyperframesCommand();
  const renderOpts = resolveHyperframesRenderOptions({ quality, fps, workers });
  const frameTarget = estimateRenderFrameTarget(workDir, { fps: renderOpts.fps });
  const pollMs = envInt('HYPERFRAMES_PROGRESS_POLL_MS', 2000, { min: 500 });
  const startedAt = Date.now();
  let lastProgress = RENDER_PROGRESS_START;
  let lastReportAt = 0;

  console.log(
    `[pipeline] hyperframes render options quality=${renderOpts.quality} fps=${renderOpts.fps} workers=${renderOpts.workers} fastCapture=${renderOpts.fastCapture} lowMemory=${renderOpts.lowMemoryMode} frameTarget=${frameTarget}`
  );

  const emit = (force = false) => {
    if (signal?.aborted) return;
    const frameCount = countCapturedFrames(workDir);
    const hasOutput = (() => {
      try {
        return fs.existsSync(outPath) && fs.statSync(outPath).size > 1024;
      } catch {
        return false;
      }
    })();
    const progress = mapHyperframesRenderProgress({
      frameCount,
      frameTarget,
      hasOutput,
      startedAt,
      now: Date.now()
    });
    const now = Date.now();
    if (!force && progress <= lastProgress) return;
    if (!force && now - lastReportAt < pollMs && progress < RENDER_PROGRESS_END - 1) return;
    lastProgress = Math.max(lastProgress, progress);
    lastReportAt = now;
    report('render', lastProgress, {
      frameCount,
      frameTarget,
      fps: renderOpts.fps,
      workers: renderOpts.workers
    });
  };

  const timer = setInterval(() => emit(false), pollMs);
  timer.unref?.();
  try {
    await runCommand(
      hyper.cmd,
      [
        ...hyper.argsPrefix,
        'render',
        ...renderOpts.args,
        '--output',
        outPath
      ],
      { cwd: workDir, signal }
    );
  } finally {
    clearInterval(timer);
  }
  report('render', RENDER_PROGRESS_END, {
    frameCount: countCapturedFrames(workDir),
    frameTarget,
    fps: renderOpts.fps,
    workers: renderOpts.workers,
    elapsedMs: Date.now() - startedAt
  });
}

function resolveImageProvider(input, config = {}) {
  const runtime = providerRuntimeEnv(input);
  const envGet = (key) => runtime[key] || process.env[key];
  const requested = input.imageProvider
    || input?.modelSnapshot?.imageProvider
    || config.default_image_provider
    || process.env.DEFAULT_IMAGE_PROVIDER;
  if (requested) {
    if (!IMAGE_KEYS[requested]) throw new Error(`不支持的图片 provider: ${requested}`);
    const envKey = IMAGE_KEYS[requested];
    const hasKey = Boolean(envGet(envKey) || (requested === 'volcengine' && envGet('ARK_API_KEY')));
    if (!hasKey) {
      throw new Error(`${envKey} 未设置，无法执行 ${input.outputProfile || '生图'} 任务（教师/学生请在个人中心配置 API Key；管理员可使用 .env）`);
    }
    return requested;
  }
  const available = Object.entries(IMAGE_KEYS).filter(([name, key]) => {
    if (envGet(key)) return true;
    if (name === 'volcengine' && envGet('ARK_API_KEY')) return true;
    return false;
  }).map(([name]) => name);
  if (available.length === 1) return available[0];
  if (!available.length) throw new Error('未配置生图 API Key，请设置 MULERUN/APIMART/ATLASCLOUD/AGNES/VOLCENGINE_API_KEY（或个人中心配置）');
  throw new Error('检测到多个生图 API Key，请设置 DEFAULT_IMAGE_PROVIDER 或在任务中指定 imageProvider');
}

export function resolveSkillRoot(configured = process.env.TEACHING_MEDIA_ROOT) {
  const candidates = [];
  if (configured) {
    candidates.push(configured);
    // F:/work/... -> /mnt/f/work/... (WSL / 本机 Linux 挂载)
    const win = String(configured).match(/^([A-Za-z]):[\\/](.*)$/);
    if (win) candidates.push(`/mnt/${win[1].toLowerCase()}/${win[2].replace(/\\/g, '/')}`);
  }
  candidates.push(path.resolve(__dirname, '../../../../wwwzhouhui/skills_collection/ai-teaching-media'));
  candidates.push('/mnt/f/work/code/github/wwwzhouhui/skills_collection/ai-teaching-media');
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error('未找到 ai-teaching-media，请设置 TEACHING_MEDIA_ROOT');
}

function copyPublicAsset(jobId, source, kind, uploadsRoot) {
  const extension = path.extname(source).toLowerCase();
  const base = `${jobId}-${kind}${extension}`;
  const target = path.join(uploadsRoot, 'artifacts', base);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return {
    type: `${kind}_${extension.slice(1)}`,
    storageKey: `artifacts/${base}`,
    localPath: target,
    mimeType: extension === '.png' ? 'image/png' : extension === '.json' ? 'application/json' : 'text/plain',
    sizeBytes: fs.statSync(target).size
  };
}

async function generateImage({ job, input, config, skillRoot, workDir, uploadsRoot, kind, prompt, aspectRatio, referenceImage, signal }) {
  const provider = resolveImageProvider(input, config);
  const limits = resolveImageGenLimits(provider);
  const outputDir = path.join(workDir, 'images', kind);
  fs.mkdirSync(outputDir, { recursive: true });
  const promptPath = path.join(outputDir, `${kind}-prompt.txt`);
  fs.writeFileSync(promptPath, prompt, 'utf8');
  const args = [
    path.join(skillRoot, 'ai-image-generator', 'scripts', 'generate.py'),
    '--provider', provider,
    '--mode', referenceImage ? 'edit' : 'generation',
    '--prompt-file', promptPath,
    '--aspect-ratio', aspectRatio,
    '--name-tag', kind,
    '--output-dir', outputDir
  ];
  if (referenceImage) args.push('--image', referenceImage);
  await runCommand(pythonBin(), args, {
    cwd: workDir,
    signal,
    timeoutMs: limits.processTimeoutMs,
    env: withProviderEnv(input, {
      AGNES_HTTP_TIMEOUT: String(limits.httpTimeoutSec),
      AGNES_HTTP_RETRIES: String(limits.httpRetries),
      IMAGE_HTTP_TIMEOUT: String(limits.httpTimeoutSec),
      IMAGE_HTTP_RETRIES: String(limits.httpRetries),
      VOLCENGINE_HTTP_TIMEOUT: String(limits.httpTimeoutSec),
      VOLCENGINE_HTTP_RETRIES: String(limits.httpRetries),
      // Allow ARK_API_KEY alias for Volcengine Seedream
      VOLCENGINE_API_KEY: process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || '',
    })
  });
  const png = newestFile(outputDir, '.png');
  if (!png) throw new Error(`${kind} 生图完成但未发现 PNG`);
  return copyPublicAsset(job.id, png, kind, uploadsRoot);
}

function knowledgePrompt(input, kind) {
  const context = `${input.grade || ''}${input.subject || ''} ${input.chapter || ''}`.trim();
  if (kind === 'infographic') {
    return `生成一张面向 K12 学生的中文竖版教育信息图。主题：${input.topic}。课程：${context}。拆解 3-5 个核心概念，包含定义、关键关系、生活例子和易错提醒。所有事实必须准确，不确定的章节号不要绘制。低饱和配色，清晰留白，9:16。${input.styleNotes || ''}`;
  }
  if (kind === 'cover') {
    return `生成一张中文短视频 3:4 封面。主标题必须准确写作“${input.topic}”，副标题“${input.chapter || 'K12 知识讲解'}”。层级强、移动端可读、教育内容气质，不使用夸张营销词。${input.styleNotes || ''}`;
  }
  return `生成一张 16:9 中文教学概念图，主题“${input.topic}”，展示核心概念、因果/步骤关系和一个例子。信息准确、结构清晰、低饱和教育图解风格。${input.styleNotes || ''}`;
}


/** Run async tasks over items with a fixed worker pool. Preserves result order. */
export async function mapPool(items, concurrency, iterator) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.min(list.length || 1, Number(concurrency) || 1));
  const results = new Array(list.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      results[index] = await iterator(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length || 1) }, () => worker()));
  return results;
}

function createMonotonicReport(report) {
  let maxProgress = 0;
  return (stage, progress, extra = {}) => {
    const next = Math.max(maxProgress, Number(progress) || 0);
    maxProgress = next;
    report?.(stage, next, extra);
  };
}

function packageImageConcurrency() {
  return envInt('PACKAGE_IMAGE_CONCURRENCY', 3, { min: 1 });
}

async function generatePackageImages({ job, input, config, skillRoot, workDir, uploadsRoot, report, signal }) {
  const specs = [
    {
      kind: 'infographic',
      aspectRatio: '9:16',
      progress: 82,
      prompt: knowledgePrompt(input, 'infographic'),
      referenceImage: undefined
    },
    {
      kind: 'cover',
      aspectRatio: '3:4',
      progress: 88,
      prompt: knowledgePrompt(input, 'cover'),
      referenceImage: input.referenceImages?.[0]
    },
    {
      kind: 'diagram',
      aspectRatio: '16:9',
      progress: 90,
      prompt: knowledgePrompt(input, 'diagram'),
      referenceImage: undefined
    }
  ];
  const concurrency = packageImageConcurrency();
  report?.('images_parallel', 70, { concurrency, count: specs.length });
  const assets = await mapPool(specs, concurrency, async (spec) => {
    if (signal?.aborted) throw new PipelineCancelledError();
    report?.(spec.kind, spec.progress, { parallel: true });
    return generateImage({
      job,
      input,
      config,
      skillRoot,
      workDir,
      uploadsRoot,
      kind: spec.kind,
      prompt: spec.prompt,
      aspectRatio: spec.aspectRatio,
      referenceImage: spec.referenceImage,
      signal
    });
  });
  const cover = assets.find(asset => String(asset?.type || '').startsWith('cover_'));
  return { assets, coverUrl: cover?.url || null };
}


async function runTeachingVideo({ job, input, config, skillRoot, workDir, uploadsRoot, report, signal }) {
  report('storyboard', 10);
  const { storyboard, quality } = await buildKnowledgeStoryboard(input, config, { strict: true });
  const storyboardPath = path.join(workDir, 'storyboard.json');
  writeJson(storyboardPath, storyboard);
  writeJson(path.join(workDir, 'storyboard-quality.json'), quality);
  if (quality?.warnings?.length) {
    console.warn(`[pipeline] ${job.id} storyboard warnings: ${quality.warnings.join('；')}`);
  }
  if (storyboard?.knowledge?.source) {
    console.log(`[pipeline] ${job.id} storyboard knowledge source=${storyboard.knowledge.source}`);
  }

  const audioDir = path.join(workDir, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  report('tts', 25);
  await runCommand(pythonBin(), [
    path.join(skillRoot, 'edu-teaching-animation', 'scripts', 'minimax_tts.py'), storyboardPath,
    '--outdir', audioDir,
    '--provider', resolveTtsProvider(input, config),
    '--voice', resolveTtsVoice(input, config),
    '--speed', String(resolveTtsSpeed(input, config)),
    '--skip-existing'
  ], {
    cwd: workDir,
    signal,
    env: withProviderEnv(input, {
      SEED_TTS_API_KEY: process.env.SEED_TTS_API_KEY || process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || '',
      VOLCENGINE_API_KEY: process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || '',
      ARK_API_KEY: process.env.ARK_API_KEY || '',
      MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || '',
      SEED_TTS_URL: process.env.SEED_TTS_URL || 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional',
      SEED_TTS_RESOURCE_ID: process.env.SEED_TTS_RESOURCE_ID || 'seed-tts-2.0',
      SEED_TTS_VOICE: process.env.SEED_TTS_VOICE || process.env.DEFAULT_SEED_VOICE || 'zh_female_vv_uranus_bigtts'
    })
  });

  report('scaffold', 45);
  await runCommand(pythonBin(), [path.join(skillRoot, 'edu-teaching-animation', 'scripts', 'scaffold_video.py'), workDir, '--force'], { cwd: workDir, signal });
  const indexPath = path.join(workDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    html = fillTeachingIndexHtml(html, storyboard, input);
    html = enhanceTeachingAnimations(html, storyboard, input);
    fs.writeFileSync(indexPath, html, 'utf8');
  }

  const rendersDir = path.join(workDir, 'renders');
  fs.mkdirSync(rendersDir, { recursive: true });
  const outPath = path.join(rendersDir, `${storyboard.topic_slug || 'lesson'}.mp4`);
  await runHyperframesRender({
    workDir,
    outPath,
    quality: resolveVideoQuality(input, config),
    fps: resolveModelField(input, config, 'videoFps', null, 'HYPERFRAMES_FPS', null),
    signal,
    report
  });
  if (!fs.existsSync(outPath)) throw new Error(`渲染完成但未找到成片: ${outPath}`);

  const videosDir = path.join(uploadsRoot, 'videos');
  fs.mkdirSync(videosDir, { recursive: true });
  const publicPath = path.join(videosDir, `${job.id}.mp4`);
  fs.copyFileSync(outPath, publicPath);
  return {
    videoStorageKey: `videos/${job.id}.mp4`,
    assets: [
      { type: 'video_mp4', storageKey: `videos/${job.id}.mp4`, localPath: publicPath, mimeType: 'video/mp4', sizeBytes: fs.statSync(publicPath).size },
      copyPublicAsset(job.id, storyboardPath, 'storyboard', uploadsRoot)
    ]
  };
}

async function runArticleVideo({ job, input, config, skillRoot, workDir, uploadsRoot, report, signal }) {
  report('article_storyboard', 10);
  const storyboardPath = path.join(workDir, 'storyboard.json');
  writeJson(storyboardPath, buildArticleStoryboard(input, config));
  report('tts', 25);
  await runCommand(pythonBin(), [
    path.join(skillRoot, 'article-explainer-video', 'scripts', 'tts_pipeline.py'), workDir,
    '--provider', resolveTtsProvider(input, config),
    '--voice', resolveTtsVoice(input, config),
    '--speed', String(resolveTtsSpeed(input, config)),
    '--skip-existing'
  ], {
    cwd: workDir,
    signal,
    env: withProviderEnv(input, {
      SEED_TTS_API_KEY: process.env.SEED_TTS_API_KEY || process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || '',
      VOLCENGINE_API_KEY: process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || '',
      ARK_API_KEY: process.env.ARK_API_KEY || '',
      MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || '',
      SEED_TTS_URL: process.env.SEED_TTS_URL || 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional',
      SEED_TTS_RESOURCE_ID: process.env.SEED_TTS_RESOURCE_ID || 'seed-tts-2.0',
      SEED_TTS_VOICE: process.env.SEED_TTS_VOICE || process.env.DEFAULT_SEED_VOICE || 'zh_female_vv_uranus_bigtts'
    })
  });
  report('scaffold', 45);
  await runCommand(pythonBin(), [path.join(skillRoot, 'article-explainer-video', 'scripts', 'scaffold.py'), workDir], { cwd: workDir, signal });
  const outPath = path.join(workDir, 'renders', 'article-explainer.mp4');
  await runHyperframesRender({
    workDir,
    outPath,
    quality: resolveVideoQuality(input, config),
    fps: resolveModelField(input, config, 'videoFps', null, 'HYPERFRAMES_FPS', null),
    signal,
    report
  });
  if (!fs.existsSync(outPath)) throw new Error(`文章视频渲染完成但未找到成片: ${outPath}`);
  const publicPath = path.join(uploadsRoot, 'videos', `${job.id}.mp4`);
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.copyFileSync(outPath, publicPath);
  return {
    videoStorageKey: `videos/${job.id}.mp4`,
    assets: [
      { type: 'video_mp4', storageKey: `videos/${job.id}.mp4`, localPath: publicPath, mimeType: 'video/mp4', sizeBytes: fs.statSync(publicPath).size },
      copyPublicAsset(job.id, storyboardPath, 'storyboard', uploadsRoot)
    ]
  };
}

async function runArticleDiagrams({ job, input, config, skillRoot, workDir, uploadsRoot, report, signal }) {
  const article = String(input.article || '').trim();
  if (!article) throw new Error('tech_article_diagram 需要 article 原文');
  const provider = resolveImageProvider(input, config);
  const chunks = article.split(/\n{2,}/).map(x => x.replace(/^#+\s*/, '').trim()).filter(x => x.length > 20);
  // Keep a small set to reduce provider queue pressure; prefer body paragraphs over title.
  const selected = (chunks.slice(1, 4).length ? chunks.slice(1, 4) : chunks.slice(0, 3)).slice(0, 3);
  const manifest = {
    mode: 'generation', aspect_ratio: '16:9', resolution: '2K',
    items: selected.map((text, index) => ({ id: `diagram-${String(index + 1).padStart(2, '0')}`, prompt: `将以下原文要点转成结构准确的中文概念图，不添加原文之外的结论：${text.slice(0, 500)}` }))
  };
  if (!manifest.items.length) throw new Error('article 原文不足以识别插图位置');
  const manifestPath = path.join(workDir, 'diagrams.json');
  writeJson(manifestPath, manifest);
  report('diagram_style', 20);
  // Default to notebook/generation-friendly style unless caller overrides. cozy-handdrawn forces edit/i2i and is more rate-limit sensitive.
  const style = input.style || process.env.DEFAULT_DIAGRAM_STYLE || 'notebook';
  await runCommand(pythonBin(), [
    path.join(skillRoot, 'tech-article-diagram', 'scripts', 'inject_style.py'),
    '--style', style, '--manifest', manifestPath
  ], { cwd: workDir, signal });
  const styledPath = path.join(workDir, 'diagrams-styled.json');
  const outputDir = path.join(workDir, 'diagrams');
  fs.mkdirSync(outputDir, { recursive: true });
  report('image_generation', 40);
  // Serial generation is more reliable against provider queue limits than --parallel.
  const limits = resolveImageGenLimits(provider);
  // Manifest may contain multiple diagrams; give each item roughly one process budget.
  const diagramCount = Math.max(1, manifest.items.length);
  const diagramTimeoutMs = Math.max(limits.processTimeoutMs, limits.processTimeoutMs * diagramCount);
  try {
    await runCommand(pythonBin(), [
      path.join(skillRoot, 'ai-image-generator', 'scripts', 'generate.py'), '--provider', provider,
      '--manifest', styledPath, '--output-dir', outputDir
    ], {
      cwd: workDir,
      signal,
      timeoutMs: diagramTimeoutMs,
      env: withProviderEnv(input, {
        AGNES_HTTP_TIMEOUT: String(limits.httpTimeoutSec),
        AGNES_HTTP_RETRIES: String(limits.httpRetries),
        IMAGE_HTTP_TIMEOUT: String(limits.httpTimeoutSec),
        IMAGE_HTTP_RETRIES: String(limits.httpRetries),
        VOLCENGINE_API_KEY: process.env.VOLCENGINE_API_KEY || process.env.ARK_API_KEY || ''
      })
    });
  } catch (error) {
    const partial = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(name => name.toLowerCase().endsWith('.png'))
      : [];
    if (!partial.length) throw error;
    // Accept partial success if at least one diagram landed.
    console.warn(`[pipeline] tech_article_diagram partial success (${partial.length} png): ${error.message}`);
  }
  const assets = fs.readdirSync(outputDir).filter(name => name.endsWith('.png')).map((name, index) =>
    copyPublicAsset(job.id, path.join(outputDir, name), `diagram-${index + 1}`, uploadsRoot));
  if (!assets.length) throw new Error('文章插图生成完成但未发现 PNG');
  return { assets };
}

export async function runTeachingMediaPipeline(job, { artifactsRoot, onProgress, signal }) {
  if (signal?.aborted) throw new PipelineCancelledError();
  const config = await db.getConfig();
  const skillRoot = resolveSkillRoot(config.teaching_media_root);
  const input = job.input_json || {};
  const profile = input.outputProfile || job.output_profile || 'teaching_video_full';
  if (!OUTPUT_PROFILES.has(profile)) throw new Error(`不支持的 outputProfile: ${profile}`);
  const workDir = path.join(artifactsRoot, job.id);
  const uploadsRoot = path.resolve(__dirname, '../uploads');
  fs.mkdirSync(workDir, { recursive: true });
  for (const sub of ['videos', 'covers', 'artifacts']) fs.mkdirSync(path.join(uploadsRoot, sub), { recursive: true });
  writeJson(path.join(workDir, 'input.json'), { ...input, outputProfile: profile });
  const report = (stage, progress, extra = {}) => onProgress?.({ stage, progress, ...extra });

  let result = { assets: [] };
  if (profile === 'package_all') {
    // Video render and package images are independent: run them in parallel, with limited image concurrency.
    const monoReport = createMonotonicReport(report);
    const localController = new AbortController();
    const abortLocal = () => {
      try { localController.abort(); } catch { /* ignore */ }
    };
    if (signal) {
      if (signal.aborted) abortLocal();
      else signal.addEventListener('abort', abortLocal, { once: true });
    }
    const linkedSignal = localController.signal;
    try {
      const videoPromise = runTeachingVideo({
        job, input, config, skillRoot, workDir, uploadsRoot, report: monoReport, signal: linkedSignal
      }).catch(error => {
        abortLocal();
        throw error;
      });
      const imagesPromise = generatePackageImages({
        job, input, config, skillRoot, workDir, uploadsRoot, report: monoReport, signal: linkedSignal
      }).catch(error => {
        abortLocal();
        throw error;
      });
      const [videoResult, imageResult] = await Promise.all([videoPromise, imagesPromise]);
      result = {
        ...videoResult,
        assets: [...(videoResult.assets || []), ...(imageResult.assets || [])],
        coverUrl: imageResult.coverUrl || videoResult.coverUrl || null
      };
    } finally {
      if (signal) signal.removeEventListener('abort', abortLocal);
    }
  } else if (profile === 'teaching_video_full') {
    result = await runTeachingVideo({ job, input, config, skillRoot, workDir, uploadsRoot, report, signal });
  } else if (profile === 'article_explainer_video') {
    result = await runArticleVideo({ job, input, config, skillRoot, workDir, uploadsRoot, report, signal });
  } else if (profile === 'tech_article_diagram') {
    result = await runArticleDiagrams({ job, input, config, skillRoot, workDir, uploadsRoot, report, signal });
  }

  if (profile === 'infographic_only') {
    report('infographic', 25);
    result.assets.push(await generateImage({ job, input, config, skillRoot, workDir, uploadsRoot, kind: 'infographic', prompt: knowledgePrompt(input, 'infographic'), aspectRatio: '9:16', signal }));
  }
  if (profile === 'short_video_cover') {
    report('cover', 25);
    const cover = await generateImage({
      job, input, config, skillRoot, workDir, uploadsRoot, kind: 'cover', prompt: knowledgePrompt(input, 'cover'), aspectRatio: '3:4',
      referenceImage: input.referenceImages?.[0], signal
    });
    result.assets.push(cover);
    result.coverUrl = cover.url;
  }
  if (profile === 'image_generation') {
    report('image_generation', 25);
    result.assets.push(await generateImage({
      job, input, config, skillRoot, workDir, uploadsRoot, kind: 'image', prompt: input.prompt || knowledgePrompt(input, 'diagram'),
      aspectRatio: input.aspectRatio || '16:9', referenceImage: input.referenceImages?.[0], signal
    }));
  }

  report('package', 96);
  const manifestPath = path.join(workDir, 'artifacts.json');
  writeJson(manifestPath, result.assets);
  result.assets.push(copyPublicAsset(job.id, manifestPath, 'artifacts', uploadsRoot));
  report('succeeded', 100, { videoUrl: result.videoUrl, coverUrl: result.coverUrl, workDir });
  return { ...result, workDir };
}

export default { OUTPUT_PROFILES, PipelineCancelledError, runCommand, runTeachingMediaPipeline, resolveSkillRoot, estimateRenderFrameTarget, countCapturedFrames, mapHyperframesRenderProgress, mapPool, resolveHyperframesRenderOptions, RENDER_PROGRESS_START, RENDER_PROGRESS_END };
