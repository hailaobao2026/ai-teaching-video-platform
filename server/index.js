// server/index.js
import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db, { hashPassword, initDb, needsPasswordRehash, verifyPassword } from './db.js';
import { OUTPUT_PROFILES } from './services/teachingMediaPipeline.js';
import { runMediaPreflight } from './services/mediaPreflight.js';
import { resolveMediaFile, signedMediaUrl, verifyMediaSignature } from './services/mediaAccess.js';
import { publicUser as toPublicUser, validateRegisterPayload, validateTeacherSubjects, isAdmin, isTeacher, ROLES, canTeacherReviewCourse, normalizeRole, parseTeacherSubjects } from './services/rbac.js';
import {
  buildModelCatalog,
  emptyUserModelSettings,
  normalizeUserModelSettings,
  resolveEffectiveModelConfig,
  toDbModelSettings,
  validateUserModelSettings,
  publicProviderCredentials,
  mergeProviderCredentials,
  resolveRuntimeCredentialsForJob,
  providerCredentialReady,
  PAID_TTS_PROVIDERS,
  PAID_IMAGE_PROVIDERS,
  VIDEO_QUALITIES,
  TTS_PROVIDERS,
  IMAGE_PROVIDERS,
  VIDEO_PROVIDERS
} from './services/modelSettings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3002);

const uploadsDir = path.join(__dirname, 'uploads');
for (const sub of ['videos', 'covers', 'artifacts']) {
  fs.mkdirSync(path.join(uploadsDir, sub), { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));

function auth(required = true) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      const user = await db.getSessionUser(token);
      if (!user && required) return res.status(401).json({ error: '未登录' });
      if (user && user.status && user.status !== 'active') {
        return res.status(401).json({ error: '账号已禁用' });
      }
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireRole(...roles) {
  const allowed = new Set(roles.map((role) => normalizeRole(role)));
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: '未登录' });
    if (!allowed.has(normalizeRole(req.user.role))) {
      return res.status(403).json({ error: '需要管理员' });
    }
    next();
  };
}

function publicUser(u) {
  return toPublicUser(u);
}

async function loadModelSettingsPayload(user, taskInput = {}) {
  const systemConfig = await db.getConfig();
  const raw = await db.getUserModelSettings(user.id);
  const settings = normalizeUserModelSettings(raw || emptyUserModelSettings());
  const catalog = buildModelCatalog(user, systemConfig, settings);
  const resolved = resolveRuntimeCredentialsForJob({
    user,
    userSettings: settings,
    systemConfig,
    taskInput
  });
  return {
    settings: {
      ...settings,
      providerCredentials: publicProviderCredentials(settings.providerCredentials)
    },
    privateSettings: settings,
    catalog,
    systemConfig,
    systemDefaults: resolved.systemDefaults,
    effective: resolved.effective,
    modelSnapshot: {
      ...resolved.modelSnapshot,
      credentials: resolved.credentialSnapshot
    },
    credentialSnapshot: resolved.credentialSnapshot,
    runtimeEnv: resolved.runtimeEnv
  };
}

function pickTaskModelOverrides(body = {}) {
  const out = {};
  for (const key of ['ttsProvider', 'ttsVoice', 'ttsSpeed', 'imageProvider', 'imageStyle', 'aspectRatio', 'imageAspectRatio', 'videoProvider', 'videoQuality', 'videoFps', 'style']) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') out[key] = body[key];
  }
  return out;
}


function refreshMediaUrl(value) {
  const match = String(value || '').match(/^\/media\/([^?]+)/);
  return match ? signedMediaUrl(decodeURIComponent(match[1])) : value;
}

function presentMediaFields(value) {
  if (Array.isArray(value)) return value.map(presentMediaFields);
  if (!value || typeof value !== 'object') return value;
  return {
    ...value,
    videoUrl: refreshMediaUrl(value.videoUrl),
    coverUrl: refreshMediaUrl(value.coverUrl)
  };
}

function presentAsset(asset) {
  const { path: _storagePath, ...safe } = asset;
  const contentUrl = signedMediaUrl(asset.id);
  return { ...safe, url: contentUrl, contentUrl };
}

async function canReadAsset(asset, user) {
  if (asset.course_id) {
    const course = await db.getCourse(asset.course_id);
    const isPublic = course?.visibility === 'public' && course?.publishStatus === 'approved';
    return Boolean(isPublic || (user && (user.role === 'admin' || course?.user_id === user.id)));
  }
  const job = await db.getJob(asset.job_id);
  return Boolean(user && (user.role === 'admin' || job?.user_id === user.id));
}

function sendAssetFile(res, asset) {
  try {
    const file = resolveMediaFile(uploadsDir, asset.path);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).json({ error: '媒体文件不存在' });
    res.type(asset.mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(file, error => {
      if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ error: '媒体文件读取失败' });
    });
    return res;
  } catch {
    return res.status(404).json({ error: '媒体文件不存在' });
  }
}

