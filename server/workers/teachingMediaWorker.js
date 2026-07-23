import '../loadEnv.js';
// server/workers/teachingMediaWorker.js
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initDb } from '../db.js';
import { PipelineCancelledError, runTeachingMediaPipeline } from '../services/teachingMediaPipeline.js';
import { runMediaPreflight } from '../services/mediaPreflight.js';
import { signedMediaUrl } from '../services/mediaAccess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POLL_MS = Number(process.env.WORKER_POLL_MS || 3000);
const artifactsRoot = process.env.ARTIFACTS_ROOT || path.join(__dirname, '../data/jobs');

let busy = false;
let activeController = null;
let stopping = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const job = await db.claimNextJob();
    if (!job) return;
    console.log(`[worker] claimed ${job.id} topic=${job.topic}`);
    await db.updateJob(job.id, { work_dir: path.join(artifactsRoot, job.id) });
    const controller = new AbortController();
    activeController = controller;
    const cancelPoll = setInterval(async () => {
      try {
        const current = await db.getJob(job.id);
        if (current?.status === 'cancelled') controller.abort();
      } catch (error) {
        console.error(`[worker] cancel poll ${job.id}`, error.message);
      }
    }, Number(process.env.WORKER_CANCEL_POLL_MS || 500));
    cancelPoll.unref?.();

    try {
      const jobInput = job.input_json || {};
      // Apply per-job provider credentials (teacher/student personal keys or admin env snapshot).
      const runtimeEnv = jobInput.providerRuntimeEnv || jobInput.provider_runtime_env || {};
      if (runtimeEnv && typeof runtimeEnv === 'object') {
        for (const [key, value] of Object.entries(runtimeEnv)) {
          if (value != null && String(value).trim() !== '') process.env[key] = String(value);
        }
      }
      const preflight = await runMediaPreflight(job.output_profile || job.outputProfile, {
        imageProvider: jobInput.imageProvider,
        ttsProvider: jobInput.ttsProvider || (await db.getConfig()).default_tts_provider
      });
      if (!preflight.ok) throw new Error(`媒体依赖未就绪: ${preflight.missing.join(', ')}`);
      const result = await runTeachingMediaPipeline(job, {
        artifactsRoot,
        signal: controller.signal,
        onProgress: async ({ stage, progress }) => {
          if (controller.signal.aborted) return;
          console.log(`[worker] ${job.id} ${stage} ${progress}%`);
          await db.updateJob(job.id, {
            current_stage: stage,
            progress
          });
        }
      });

      const current = await db.getJob(job.id);
      if (current?.status === 'cancelled') {
        console.log(`[worker] cancelled ${job.id}`);
        return;
      }

      const createdAssets = [];
      for (const asset of result.assets || []) {
        createdAssets.push(await db.createAsset(job.id, asset));
      }
      const videoAsset = createdAssets.find(asset => asset.asset_type === 'video_mp4');
      const coverAsset = createdAssets.find(asset => asset.asset_type?.startsWith('cover_'));
      await db.updateJob(job.id, {
        status: 'succeeded',
        progress: 100,
        current_stage: 'succeeded',
        video_url: videoAsset ? signedMediaUrl(videoAsset.id) : null,
        cover_url: coverAsset ? signedMediaUrl(coverAsset.id) : null,
        work_dir: result.workDir,
        finished_at: new Date()
      });

      const latest = await db.getJob(job.id);
      const input = latest.input_json || {};
      if (input.autoCreateCourse !== false) {
        const author = await db.findUserById(latest.user_id);
        await db.createCourseFromJob(latest, {
          authorName: author?.nickname || '用户'
        });
      }
      console.log(`[worker] success ${job.id} -> ${videoAsset ? signedMediaUrl(videoAsset.id) : 'no-video'}`);
    } catch (err) {
      const current = await db.getJob(job.id);
      if (err instanceof PipelineCancelledError || controller.signal.aborted || current?.status === 'cancelled' || stopping) {
        if (current?.status !== 'cancelled') await db.cancelJob(job.id);
        await db.updateJob(job.id, { status: 'cancelled', current_stage: 'cancelled', finished_at: new Date() });
        console.log(`[worker] cancelled ${job.id}`);
        return;
      }
      console.error(`[worker] fail ${job.id}`, err);
      await db.updateJob(job.id, {
        status: 'failed',
        current_stage: 'failed',
        error_message: String(err.message || err),
        finished_at: new Date()
      });
    } finally {
      clearInterval(cancelPoll);
      activeController = null;
    }
  } finally {
    busy = false;
  }
}

function stop(signal) {
  stopping = true;
  activeController?.abort();
  if (signal) signal.dispose?.();
}

process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());

await initDb();
console.log('[worker] teachingMediaWorker started');
console.log(`[worker] artifactsRoot=${artifactsRoot}`);
setInterval(() => {
  tick().catch(err => console.error('[worker] tick error', err));
}, POLL_MS);
tick().catch(err => console.error('[worker] first tick error', err));
