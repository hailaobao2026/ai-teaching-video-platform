import assert from 'node:assert/strict';
import test from 'node:test';
import { runCommand, PipelineCancelledError, CommandTimeoutError, resolveImageGenLimits, estimateRenderFrameTarget, countCapturedFrames, mapHyperframesRenderProgress, mapPool, resolveHyperframesRenderOptions, RENDER_PROGRESS_START, RENDER_PROGRESS_END } from '../services/teachingMediaPipeline.js';
import { runMediaPreflight } from '../services/mediaPreflight.js';
import { resolveMediaFile, signMedia, verifyMediaSignature } from '../services/mediaAccess.js';

test('runCommand terminates a running child process when aborted', async () => {
  const controller = new AbortController();
  const started = Date.now();
  const promise = runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { signal: controller.signal });
  setTimeout(() => controller.abort(), 150).unref();
  await assert.rejects(promise, error => error instanceof PipelineCancelledError);
  assert.ok(Date.now() - started < 5000, 'child process was not terminated promptly');
});

test('media preflight returns actionable dependency status', async () => {
  const previous = process.env.AGNES_API_KEY;
  delete process.env.AGNES_API_KEY;
  try {
    const result = await runMediaPreflight('image_generation', { imageProvider: 'agnes' });
    assert.equal(result.outputProfile, 'image_generation');
    assert.ok(Array.isArray(result.checks));
    assert.ok(result.checks.some(check => check.name === 'image-api-key' && check.ok === false));
  } finally {
    if (previous === undefined) delete process.env.AGNES_API_KEY;
    else process.env.AGNES_API_KEY = previous;
  }
});

test('media signatures expire and storage paths cannot escape uploads', () => {
  const valid = signMedia('asset-1', Math.floor(Date.now() / 1000) + 30);
  assert.equal(verifyMediaSignature('asset-1', valid.expires, valid.sig), true);
  assert.equal(verifyMediaSignature('asset-2', valid.expires, valid.sig), false);
  assert.throws(() => resolveMediaFile('/tmp/uploads', '../secret.txt'), /媒体路径无效/);
  assert.equal(resolveMediaFile('/tmp/uploads', '/uploads/videos/a.mp4'), '/tmp/uploads/videos/a.mp4');
});


test('runCommand rejects with CommandTimeoutError when timeoutMs elapses', async () => {
  const started = Date.now();
  const promise = runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { timeoutMs: 200 });
  await assert.rejects(promise, error => error instanceof CommandTimeoutError && error.code === 'COMMAND_TIMEOUT');
  assert.ok(Date.now() - started < 5000, 'timeout did not fire promptly');
});