app.get('/media/:id', async (req, res, next) => {
  try {
    if (!verifyMediaSignature(req.params.id, req.query.expires, req.query.sig)) return res.status(403).json({ error: '媒体链接无效或已过期' });
    const asset = await db.getAsset(req.params.id);
    if (!asset) return res.status(404).json({ error: '资产不存在' });
    return sendAssetFile(res, asset);
  } catch (error) { next(error); }
});

app.get('/health', async (_req, res) => {
  const config = await db.getConfig();
  res.json({
    status: 'ok',
    service: 'ai-teaching-video-platform',
    time: new Date().toISOString(),
    config: {
      defaultTtsProvider: config.default_tts_provider || process.env.DEFAULT_TTS_PROVIDER || 'edge',
      defaultImageProvider: config.default_image_provider || process.env.DEFAULT_IMAGE_PROVIDER || 'volcengine'
    }
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const checked = validateRegisterPayload(req.body || {});
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    const { email, password, nickname, role, grade, teacherSubjects } = checked.value;
    const user = await db.createUser({ email, password, nickname, role, teacherSubjects, grade });
    const token = await db.createSession(user.id);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await db.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    if (user.status && user.status !== 'active') {
      return res.status(401).json({ error: '账号已禁用' });
    }
    if (needsPasswordRehash(user.password_hash)) {
      await db.updateUserPasswordHash(user.id, hashPassword(password));
    }
    const token = await db.createSession(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auth/me', auth(true), async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch('/api/me/profile', auth(true), async (req, res) => {
  try {
    const body = req.body || {};
    if (body.teacherSubjects != null || body.teacher_subjects != null) {
      const role = req.user.role;
      if (role !== ROLES.TEACHER && role !== ROLES.ADMIN && role !== 'teacher' && role !== 'admin') {
        return res.status(403).json({ error: '仅教师可维护授课学科' });
      }
      if (role === ROLES.TEACHER || role === 'teacher') {
        const checked = validateTeacherSubjects(body.teacherSubjects ?? body.teacher_subjects, { required: true });
        if (!checked.ok) return res.status(400).json({ error: checked.error });
      } else {
        const checked = validateTeacherSubjects(body.teacherSubjects ?? body.teacher_subjects, { required: false });
        if (!checked.ok) return res.status(400).json({ error: checked.error });
      }
    }
    const updated = await db.updateUserProfile(req.user.id, {
      nickname: body.nickname,
      teacherSubjects: body.teacherSubjects ?? body.teacher_subjects,
      grade: body.grade ?? body.grade_code
    });
    res.json({ user: publicUser(updated) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/models/catalog', auth(true), async (req, res, next) => {
  try {
    const systemConfig = await db.getConfig();
    const raw = await db.getUserModelSettings(req.user.id);
    const settings = normalizeUserModelSettings(raw || emptyUserModelSettings());
    res.json(buildModelCatalog(req.user, systemConfig, settings));
  } catch (error) {
    next(error);
  }
});

app.get('/api/me/model-settings', auth(true), async (req, res, next) => {
  try {
    const payload = await loadModelSettingsPayload(req.user);
    res.json({
      settings: payload.settings,
      effective: payload.effective,
      systemDefaults: payload.systemDefaults,
      modelSnapshot: payload.modelSnapshot
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/me/model-settings', auth(true), async (req, res, next) => {
  try {
    const systemConfig = await db.getConfig();
    const existingRaw = await db.getUserModelSettings(req.user.id);
    const existing = normalizeUserModelSettings(existingRaw || emptyUserModelSettings());
    const body = req.body || {};
    const mergedCredentials = mergeProviderCredentials(
      existing.providerCredentials,
      body.providerCredentials || body.provider_credentials || {}
    );
    const draft = normalizeUserModelSettings({
      ...existing,
      ...body,
      providerCredentials: mergedCredentials
    });
    // Validate against catalog computed with draft credentials so newly entered keys unlock ready state.
    const catalog = buildModelCatalog(req.user, systemConfig, draft);
    const checked = validateUserModelSettings(draft, catalog);
    if (!checked.ok) return res.status(400).json({ error: checked.error });
    const toStore = {
      ...checked.value,
      providerCredentials: mergedCredentials
    };
    await db.upsertUserModelSettings(req.user.id, toDbModelSettings(toStore));
    const payload = await loadModelSettingsPayload(req.user);
    res.json({
      settings: payload.settings,
      effective: payload.effective,
      systemDefaults: payload.systemDefaults,
      modelSnapshot: payload.modelSnapshot
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/me/model-settings/reset', auth(true), async (req, res, next) => {
  try {
    await db.resetUserModelSettings(req.user.id);
    const payload = await loadModelSettingsPayload(req.user);
    res.json({
      settings: payload.settings,
      effective: payload.effective,
      systemDefaults: payload.systemDefaults,
      modelSnapshot: payload.modelSnapshot
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', auth(false), async (req, res) => {
  const header = req.headers.authorization || '';
  await db.deleteSession(header.startsWith('Bearer ') ? header.slice(7) : '');
  res.json({ ok: true });
});

app.get('/api/catalog/subjects', async (req, res) => {
  try {
    const includeDisabled = String(req.query.includeDisabled || '') === '1' && req.user?.role === 'admin';
    // public catalog only enabled; admin can pass includeDisabled=1 with auth when needed via admin API
    const rows = await db.listSubjects({ includeDisabled: false });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message || '加载学科失败' });
  }
});

app.get('/api/catalog/grades', (_req, res) => {
  res.json([
    { code: 'grade1', name: '一年级' },
    { code: 'grade2', name: '二年级' },
    { code: 'grade3', name: '三年级' },
    { code: 'grade4', name: '四年级' },
    { code: 'grade5', name: '五年级' },
    { code: 'grade6', name: '六年级' },
    { code: 'grade7', name: '初一' },
    { code: 'grade8', name: '初二' },
    { code: 'grade9', name: '初三' },
    { code: 'grade10', name: '高一' },
    { code: 'grade11', name: '高二' },
    { code: 'grade12', name: '高三' }
  ]);
});

app.get('/api/catalog/categories', async (req, res) => {
  try {
    const subject = req.query.subject ? String(req.query.subject) : null;
    const grade = req.query.grade ? String(req.query.grade) : null;
    const q = req.query.q ? String(req.query.q) : null;
    const chapters = await db.listKnowledgeChapters({ subject, grade, q, includeDisabled: false });
    res.json(chapters.map((c) => ({
      subject,
      grade,
      chapter: c.chapter,
      count: c.count,
      topics: c.topics
    })));
  } catch (error) {
    res.status(500).json({ error: error.message || '加载章节失败' });
  }
});

app.get('/api/catalog/knowledge-points', async (req, res) => {
  try {
    const rows = await db.listKnowledgePoints({
      subject: req.query.subject ? String(req.query.subject) : null,
      grade: req.query.grade ? String(req.query.grade) : null,
      chapter: req.query.chapter ? String(req.query.chapter) : null,
      q: req.query.q ? String(req.query.q) : null,
      includeDisabled: false,
      limit: req.query.limit || 200
    });
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message || '加载知识点失败' });
  }
});

app.get('/api/catalog/knowledge-points/:id', async (req, res) => {
  try {
    const row = await db.getKnowledgePoint(req.params.id);
    if (!row || row.enabled === false) return res.status(404).json({ error: '知识点不存在' });
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: error.message || '加载知识点失败' });
  }
});

app.get('/api/system/preflight', auth(true), async (req, res) => {
  const outputProfile = String(req.query.outputProfile || 'teaching_video_full');
  if (!OUTPUT_PROFILES.has(outputProfile)) return res.status(400).json({ error: 'outputProfile 无效' });
  const config = await db.getConfig();
  const resolved = resolveEffectiveModelConfig({
    userSettings: await db.getUserModelSettings(req.user.id),
    systemConfig: config,
    taskInput: pickTaskModelOverrides(req.query)
  });
  res.json(await runMediaPreflight(outputProfile, {
    skillRoot: config.teaching_media_root,
    imageProvider: resolved.effective.imageProvider,
    ttsProvider: resolved.effective.ttsProvider
  }));
});

app.post('/api/jobs/preflight', auth(true), async (req, res) => {
  const outputProfile = String(req.body?.outputProfile || 'teaching_video_full');
  if (!OUTPUT_PROFILES.has(outputProfile)) return res.status(400).json({ error: 'outputProfile 无效' });
  const config = await db.getConfig();
  const resolved = resolveEffectiveModelConfig({
    userSettings: await db.getUserModelSettings(req.user.id),
    systemConfig: config,
    taskInput: pickTaskModelOverrides(req.body || {})
  });
  res.json(await runMediaPreflight(outputProfile, {
    skillRoot: config.teaching_media_root,
    imageProvider: resolved.effective.imageProvider,
    ttsProvider: resolved.effective.ttsProvider
  }));
});

app.post('/api/jobs', auth(true), async (req, res) => {
  try {
    const body = req.body || {};
    const outputProfile = body.outputProfile || 'teaching_video_full';
    if (!OUTPUT_PROFILES.has(outputProfile)) {
      return res.status(400).json({ error: `不支持的 outputProfile: ${outputProfile}` });
    }
    const hasContent = body.topic || body.prompt || body.article;
    if (!hasContent || (!body.subject && !['article_explainer_video', 'tech_article_diagram', 'image_generation'].includes(outputProfile)) || (!body.grade && !['article_explainer_video', 'tech_article_diagram', 'image_generation'].includes(outputProfile))) {
      return res.status(400).json({ error: '请提供 topic/prompt/article 之一，并补充 subject/grade' });
    }
    if (['tech_article_diagram', 'article_explainer_video'].includes(outputProfile) && !String(body.article || '').trim()) {
      return res.status(400).json({ error: `${outputProfile} 需要 article 原文` });
    }
    if (String(body.topic).length > 200 || String(body.article || '').length > 100000) {
      return res.status(400).json({ error: '输入内容过长' });
    }
    if (body.learningGoals !== undefined && !Array.isArray(body.learningGoals)) {
      return res.status(400).json({ error: 'learningGoals 必须是数组' });
    }
    const styles = new Set(['cozy-handdrawn', 'notebook', 'infographic', 'executive-tech', 'tech-doodle', 'cartoon-infographic', 'whiteboard-sketch']);
    if (body.style && !styles.has(body.style)) return res.status(400).json({ error: 'style 无效' });
    const providers = new Set(IMAGE_PROVIDERS);
    if (body.imageProvider && !providers.has(body.imageProvider)) return res.status(400).json({ error: 'imageProvider 无效' });
    if (body.ttsProvider && !TTS_PROVIDERS.includes(body.ttsProvider)) return res.status(400).json({ error: 'ttsProvider 无效' });
    if (body.videoProvider && !VIDEO_PROVIDERS.includes(body.videoProvider)) return res.status(400).json({ error: 'videoProvider 无效' });
    if (body.videoQuality && !VIDEO_QUALITIES.includes(body.videoQuality)) return res.status(400).json({ error: 'videoQuality 无效' });
    const aspectRatios = new Set(['1:1', '4:3', '3:4', '3:2', '2:3', '16:9', '9:16']);
    if (body.aspectRatio && !aspectRatios.has(body.aspectRatio)) return res.status(400).json({ error: 'aspectRatio 无效' });
    if (String(body.styleNotes || '').length > 2000 || String(body.prompt || '').length > 20000) {
      return res.status(400).json({ error: '提示内容过长' });
    }
    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages.slice(0, 4) : [];
    if (referenceImages.some(value => typeof value !== 'string' || !(/^(https?:\/\/|data:image\/)/i.test(value)))) {
      return res.status(400).json({ error: 'referenceImages 只允许 HTTP(S) URL 或 data:image' });
    }

    const taskOverrides = pickTaskModelOverrides(body);
    const modelPayload = await loadModelSettingsPayload(req.user, taskOverrides);
    const catalog = modelPayload.catalog;
    // Validate task-level providers against ready catalog when provided
    if (taskOverrides.ttsProvider) {
      const item = (catalog.tts || []).find(x => x.provider === taskOverrides.ttsProvider);
      if (!item) return res.status(400).json({ error: 'ttsProvider 未对当前用户开放' });
      if (!item.ready) return res.status(400).json({ error: item.reason || 'ttsProvider 未开通' });
    }
    if (taskOverrides.imageProvider) {
      const item = (catalog.image || []).find(x => x.provider === taskOverrides.imageProvider);
      if (!item) return res.status(400).json({ error: 'imageProvider 未对当前用户开放' });
      if (!item.ready) return res.status(400).json({ error: item.reason || 'imageProvider 未开通' });
    }
    if (taskOverrides.videoProvider) {
      const item = (catalog.video || []).find(x => x.provider === taskOverrides.videoProvider);
      if (!item) return res.status(400).json({ error: 'videoProvider 未对当前用户开放' });
    }

    const effective = modelPayload.effective;
    // Enforce paid provider credentials for non-admin users at job creation time.
    const role = normalizeRole(req.user.role);
    if (role !== ROLES.ADMIN) {
      if (PAID_TTS_PROVIDERS.has(effective.ttsProvider)) {
        const status = providerCredentialReady(effective.ttsProvider, {
          userSettings: modelPayload.privateSettings,
          role
        });
        if (!status.ready) {
          return res.status(400).json({ error: status.reason || `请先在个人中心配置 ${effective.ttsProvider} API Key` });
        }
      }
      if (PAID_IMAGE_PROVIDERS.has(effective.imageProvider)) {
        const status = providerCredentialReady(effective.imageProvider, {
          userSettings: modelPayload.privateSettings,
          role
        });
        if (!status.ready) {
          return res.status(400).json({ error: status.reason || `请先在个人中心配置 ${effective.imageProvider} API Key` });
        }
      }
    } else {
      // Admin may use env; still fail early if neither personal nor env key exists for paid providers.
      if (PAID_TTS_PROVIDERS.has(effective.ttsProvider)) {
        const status = providerCredentialReady(effective.ttsProvider, {
          userSettings: modelPayload.privateSettings,
          role
        });
        if (!status.ready) {
          return res.status(400).json({ error: status.reason || `管理员未配置 ${effective.ttsProvider}（.env 或个人设置）` });
        }
      }
      if (PAID_IMAGE_PROVIDERS.has(effective.imageProvider)) {
        const status = providerCredentialReady(effective.imageProvider, {
          userSettings: modelPayload.privateSettings,
          role
        });
        if (!status.ready) {
          return res.status(400).json({ error: status.reason || `管理员未配置 ${effective.imageProvider}（.env 或个人设置）` });
        }
      }
    }

    const job = await db.createJob(req.user.id, {
      subject: body.subject || 'general',
      grade: body.grade || 'general',
      chapter: body.chapter || '未命名章节',
      topic: body.topic || (body.prompt || body.article || '教学主题').slice(0, 200),
      learningGoals: (body.learningGoals || []).map(value => String(value).slice(0, 200)).slice(0, 20),
      styleNotes: body.styleNotes || '',
      outputProfile,
      article: body.article || '',
      prompt: body.prompt || '',
      style: body.style || effective.imageStyle || 'cozy-handdrawn',
      theme: body.theme || 'warm',
      imageProvider: effective.imageProvider || '',
      aspectRatio: body.aspectRatio || effective.imageAspectRatio || '16:9',
      ttsProvider: effective.ttsProvider || '',
      ttsVoice: effective.ttsVoice || '',
      ttsSpeed: effective.ttsSpeed,
      videoProvider: effective.videoProvider || 'hyperframes',
      videoQuality: effective.videoQuality || 'standard',
      videoFps: effective.videoFps,
      modelSnapshot: modelPayload.modelSnapshot,
      providerRuntimeEnv: modelPayload.runtimeEnv || {},
      credentialSnapshot: modelPayload.credentialSnapshot || null,
      referenceImages,
      autoCreateCourse: body.autoCreateCourse !== false
    });
    res.json({ jobId: job.id, status: job.status, modelSnapshot: modelPayload.modelSnapshot });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/jobs', auth(true), async (req, res) => {
  const allowedStatuses = new Set(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
  if (req.query.status && !allowedStatuses.has(req.query.status)) {
    return res.status(400).json({ error: 'status 无效' });
  }
  const list = await db.listJobs(req.user.id, normalizeRole(req.user.role) === ROLES.ADMIN, {
    status: req.query.status || null,
    page: req.query.page,
    limit: req.query.limit
  });
  res.json(presentMediaFields(list));
});

app.get('/api/jobs/:id', auth(true), async (req, res) => {
  const job = await db.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  if (normalizeRole(req.user.role) !== ROLES.ADMIN && job.user_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  res.json(presentMediaFields(job));
});

app.post('/api/jobs/:id/retry', auth(true), async (req, res) => {
  const job = await db.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  if (normalizeRole(req.user.role) !== ROLES.ADMIN && job.user_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  if (!['failed', 'cancelled'].includes(job.status)) {
    return res.status(409).json({ error: '只有失败或已取消任务可以重试' });
  }
  const updated = await db.updateJob(job.id, {
    status: 'queued',
    progress: 0,
    current_stage: 'queued',
    error_message: null,
    finished_at: null
  });
  res.json(presentMediaFields(updated));
});

app.post('/api/jobs/:id/cancel', auth(true), async (req, res) => {
  const job = await db.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  if (normalizeRole(req.user.role) !== ROLES.ADMIN && job.user_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  res.json(await db.cancelJob(job.id));
});

app.get('/api/jobs/:id/assets', auth(true), async (req, res) => {
  const job = await db.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: '任务不存在' });
  if (normalizeRole(req.user.role) !== ROLES.ADMIN && job.user_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  res.json((await db.listAssets({ jobId: job.id })).map(presentAsset));
});

app.get('/api/courses', async (req, res) => {
  const list = await db.listCourses({ publicOnly: true, subject: req.query.subject, grade: req.query.grade, query: req.query.q });
  res.json(presentMediaFields(list));
});

app.get('/api/me/courses', auth(true), async (req, res) => {
  const list = await db.listCourses({ userId: req.user.id });
  const withReviews = [];
  for (const course of list) {
    const latest = await db.getLatestReviewForCourse(course.id);
    withReviews.push({
      ...course,
      latestReview: latest ? {
        action: latest.action,
        comment: latest.comment || '',
        reviewerRole: latest.reviewer_role || latest.reviewerRole || null,
        reviewerName: latest.reviewerName || null,
        createdAt: latest.created_at || latest.createdAt
      } : null
    });
  }
  res.json(presentMediaFields(withReviews));
});

app.get('/api/courses/:id/reviews', auth(true), async (req, res) => {
  const course = await db.getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: '课程不存在' });
  const isOwner = course.user_id === req.user.id;
  const admin = normalizeRole(req.user.role) === ROLES.ADMIN;
  if (!isOwner && !admin) return res.status(403).json({ error: '无权限' });
  const list = await db.listReviewsForCourse(course.id);
  res.json(list);
});


app.get('/api/courses/:id', auth(false), async (req, res) => {
  const course = await db.getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: '课程不存在' });
  const isPublic = course.visibility === 'public' && course.publishStatus === 'approved';
  if (!isPublic && (!req.user || (normalizeRole(req.user.role) !== ROLES.ADMIN && course.user_id !== req.user.id))) {
    return res.status(404).json({ error: '课程不存在' });
  }
  res.json(presentMediaFields(course));
});

app.get('/api/courses/:id/assets', auth(false), async (req, res) => {
  const course = await db.getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: '课程不存在' });
  const isPublic = course.visibility === 'public' && course.publishStatus === 'approved';
  if (!isPublic && (!req.user || (normalizeRole(req.user.role) !== ROLES.ADMIN && course.user_id !== req.user.id))) {
    return res.status(404).json({ error: '课程不存在' });
  }
  res.json((await db.listAssets({ courseId: course.id })).map(presentAsset));
});

app.get('/api/assets/:id', auth(false), async (req, res) => {
  const asset = await db.getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: '资产不存在' });
  if (!await canReadAsset(asset, req.user)) return res.status(404).json({ error: '资产不存在' });
  res.json(presentAsset(asset));
});

app.get('/api/assets/:id/content', auth(false), async (req, res) => {
  const asset = await db.getAsset(req.params.id);
  if (!asset || !await canReadAsset(asset, req.user)) return res.status(404).json({ error: '资产不存在' });
  return sendAssetFile(res, asset);
});

app.patch('/api/courses/:id', auth(true), async (req, res) => {
  const course = await db.getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: '课程不存在' });
  if (course.user_id !== req.user.id && normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '无权限' });
  const patch = {};
  for (const key of ['title', 'summary', 'chapter']) {
    if (typeof req.body?.[key] === 'string') patch[key] = req.body[key].slice(0, key === 'summary' ? 2000 : 256);
  }
  res.json(await db.updateCourse(course.id, patch));
});

app.post('/api/courses/:id/submit', auth(true), async (req, res) => {
  const course = await db.getCourse(req.params.id);
  if (!course) return res.status(404).json({ error: '课程不存在' });
  if (course.user_id !== req.user.id && normalizeRole(req.user.role) !== ROLES.ADMIN) {
    return res.status(403).json({ error: '无权限' });
  }
  const authorRole = normalizeRole(req.user.role);
  const updated = await db.updateCourse(course.id, {
    publish_status: 'pending',
    author_role_snapshot: authorRole
  });
  const hasTeacher = authorRole === ROLES.STUDENT
    ? await db.hasActiveTeacherForSubject(course.subject)
    : false;
  res.json({
    ...presentMediaFields(updated),
    reviewRouting: (authorRole === ROLES.TEACHER || authorRole === ROLES.ADMIN)
      ? 'admin_only'
      : (hasTeacher ? 'subject_teacher' : 'admin_fallback')
  });
});


// ---- Teacher review (subject-scoped student works) ----
app.get('/api/teacher/reviews/pending', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.TEACHER) return res.status(403).json({ error: '需要教师角色' });
  const list = await db.listTeacherPendingCourses(req.user, {
    subject: req.query.subject || null,
    grade: req.query.grade || null,
    query: req.query.q || null,
    page: req.query.page,
    limit: req.query.limit
  });
  res.json(presentMediaFields(list));
});

app.get('/api/teacher/reviews/done', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.TEACHER && normalizeRole(req.user.role) !== ROLES.ADMIN) {
    return res.status(403).json({ error: '需要教师或管理员' });
  }
  const list = await db.listReviewsByReviewer(req.user.id, {
    page: req.query.page,
    limit: req.query.limit
  });
  res.json(list);
});

app.get('/api/teacher/courses/:id', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.TEACHER) return res.status(403).json({ error: '需要教师角色' });
  const course = await db.getCourseWithAuthor(req.params.id);
  // PRD: unauthorized review details => unified 404
  if (!course || !canTeacherReviewCourse(req.user, course, { authorRole: course.authorRole })) {
    return res.status(404).json({ error: '课程不存在' });
  }
  res.json(presentMediaFields(course));
});

app.post('/api/teacher/courses/:id/review', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.TEACHER) return res.status(403).json({ error: '需要教师角色' });
  const { action } = req.body || {};
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action 无效' });
  if (action === 'reject' && !String(req.body?.comment || '').trim()) {
    // soft rule: allow empty but recommend; PRD said 建议驳回必填 - enforce
    return res.status(400).json({ error: '驳回请填写意见' });
  }
  const course = await db.getCourseWithAuthor(req.params.id);
  if (!course || !canTeacherReviewCourse(req.user, course, { authorRole: course.authorRole })) {
    return res.status(404).json({ error: '课程不存在' });
  }
  const updated = await db.updateCourse(course.id, {
    publish_status: action === 'approve' ? 'approved' : 'rejected',
    visibility: action === 'approve' ? 'public' : 'private'
  });
  await db.createReview({
    courseId: course.id,
    reviewerId: req.user.id,
    reviewerRole: ROLES.TEACHER,
    action,
    comment: req.body?.comment || '',
    subjectScope: course.subject || null
  });
  res.json(presentMediaFields(updated));
});