test('resolveImageGenLimits applies Agnes timeout/retry defaults and overrides', () => {
  const prev = {
    AGNES_HTTP_TIMEOUT: process.env.AGNES_HTTP_TIMEOUT,
    AGNES_HTTP_RETRIES: process.env.AGNES_HTTP_RETRIES,
    IMAGE_GEN_TIMEOUT_MS: process.env.IMAGE_GEN_TIMEOUT_MS,
    IMAGE_HTTP_TIMEOUT: process.env.IMAGE_HTTP_TIMEOUT,
    IMAGE_HTTP_RETRIES: process.env.IMAGE_HTTP_RETRIES
  };
  try {
    delete process.env.AGNES_HTTP_TIMEOUT;
    delete process.env.AGNES_HTTP_RETRIES;
    delete process.env.IMAGE_GEN_TIMEOUT_MS;
    delete process.env.IMAGE_HTTP_TIMEOUT;
    delete process.env.IMAGE_HTTP_RETRIES;
    const defaults = resolveImageGenLimits('agnes');
    assert.equal(defaults.httpTimeoutSec, 90);
    assert.equal(defaults.httpRetries, 1);
    assert.ok(defaults.processTimeoutMs >= 90_000);

    process.env.AGNES_HTTP_TIMEOUT = '30';
    process.env.AGNES_HTTP_RETRIES = '0';
    process.env.IMAGE_GEN_TIMEOUT_MS = '15000';
    const limited = resolveImageGenLimits('agnes');
    assert.equal(limited.httpTimeoutSec, 30);
    assert.equal(limited.httpRetries, 0);
    assert.equal(limited.processTimeoutMs, 15000);
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});


test('mapHyperframesRenderProgress maps capture frames from 55 toward 90', () => {
  assert.equal(mapHyperframesRenderProgress({ frameCount: 0, frameTarget: 1800, startedAt: Date.now(), now: Date.now() }), RENDER_PROGRESS_START);
  assert.equal(mapHyperframesRenderProgress({ frameCount: 0, frameTarget: 1800, startedAt: 0, now: 120_000 }), RENDER_PROGRESS_START + 2);
  const mid = mapHyperframesRenderProgress({ frameCount: 900, frameTarget: 1800, startedAt: 0, now: 1_000 });
  assert.ok(mid > RENDER_PROGRESS_START && mid < 88, `mid=${mid}`);
  const near = mapHyperframesRenderProgress({ frameCount: 1800, frameTarget: 1800, startedAt: 0, now: 1_000 });
  assert.equal(near, 88);
  const encode = mapHyperframesRenderProgress({ frameCount: 1800, frameTarget: 1800, startedAt: 0, now: 100_000 });
  assert.equal(encode, 89);
  assert.equal(mapHyperframesRenderProgress({ hasOutput: true }), RENDER_PROGRESS_END);
});

test('estimateRenderFrameTarget and countCapturedFrames read job workspace', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atv-render-progress-'));
  try {
    fs.mkdirSync(path.join(root, 'audio'), { recursive: true });
    fs.writeFileSync(path.join(root, 'audio', 'durations.json'), JSON.stringify({ total: 65.34 }), 'utf8');
    assert.equal(estimateRenderFrameTarget(root, { fps: 30 }), Math.ceil(65.34 * 30));

    const framesDir = path.join(root, 'renders', 'work-1', 'capture-attempt-0', 'worker-0');
    fs.mkdirSync(framesDir, { recursive: true });
    fs.writeFileSync(path.join(framesDir, 'frame_000001.jpg'), 'x');
    fs.writeFileSync(path.join(framesDir, 'frame_000002.jpg'), 'x');
    fs.writeFileSync(path.join(framesDir, 'note.txt'), 'ignore');
    assert.equal(countCapturedFrames(root), 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});


test('mapPool runs with bounded concurrency and preserves order', async () => {
  let active = 0;
  let maxActive = 0;
  const started = [];
  const results = await mapPool([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    started.push(value);
    await new Promise(resolve => setTimeout(resolve, 40));
    active -= 1;
    return value * 10;
  });
  assert.deepEqual(results, [10, 20, 30, 40, 50]);
  assert.equal(maxActive <= 2, true, `expected concurrency <=2, got ${maxActive}`);
  assert.deepEqual(started.slice(0, 2).sort(), [1, 2]);
});


test('resolveHyperframesRenderOptions maps quality tiers and env overrides', () => {
  const prev = {
    HYPERFRAMES_QUALITY: process.env.HYPERFRAMES_QUALITY,
    HYPERFRAMES_FPS: process.env.HYPERFRAMES_FPS,
    HYPERFRAMES_WORKERS: process.env.HYPERFRAMES_WORKERS,
    HYPERFRAMES_FAST_CAPTURE: process.env.HYPERFRAMES_FAST_CAPTURE,
    HYPERFRAMES_LOW_MEMORY_MODE: process.env.HYPERFRAMES_LOW_MEMORY_MODE,
    HYPERFRAMES_EXTRA_ARGS: process.env.HYPERFRAMES_EXTRA_ARGS
  };
  try {
    delete process.env.HYPERFRAMES_QUALITY;
    delete process.env.HYPERFRAMES_FPS;
    delete process.env.HYPERFRAMES_WORKERS;
    delete process.env.HYPERFRAMES_FAST_CAPTURE;
    delete process.env.HYPERFRAMES_LOW_MEMORY_MODE;
    delete process.env.HYPERFRAMES_EXTRA_ARGS;

    const draft = resolveHyperframesRenderOptions({ quality: 'draft' });
    assert.equal(draft.quality, 'draft');
    assert.equal(draft.fps, 20);
    assert.equal(draft.workers, '6');
    assert.equal(draft.fastCapture, true);
    assert.equal(draft.args.includes('--experimental-fast-capture'), true);
    assert.equal(draft.args.includes('--no-low-memory-mode'), true);

    const standard = resolveHyperframesRenderOptions({ quality: 'standard' });
    assert.equal(standard.fps, 30);
    assert.equal(standard.workers, '4');

    process.env.HYPERFRAMES_FPS = '20';
    process.env.HYPERFRAMES_WORKERS = '8';
    process.env.HYPERFRAMES_FAST_CAPTURE = '0';
    process.env.HYPERFRAMES_EXTRA_ARGS = '--browser-gpu';
    const overridden = resolveHyperframesRenderOptions({ quality: 'draft' });
    assert.equal(overridden.fps, 20);
    assert.equal(overridden.workers, '8');
    assert.equal(overridden.fastCapture, false);
    assert.equal(overridden.args.includes('--experimental-fast-capture=false'), true);
    assert.equal(overridden.args.includes('--browser-gpu'), true);

    const explicit = resolveHyperframesRenderOptions({ quality: 'high', fps: 25, workers: 'auto' });
    assert.equal(explicit.quality, 'high');
    assert.equal(explicit.fps, 25);
    assert.equal(explicit.workers, 'auto');
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