// ---- Admin user management ----

app.get('/api/admin/subjects', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    res.json(await db.listSubjects({ includeDisabled: true }));
  } catch (error) {
    res.status(500).json({ error: error.message || '加载学科失败' });
  }
});

app.post('/api/admin/subjects', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const row = await db.upsertSubject(req.body || {});
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message || '保存学科失败' });
  }
});

app.patch('/api/admin/subjects/:code', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const row = await db.updateSubject(req.params.code, req.body || {});
    res.json(row);
  } catch (error) {
    const code = /不存在/.test(error.message || '') ? 404 : 400;
    res.status(code).json({ error: error.message || '更新学科失败' });
  }
});

app.get('/api/admin/knowledge-points', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    res.json(await db.listKnowledgePoints({
      subject: req.query.subject ? String(req.query.subject) : null,
      grade: req.query.grade ? String(req.query.grade) : null,
      chapter: req.query.chapter ? String(req.query.chapter) : null,
      q: req.query.q ? String(req.query.q) : null,
      includeDisabled: true,
      limit: req.query.limit || 500
    }));
  } catch (error) {
    res.status(500).json({ error: error.message || '加载知识点失败' });
  }
});

app.post('/api/admin/knowledge-points', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const row = await db.createKnowledgePoint(req.body || {});
    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message || '创建知识点失败' });
  }
});

app.patch('/api/admin/knowledge-points/:id', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const row = await db.updateKnowledgePoint(req.params.id, req.body || {});
    res.json(row);
  } catch (error) {
    const code = /不存在/.test(error.message || '') ? 404 : 400;
    res.status(code).json({ error: error.message || '更新知识点失败' });
  }
});

app.delete('/api/admin/knowledge-points/:id', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    res.json(await db.deleteKnowledgePoint(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message || '删除知识点失败' });
  }
});

app.get('/api/catalog/animation-packs', (_req, res) => {
  res.json([
    { code: 'energy', name: '能量守恒动画包' },
    { code: 'sound', name: '声现象动画包' },
    { code: 'math', name: '数学示意动画包' },
    { code: 'light', name: '光学动画包' },
    { code: 'force', name: '力学/简单机械动画包' },
    { code: 'electric', name: '电路电学动画包' },
    { code: 'biology', name: '生物学动画包' },
    { code: 'chemistry', name: '化学动画包' },
    { code: 'geography', name: '地理动画包' },
    { code: 'history', name: '历史时间轴动画包' },
    { code: 'generic', name: '通用动画包' }
  ]);
});

app.post('/api/admin/knowledge-points/sync', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const overwrite = req.body?.overwrite !== false;
    const summary = await db.syncKnowledgePacks({ overwrite });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || '同步知识点失败' });
  }
});

app.post('/api/admin/knowledge-points/sync-chemaiforge', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const overwrite = req.body?.overwrite !== false;
    const summary = await db.syncChemAIForgeKnowledge({ overwrite });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || '同步 ChemAIForge 知识点失败' });
  }
});

app.post('/api/admin/knowledge-points/sync-junior-chinese', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const overwrite = req.body?.overwrite !== false;
    const summary = await db.syncJuniorChineseKnowledge({ overwrite });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || '同步初中语文知识点失败' });
  }
});

app.post('/api/admin/knowledge-points/sync-junior-english', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const overwrite = req.body?.overwrite !== false;
    const summary = await db.syncJuniorEnglishKnowledge({ overwrite });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || '同步初中英语知识点失败' });
  }
});

app.post('/api/admin/knowledge-points/sync-junior-history', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const overwrite = req.body?.overwrite !== false;
    const summary = await db.syncJuniorHistoryKnowledge({ overwrite });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || '同步初中历史知识点失败' });
  }
});

app.post('/api/admin/knowledge-points/sync-junior-geography', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const overwrite = req.body?.overwrite !== false;
    const summary = await db.syncJuniorGeographyKnowledge({ overwrite });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || '同步初中地理知识点失败' });
  }
});

app.post('/api/admin/knowledge-points/sync-junior-politics', auth(true), requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const overwrite = req.body?.overwrite !== false;
    const summary = await db.syncJuniorPoliticsKnowledge({ overwrite });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message || '同步初中政治知识点失败' });
  }
});


app.get('/api/admin/users', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  const list = await db.listUsers({
    role: req.query.role || null,
    status: req.query.status || null,
    query: req.query.q || null,
    page: req.query.page,
    limit: req.query.limit
  });
  res.json(list);
});

app.patch('/api/admin/users/:id', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  try {
    const body = req.body || {};
    if (body.teacherSubjects != null || body.teacher_subjects != null) {
      const roleHint = body.role || (await db.findUserById(req.params.id))?.role;
      const required = normalizeRole(roleHint) === ROLES.TEACHER;
      const checked = validateTeacherSubjects(body.teacherSubjects ?? body.teacher_subjects, { required });
      if (!checked.ok) return res.status(400).json({ error: checked.error });
    }
    const updated = await db.updateUserByAdmin(req.params.id, {
      nickname: body.nickname,
      role: body.role,
      status: body.status,
      teacherSubjects: body.teacherSubjects ?? body.teacher_subjects,
      grade: body.grade ?? body.grade_code
    }, { actorId: req.user.id });
    res.json({ user: publicUser(updated) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/stats', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  res.json(await db.stats());
});

app.get('/api/admin/config', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  res.json(await db.getConfig());
});

app.put('/api/admin/config', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  try {
    res.json(await db.updateConfig(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/jobs', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  const allowedStatuses = new Set(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
  if (req.query.status && !allowedStatuses.has(req.query.status)) return res.status(400).json({ error: 'status 无效' });
  res.json(presentMediaFields(await db.listJobs(req.user.id, true, {
    status: req.query.status || null,
    page: req.query.page,
    limit: req.query.limit
  })));
});

app.delete('/api/admin/courses/:id', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  try {
    const course = await db.getCourse(req.params.id);
    if (!course) return res.status(404).json({ error: '课程不存在' });
    await db.deleteCourse(course.id);
    res.json({ ok: true, id: course.id, deleted: true });
  } catch (error) {
    res.status(400).json({ error: error.message || '删除失败' });
  }
});

// Non-admin explicit deny for course deletion attempts on public course API
app.delete('/api/courses/:id', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) === ROLES.ADMIN) {
    // allow admin via same path as convenience
    try {
      const course = await db.getCourse(req.params.id);
      if (!course) return res.status(404).json({ error: '课程不存在' });
      await db.deleteCourse(course.id);
      return res.json({ ok: true, id: course.id, deleted: true });
    } catch (error) {
      return res.status(400).json({ error: error.message || '删除失败' });
    }
  }
  return res.status(403).json({ error: '仅管理员可删除课程' });
});

app.get('/api/admin/courses', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  const list = await db.listCourses({
    publishStatus: req.query.publishStatus || 'pending',
    subject: req.query.subject || null,
    grade: req.query.grade || null,
    query: req.query.q || null,
    includeAuthorRole: true,
    page: req.query.page,
    limit: req.query.limit
  });
  // annotate fallback for student courses without active subject teacher
  const annotated = [];
  for (const item of list) {
    let needsAdminFallback = false;
    if ((item.authorRole || item.authorRoleSnapshot) === ROLES.STUDENT || item.authorRole === 'student') {
      const hasTeacher = await db.hasActiveTeacherForSubject(item.subject);
      needsAdminFallback = !hasTeacher;
    }
    const authorRole = normalizeRole(item.authorRole || item.authorRoleSnapshot || item.author_role_snapshot || '');
    const reviewQueue = (authorRole === ROLES.TEACHER || authorRole === ROLES.ADMIN)
      ? 'admin_only'
      : (needsAdminFallback ? 'admin_fallback' : 'subject_teacher_or_admin');
    annotated.push({ ...item, authorRole, needsAdminFallback, reviewQueue });
  }
  res.json(presentMediaFields(annotated));
});

app.post('/api/admin/courses/:id/review', auth(true), async (req, res) => {
  if (normalizeRole(req.user.role) !== ROLES.ADMIN) return res.status(403).json({ error: '需要管理员' });
  const { action } = req.body || {};
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action 无效' });
  const course = await db.getCourseWithAuthor(req.params.id);
  if (!course) return res.status(404).json({ error: '课程不存在' });
  if ((course.publishStatus || course.publish_status) !== 'pending' && action !== 'reject') {
    // allow admin to re-process; still require pending for approve primarily
  }
  if ((course.publishStatus || course.publish_status) !== 'pending') {
    return res.status(400).json({ error: '仅待审课程可审核' });
  }
  const updated = await db.updateCourse(req.params.id, {
    publish_status: action === 'approve' ? 'approved' : 'rejected',
    visibility: action === 'approve' ? 'public' : 'private'
  });
  await db.createReview({
    courseId: req.params.id,
    reviewerId: req.user.id,
    reviewerRole: ROLES.ADMIN,
    action,
    comment: req.body?.comment || '',
    subjectScope: course.subject || null
  });
  res.json(presentMediaFields(updated));
});

await initDb();

app.use((error, _req, res, _next) => {
  console.error('[api] unhandled request error', error);
  if (!res.headersSent) res.status(500).json({ error: '服务器内部错误' });
});

if (process.env.ATV_NO_LISTEN !== '1') {
  app.listen(PORT, () => {
    console.log(`[api] ai-teaching-video-platform listening on http://localhost:${PORT}`);
    console.log(`[api] storage mode via USE_MYSQL=${process.env.USE_MYSQL || 'false'}`);
  });
}

export { app, PORT };
export default app;
