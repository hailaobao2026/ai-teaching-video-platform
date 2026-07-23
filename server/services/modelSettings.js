import { normalizeRole, ROLES } from './rbac.js';
import { OUTPUT_PROFILES } from './teachingMediaPipeline.js';

export const TTS_PROVIDERS = ['edge', 'minimax', 'seed', 'say'];
export const IMAGE_PROVIDERS = ['agnes', 'mulerun', 'apimart', 'atlascloud', 'volcengine'];
export const VIDEO_PROVIDERS = ['hyperframes']; // §13: only hyperframes in v1
export const VIDEO_QUALITIES = ['draft', 'standard', 'high'];

const IMAGE_KEY_ENV = {
  agnes: 'AGNES_API_KEY',
  mulerun: 'MULERUN_API_KEY',
  apimart: 'APIMART_API_KEY',
  atlascloud: 'ATLASCLOUD_API_KEY',
  volcengine: 'VOLCENGINE_API_KEY'
};

// Paid providers require personal credentials for student/teacher.
// Admin may fall back to process.env (.env / .env.compose).
export const FREE_TTS_PROVIDERS = new Set(['edge', 'say']);
export const PAID_TTS_PROVIDERS = new Set(['seed', 'minimax']);
export const PAID_IMAGE_PROVIDERS = new Set(['agnes', 'mulerun', 'apimart', 'atlascloud', 'volcengine']);

export const PROVIDER_CREDENTIAL_SCHEMAS = {
  seed: {
    kind: 'tts',
    label: '火山引擎 Seed TTS 2.0',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true, placeholder: 'ark-xxx 或 openspeech token' },
      { key: 'apiUrl', label: 'API URL', required: false, secret: false, placeholder: 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional' },
      { key: 'model', label: '资源 / 模型 ID', required: false, secret: false, placeholder: 'seed-tts-2.0' }
    ],
    env: {
      apiKey: ['SEED_TTS_API_KEY', 'VOLCENGINE_API_KEY', 'ARK_API_KEY'],
      apiUrl: ['SEED_TTS_URL'],
      model: ['SEED_TTS_RESOURCE_ID']
    },
    defaults: {
      apiUrl: 'https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional',
      model: 'seed-tts-2.0'
    }
  },
  minimax: {
    kind: 'tts',
    label: 'Minimax TTS',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true, placeholder: 'MINIMAX_API_KEY' },
      { key: 'apiUrl', label: 'API URL', required: false, secret: false, placeholder: '可选' },
      { key: 'model', label: '模型名称', required: false, secret: false, placeholder: 'speech-02-hd' }
    ],
    env: {
      apiKey: ['MINIMAX_API_KEY'],
      apiUrl: ['MINIMAX_API_URL'],
      model: ['MINIMAX_TTS_MODEL']
    },
    defaults: {
      model: 'speech-02-hd'
    }
  },
  volcengine: {
    kind: 'image',
    label: '火山引擎 Seedream',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true, placeholder: 'ark-xxx' },
      { key: 'apiUrl', label: 'API Base URL', required: false, secret: false, placeholder: 'https://ark.cn-beijing.volces.com/api/plan/v3' },
      { key: 'model', label: '模型名称', required: false, secret: false, placeholder: 'doubao-seedream-5.0-lite' }
    ],
    env: {
      apiKey: ['VOLCENGINE_API_KEY', 'ARK_API_KEY'],
      apiUrl: ['VOLCENGINE_API_BASE_URL'],
      model: ['VOLCENGINE_IMAGE_MODEL']
    },
    defaults: {
      apiUrl: 'https://ark.cn-beijing.volces.com/api/plan/v3',
      model: 'doubao-seedream-5.0-lite'
    }
  },
  agnes: {
    kind: 'image',
    label: 'Agnes Image',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true, placeholder: 'sk-xxx' },
      { key: 'apiUrl', label: 'API Base URL', required: false, secret: false, placeholder: 'https://apihub.agnes-ai.com/v1' },
      { key: 'model', label: '模型名称', required: false, secret: false, placeholder: 'agnes-image-2.1-flash' }
    ],
    env: {
      apiKey: ['AGNES_API_KEY'],
      apiUrl: ['AGNES_API_BASE_URL'],
      model: ['AGNES_IMAGE_MODEL']
    },
    defaults: {
      apiUrl: 'https://apihub.agnes-ai.com/v1',
      model: 'agnes-image-2.1-flash'
    }
  },
  mulerun: {
    kind: 'image',
    label: 'MuleRun',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true, placeholder: 'MULERUN_API_KEY' },
      { key: 'apiUrl', label: 'API URL', required: false, secret: false, placeholder: '可选' },
      { key: 'model', label: '模型名称', required: false, secret: false, placeholder: '可选' }
    ],
    env: {
      apiKey: ['MULERUN_API_KEY'],
      apiUrl: ['MULERUN_API_URL'],
      model: ['MULERUN_IMAGE_MODEL']
    },
    defaults: {}
  },
  apimart: {
    kind: 'image',
    label: 'APImart',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true, placeholder: 'APIMART_API_KEY' },
      { key: 'apiUrl', label: 'API URL', required: false, secret: false, placeholder: '可选' },
      { key: 'model', label: '模型名称', required: false, secret: false, placeholder: '可选' }
    ],
    env: {
      apiKey: ['APIMART_API_KEY'],
      apiUrl: ['APIMART_API_URL'],
      model: ['APIMART_IMAGE_MODEL']
    },
    defaults: {}
  },
  atlascloud: {
    kind: 'image',
    label: 'Atlas Cloud',
    fields: [
      { key: 'apiKey', label: 'API Key', required: true, secret: true, placeholder: 'ATLASCLOUD_API_KEY' },
      { key: 'apiUrl', label: 'API URL', required: false, secret: false, placeholder: '可选' },
      { key: 'model', label: '模型名称', required: false, secret: false, placeholder: '可选' }
    ],
    env: {
      apiKey: ['ATLASCLOUD_API_KEY'],
      apiUrl: ['ATLASCLOUD_API_URL'],
      model: ['ATLASCLOUD_IMAGE_MODEL']
    },
    defaults: {}
  }
};

function envFirst(names = []) {
  for (const name of names) {
    const value = process.env[name];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function cleanSecret(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (text.includes('••••') || text === '***' || text.toLowerCase() === 'redacted') return '';
  return text;
}

function normalizeProviderCredential(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    apiKey: cleanSecret(src.apiKey ?? src.api_key ?? ''),
    apiUrl: String(src.apiUrl ?? src.api_url ?? src.baseUrl ?? src.base_url ?? '').trim(),
    model: String(src.model ?? src.modelName ?? src.model_name ?? src.resourceId ?? src.resource_id ?? '').trim()
  };
}

export function normalizeProviderCredentials(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const provider of Object.keys(PROVIDER_CREDENTIAL_SCHEMAS)) {
    if (src[provider] != null && typeof src[provider] === 'object') {
      const normalized = normalizeProviderCredential(src[provider]);
      if (normalized.apiKey || normalized.apiUrl || normalized.model) out[provider] = normalized;
    }
  }
  return out;
}

export function maskSecret(value) {
  const text = String(value || '');
  if (!text) return '';
  if (text.length <= 8) return '••••';
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

export function publicProviderCredentials(credentials = {}) {
  const out = {};
  for (const [provider, cred] of Object.entries(normalizeProviderCredentials(credentials))) {
    out[provider] = {
      apiKey: cred.apiKey ? maskSecret(cred.apiKey) : '',
      apiKeySet: Boolean(cred.apiKey),
      apiUrl: cred.apiUrl || '',
      model: cred.model || ''
    };
  }
  return out;
}

export function mergeProviderCredentials(existing = {}, patch = {}) {
  const current = normalizeProviderCredentials(existing);
  const incoming = patch && typeof patch === 'object' ? patch : {};
  const out = { ...current };
  for (const provider of Object.keys(PROVIDER_CREDENTIAL_SCHEMAS)) {
    if (!(provider in incoming) || incoming[provider] == null) continue;
    if (incoming[provider] === false || incoming[provider] === null) {
      delete out[provider];
      continue;
    }
    const prev = out[provider] || { apiKey: '', apiUrl: '', model: '' };
    const next = normalizeProviderCredential(incoming[provider]);
    const merged = {
      apiKey: next.apiKey || prev.apiKey || '',
      apiUrl: next.apiUrl !== '' ? next.apiUrl : (prev.apiUrl || ''),
      model: next.model !== '' ? next.model : (prev.model || '')
    };
    if (merged.apiKey || merged.apiUrl || merged.model) out[provider] = merged;
    else delete out[provider];
  }
  return out;
}

export function getEnvProviderCredential(provider) {
  const schema = PROVIDER_CREDENTIAL_SCHEMAS[provider];
  if (!schema) return { apiKey: '', apiUrl: '', model: '' };
  return {
    apiKey: envFirst(schema.env.apiKey || []),
    apiUrl: envFirst(schema.env.apiUrl || []) || schema.defaults?.apiUrl || '',
    model: envFirst(schema.env.model || []) || schema.defaults?.model || ''
  };
}

export function resolveProviderCredential(provider, { userSettings = {}, role = ROLES.STUDENT, preferUser = true } = {}) {
  const schema = PROVIDER_CREDENTIAL_SCHEMAS[provider];
  if (!schema) return { apiKey: '', apiUrl: '', model: '', source: 'none' };
  const userCreds = normalizeProviderCredentials(userSettings.providerCredentials || userSettings.provider_credentials || {});
  const userCred = userCreds[provider] || { apiKey: '', apiUrl: '', model: '' };
  const envCred = getEnvProviderCredential(provider);
  const isAdmin = normalizeRole(role) === ROLES.ADMIN;

  let apiKey = '';
  let apiUrl = '';
  let model = '';
  let source = 'none';

  if (preferUser && userCred.apiKey) {
    apiKey = userCred.apiKey;
    source = 'user';
  } else if (isAdmin && envCred.apiKey) {
    apiKey = envCred.apiKey;
    source = 'env';
  } else if (userCred.apiKey) {
    apiKey = userCred.apiKey;
    source = 'user';
  }

  apiUrl = (preferUser && userCred.apiUrl) ? userCred.apiUrl : (userCred.apiUrl || envCred.apiUrl || schema.defaults?.apiUrl || '');
  model = (preferUser && userCred.model) ? userCred.model : (userCred.model || envCred.model || schema.defaults?.model || '');

  // Free providers never need credentials.
  if (FREE_TTS_PROVIDERS.has(provider)) {
    return { apiKey: '', apiUrl: '', model: '', source: 'free' };
  }
  return { apiKey, apiUrl, model, source };
}

export function providerCredentialReady(provider, { userSettings = {}, role = ROLES.STUDENT } = {}) {
  if (FREE_TTS_PROVIDERS.has(provider) || provider === 'hyperframes') return { ready: true, reason: null, source: 'free' };
  if (!PROVIDER_CREDENTIAL_SCHEMAS[provider]) return { ready: false, reason: '未知 provider', source: 'none' };
  const resolved = resolveProviderCredential(provider, { userSettings, role, preferUser: true });
  if (resolved.apiKey) return { ready: true, reason: null, source: resolved.source };
  const isAdmin = normalizeRole(role) === ROLES.ADMIN;
  if (isAdmin) {
    return { ready: false, reason: `${PROVIDER_CREDENTIAL_SCHEMAS[provider].env.apiKey[0]} 未配置（管理员可走 .env）`, source: 'none' };
  }
  return { ready: false, reason: '请在个人中心配置该模型的 API Key', source: 'none' };
}

export function buildRuntimeProviderEnv(provider, credential = {}) {
  const schema = PROVIDER_CREDENTIAL_SCHEMAS[provider];
  const cred = normalizeProviderCredential(credential);
  const env = {};
  if (!schema) return env;
  if (provider === 'seed') {
    if (cred.apiKey) {
      env.SEED_TTS_API_KEY = cred.apiKey;
      env.VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY || cred.apiKey;
      env.ARK_API_KEY = process.env.ARK_API_KEY || cred.apiKey;
    }
    if (cred.apiUrl) env.SEED_TTS_URL = cred.apiUrl;
    if (cred.model) env.SEED_TTS_RESOURCE_ID = cred.model;
  } else if (provider === 'minimax') {
    if (cred.apiKey) env.MINIMAX_API_KEY = cred.apiKey;
    if (cred.apiUrl) env.MINIMAX_API_URL = cred.apiUrl;
    if (cred.model) env.MINIMAX_TTS_MODEL = cred.model;
  } else if (provider === 'volcengine') {
    if (cred.apiKey) {
      env.VOLCENGINE_API_KEY = cred.apiKey;
      env.ARK_API_KEY = process.env.ARK_API_KEY || cred.apiKey;
    }
    if (cred.apiUrl) env.VOLCENGINE_API_BASE_URL = cred.apiUrl;
    if (cred.model) env.VOLCENGINE_IMAGE_MODEL = cred.model;
  } else if (provider === 'agnes') {
    if (cred.apiKey) env.AGNES_API_KEY = cred.apiKey;
    if (cred.apiUrl) env.AGNES_API_BASE_URL = cred.apiUrl;
    if (cred.model) env.AGNES_IMAGE_MODEL = cred.model;
  } else if (provider === 'mulerun') {
    if (cred.apiKey) env.MULERUN_API_KEY = cred.apiKey;
    if (cred.apiUrl) env.MULERUN_API_URL = cred.apiUrl;
    if (cred.model) env.MULERUN_IMAGE_MODEL = cred.model;
  } else if (provider === 'apimart') {
    if (cred.apiKey) env.APIMART_API_KEY = cred.apiKey;
    if (cred.apiUrl) env.APIMART_API_URL = cred.apiUrl;
    if (cred.model) env.APIMART_IMAGE_MODEL = cred.model;
  } else if (provider === 'atlascloud') {
    if (cred.apiKey) env.ATLASCLOUD_API_KEY = cred.apiKey;
    if (cred.apiUrl) env.ATLASCLOUD_API_URL = cred.apiUrl;
    if (cred.model) env.ATLASCLOUD_IMAGE_MODEL = cred.model;
  }
  return env;
}

export function resolveRuntimeCredentialsForJob({ user, userSettings, systemConfig, taskInput = {} } = {}) {
  const role = normalizeRole(user?.role);
  const settings = normalizeUserModelSettings(userSettings);
  const resolved = resolveEffectiveModelConfig({ userSettings: settings, systemConfig, taskInput });
  const ttsProvider = resolved.effective.ttsProvider;
  const imageProvider = resolved.effective.imageProvider;
  const ttsCred = resolveProviderCredential(ttsProvider, { userSettings: settings, role });
  const imageCred = resolveProviderCredential(imageProvider, { userSettings: settings, role });
  const runtimeEnv = {
    ...buildRuntimeProviderEnv(ttsProvider, ttsCred),
    ...buildRuntimeProviderEnv(imageProvider, imageCred)
  };
  return {
    ...resolved,
    credentials: {
      tts: { provider: ttsProvider, ...ttsCred, apiKey: ttsCred.apiKey ? maskSecret(ttsCred.apiKey) : '', apiKeySet: Boolean(ttsCred.apiKey) },
      image: { provider: imageProvider, ...imageCred, apiKey: imageCred.apiKey ? maskSecret(imageCred.apiKey) : '', apiKeySet: Boolean(imageCred.apiKey) }
    },
    runtimeEnv,
    credentialSnapshot: {
      ttsProvider,
      imageProvider,
      ttsSource: ttsCred.source,
      imageSource: imageCred.source,
      ttsApiKeySet: Boolean(ttsCred.apiKey),
      imageApiKeySet: Boolean(imageCred.apiKey),
      ttsApiUrl: ttsCred.apiUrl || '',
      imageApiUrl: imageCred.apiUrl || '',
      ttsModel: ttsCred.model || '',
      imageModel: imageCred.model || ''
    }
  };
}

const EDGE_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女）' },
  { id: 'zh-CN-YunxiNeural', label: '云希（男）' },
  { id: 'zh-CN-YunyangNeural', label: '云扬（男）' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊（女）' }
];

// Seed TTS 2.0 speakers verified against resource_id=seed-tts-2.0
const SEED_VOICES = [
  { id: 'zh_female_vv_uranus_bigtts', label: 'VV（女）' },
  { id: 'zh_female_cancan_uranus_bigtts', label: '灿灿（女）' },
  { id: 'zh_female_xiaohe_uranus_bigtts', label: '小荷（女）' },
  { id: 'zh_female_linjianvhai_uranus_bigtts', label: '邻家女孩（女）' },
  { id: 'zh_female_shuangkuaisisi_uranus_bigtts', label: '爽快思思（女）' },
  { id: 'zh_female_sajiaoxuemei_uranus_bigtts', label: '撒娇学妹（女）' },
  { id: 'zh_female_tianmeixiaoyuan_uranus_bigtts', label: '甜美小源（女）' },
  { id: 'zh_female_meilinvyou_uranus_bigtts', label: '魅力女友（女）' },
  { id: 'zh_female_gaolengyujie_uranus_bigtts', label: '高冷御姐（女）' },
  { id: 'zh_female_yingyujiaoxue_uranus_bigtts', label: '英语教学（女）' },
  { id: 'zh_male_dayi_uranus_bigtts', label: '大壹（男）' },
  { id: 'zh_male_ruyaqingnian_uranus_bigtts', label: '儒雅青年（男）' },
  { id: 'zh_male_taocheng_uranus_bigtts', label: '涛诚（男）' },
  { id: 'zh_male_wennuanahu_uranus_bigtts', label: '温暖阿虎（男）' },
  { id: 'zh_male_shaonianzixin_uranus_bigtts', label: '少年梓辛（男）' },
  { id: 'zh_male_yangguangqingnian_uranus_bigtts', label: '阳光青年（男）' }
];

function parseList(value, fallback) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === '') return [...fallback];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [...fallback];
}

export function emptyUserModelSettings() {
  return {
    ttsEnabled: false,
    ttsProvider: null,
    ttsVoice: null,
    ttsSpeed: null,
    imageEnabled: false,
    imageProvider: null,
    imageStyle: null,
    imageAspectRatio: null,
    videoEnabled: false,
    videoProvider: null,
    videoQuality: null,
    videoFps: null,
    preferredOutputProfile: null,
    providerCredentials: {}
  };
}

export function normalizeUserModelSettings(raw = {}) {
  const src = raw || {};
  let extra = src.extra_json ?? src.extraJson ?? src.extra ?? null;
  if (typeof extra === 'string') {
    try { extra = JSON.parse(extra); } catch { extra = {}; }
  }
  if (!extra || typeof extra !== 'object') extra = {};
  const providerCredentials = normalizeProviderCredentials(
    src.providerCredentials
    ?? src.provider_credentials
    ?? extra.providerCredentials
    ?? extra.provider_credentials
    ?? {}
  );
  return {
    ttsEnabled: Boolean(src.ttsEnabled ?? src.tts_enabled),
    ttsProvider: src.ttsProvider ?? src.tts_provider ?? null,
    ttsVoice: src.ttsVoice ?? src.tts_voice ?? null,
    ttsSpeed: src.ttsSpeed != null ? Number(src.ttsSpeed) : (src.tts_speed != null ? Number(src.tts_speed) : null),
    imageEnabled: Boolean(src.imageEnabled ?? src.image_enabled),
    imageProvider: src.imageProvider ?? src.image_provider ?? null,
    imageStyle: src.imageStyle ?? src.image_style ?? null,
    imageAspectRatio: src.imageAspectRatio ?? src.image_aspect_ratio ?? null,
    videoEnabled: Boolean(src.videoEnabled ?? src.video_enabled),
    videoProvider: src.videoProvider ?? src.video_provider ?? null,
    videoQuality: src.videoQuality ?? src.video_quality ?? null,
    videoFps: src.videoFps != null ? Number(src.videoFps) : (src.video_fps != null ? Number(src.video_fps) : null),
    preferredOutputProfile: src.preferredOutputProfile ?? src.preferred_output_profile ?? null,
    providerCredentials
  };
}

export function toDbModelSettings(settings) {
  const s = normalizeUserModelSettings(settings);
  return {
    tts_enabled: s.ttsEnabled ? 1 : 0,
    tts_provider: s.ttsProvider,
    tts_voice: s.ttsVoice,
    tts_speed: s.ttsSpeed,
    image_enabled: s.imageEnabled ? 1 : 0,
    image_provider: s.imageProvider,
    image_style: s.imageStyle,
    image_aspect_ratio: s.imageAspectRatio,
    video_enabled: s.videoEnabled ? 1 : 0,
    video_provider: s.videoProvider,
    video_quality: s.videoQuality,
    video_fps: s.videoFps,
    preferred_output_profile: s.preferredOutputProfile,
    extra_json: {
      providerCredentials: normalizeProviderCredentials(s.providerCredentials)
    }
  };
}

function hasEnvKey(name) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

function videoReady(provider) {
  return provider === 'hyperframes';
}

export function getSystemModelDefaults(systemConfig = {}) {
  const cfg = systemConfig || {};
  const ttsProvider = cfg.default_tts_provider || process.env.DEFAULT_TTS_PROVIDER || 'edge';
  const defaultEdgeVoice = cfg.default_edge_voice || process.env.DEFAULT_EDGE_VOICE || 'zh-CN-XiaoxiaoNeural';
  const defaultSeedVoice = cfg.default_seed_voice || process.env.DEFAULT_SEED_VOICE || process.env.SEED_TTS_VOICE || 'zh_female_vv_uranus_bigtts';
  return {
    ttsProvider,
    ttsVoice: ttsProvider === 'seed' ? defaultSeedVoice : defaultEdgeVoice,
    ttsSpeed: 1.0,
    imageProvider: cfg.default_image_provider || process.env.DEFAULT_IMAGE_PROVIDER || 'volcengine',
    imageStyle: process.env.DEFAULT_DIAGRAM_STYLE || 'cozy-handdrawn',
    imageAspectRatio: '16:9',
    videoProvider: cfg.default_video_provider || process.env.DEFAULT_VIDEO_PROVIDER || 'hyperframes',
    videoQuality: cfg.hyperframes_quality || process.env.HYPERFRAMES_QUALITY || 'standard',
    videoFps: Number(process.env.HYPERFRAMES_FPS || 30),
    preferredOutputProfile: 'teaching_video_full'
  };
}

export function buildModelCatalog(user, systemConfig = {}, userSettings = null) {
  const role = normalizeRole(user?.role);
  const cfg = systemConfig || {};
  const settings = normalizeUserModelSettings(userSettings || emptyUserModelSettings());
  const ttsAllow = new Set(parseList(cfg['models.tts.allowlist'] || cfg.models_tts_allowlist, TTS_PROVIDERS));
  const imageAllow = new Set(parseList(cfg['models.image.allowlist'] || cfg.models_image_allowlist, IMAGE_PROVIDERS));
  const videoAllow = new Set(parseList(cfg['models.video.allowlist'] || cfg.models_video_allowlist, VIDEO_PROVIDERS));

  const ttsLabels = {
    edge: 'Edge TTS（免费）',
    minimax: 'Minimax TTS（需 API Key）',
    seed: '火山引擎 Seed TTS 2.0（需 API Key）',
    say: 'macOS say（免费，仅 macOS）'
  };
  const tts = TTS_PROVIDERS.filter(p => ttsAllow.has(p)).map(provider => {
    const paid = PAID_TTS_PROVIDERS.has(provider);
    const status = providerCredentialReady(provider, { userSettings: settings, role });
    const schema = PROVIDER_CREDENTIAL_SCHEMAS[provider] || null;
    return {
      provider,
      label: ttsLabels[provider] || provider,
      paid,
      ready: status.ready,
      reason: status.ready ? null : status.reason,
      credentialSource: status.source,
      credentialFields: schema?.fields || [],
      defaults: schema?.defaults || {},
      voices: provider === 'edge' ? EDGE_VOICES : (provider === 'seed' ? SEED_VOICES : []),
      roles: [ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN]
    };
  }).filter(item => item.roles.includes(role));

  const imageLabels = {
    agnes: 'Agnes Image（需 API Key）',
    mulerun: 'MuleRun（需 API Key）',
    apimart: 'APImart（需 API Key）',
    atlascloud: 'Atlas Cloud（需 API Key）',
    volcengine: '火山引擎 Seedream（需 API Key）'
  };
  const image = IMAGE_PROVIDERS.filter(p => imageAllow.has(p)).map(provider => {
    const status = providerCredentialReady(provider, { userSettings: settings, role });
    const schema = PROVIDER_CREDENTIAL_SCHEMAS[provider] || null;
    return {
      provider,
      label: imageLabels[provider] || provider,
      paid: true,
      ready: status.ready,
      reason: status.ready ? null : status.reason,
      credentialSource: status.source,
      credentialFields: schema?.fields || [],
      defaults: schema?.defaults || {},
      roles: [ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN]
    };
  }).filter(item => item.roles.includes(role));

  const video = VIDEO_PROVIDERS.filter(p => videoAllow.has(p)).map(provider => ({
    provider,
    label: 'HyperFrames 教学动画渲染',
    paid: false,
    ready: videoReady(provider),
    reason: null,
    qualities: VIDEO_QUALITIES,
    roles: [ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN]
  })).filter(item => item.roles.includes(role));

  return {
    tts,
    image,
    video,
    outputProfiles: [...OUTPUT_PROFILES],
    credentialSchemas: PROVIDER_CREDENTIAL_SCHEMAS,
    policy: {
      freeTts: [...FREE_TTS_PROVIDERS],
      paidTts: [...PAID_TTS_PROVIDERS],
      paidImage: [...PAID_IMAGE_PROVIDERS],
      adminUsesEnv: true,
      teacherStudentRequirePersonalKey: true
    }
  };
}

export function validateUserModelSettings(patch, catalog, { partial = false } = {}) {
  const settings = normalizeUserModelSettings(patch);
  const ttsReadyMap = new Map((catalog.tts || []).map(i => [i.provider, i]));
  const imageReadyMap = new Map((catalog.image || []).map(i => [i.provider, i]));
  const videoReadyMap = new Map((catalog.video || []).map(i => [i.provider, i]));

  if (settings.ttsEnabled) {
    if (!settings.ttsProvider || !TTS_PROVIDERS.includes(settings.ttsProvider)) {
      return { ok: false, error: 'TTS provider 无效' };
    }
    const item = ttsReadyMap.get(settings.ttsProvider);
    if (!item) return { ok: false, error: 'TTS provider 未对当前用户开放' };
    if (settings.ttsProvider === 'edge' || settings.ttsProvider === 'seed') {
      const voiceOk = (item.voices || []).some(v => v.id === settings.ttsVoice) || !settings.ttsVoice;
      if (settings.ttsVoice && !voiceOk) return { ok: false, error: 'TTS 音色无效' };
    }
    if (settings.ttsSpeed != null && (!Number.isFinite(settings.ttsSpeed) || settings.ttsSpeed < 0.5 || settings.ttsSpeed > 2)) {
      return { ok: false, error: 'TTS 语速应在 0.5~2.0' };
    }
    if (PAID_TTS_PROVIDERS.has(settings.ttsProvider)) {
      const cred = settings.providerCredentials?.[settings.ttsProvider] || {};
      // admin may rely on env; student/teacher need personal key unless catalog already ready via env+admin
      if (!item.ready && !cred.apiKey) {
        return { ok: false, error: item.reason || `请配置 ${settings.ttsProvider} 的 API Key` };
      }
    }
  }

  if (settings.imageEnabled) {
    if (!settings.imageProvider || !IMAGE_PROVIDERS.includes(settings.imageProvider)) {
      return { ok: false, error: '图片 provider 无效' };
    }
    const item = imageReadyMap.get(settings.imageProvider);
    if (!item) return { ok: false, error: '图片 provider 未对当前用户开放' };
    if (PAID_IMAGE_PROVIDERS.has(settings.imageProvider)) {
      const cred = settings.providerCredentials?.[settings.imageProvider] || {};
      if (!item.ready && !cred.apiKey) {
        return { ok: false, error: item.reason || `请配置 ${settings.imageProvider} 的 API Key` };
      }
    }
  }

  if (settings.videoEnabled) {
    if (!settings.videoProvider || !VIDEO_PROVIDERS.includes(settings.videoProvider)) {
      return { ok: false, error: '视频 provider 无效（首期仅 hyperframes）' };
    }
    const item = videoReadyMap.get(settings.videoProvider);
    if (!item) return { ok: false, error: '视频 provider 未对当前用户开放' };
    if (settings.videoQuality && !VIDEO_QUALITIES.includes(settings.videoQuality)) {
      return { ok: false, error: 'videoQuality 无效' };
    }
  }

  if (settings.preferredOutputProfile && !OUTPUT_PROFILES.has(settings.preferredOutputProfile)) {
    return { ok: false, error: 'preferredOutputProfile 无效' };
  }

  return { ok: true, value: settings };
}

/**
 * Resolve effective model config.
 * Priority: task override > user settings(enabled) > system defaults > env (already in system defaults)
 */
export function resolveEffectiveModelConfig({ userSettings, systemConfig, taskInput = {} } = {}) {
  const systemDefaults = getSystemModelDefaults(systemConfig);
  const user = normalizeUserModelSettings(userSettings);
  const task = taskInput || {};
  const source = {};

  const pick = (taskVal, userEnabled, userVal, systemVal, key) => {
    if (taskVal != null && taskVal !== '') {
      source[key] = 'task';
      return taskVal;
    }
    if (userEnabled && userVal != null && userVal !== '') {
      source[key] = 'user';
      return userVal;
    }
    source[key] = 'system';
    return systemVal;
  };

  const effective = {
    ttsProvider: pick(task.ttsProvider, user.ttsEnabled, user.ttsProvider, systemDefaults.ttsProvider, 'ttsProvider'),
    ttsVoice: pick(task.ttsVoice, user.ttsEnabled, user.ttsVoice, systemDefaults.ttsVoice, 'ttsVoice'),
    ttsSpeed: pick(task.ttsSpeed, user.ttsEnabled, user.ttsSpeed, systemDefaults.ttsSpeed, 'ttsSpeed'),
    imageProvider: pick(task.imageProvider, user.imageEnabled, user.imageProvider, systemDefaults.imageProvider, 'imageProvider'),
    imageStyle: pick(task.imageStyle || task.style, user.imageEnabled, user.imageStyle, systemDefaults.imageStyle, 'imageStyle'),
    imageAspectRatio: pick(task.aspectRatio || task.imageAspectRatio, user.imageEnabled, user.imageAspectRatio, systemDefaults.imageAspectRatio, 'imageAspectRatio'),
    videoProvider: pick(task.videoProvider, user.videoEnabled, user.videoProvider, systemDefaults.videoProvider, 'videoProvider'),
    videoQuality: pick(task.videoQuality, user.videoEnabled, user.videoQuality, systemDefaults.videoQuality, 'videoQuality'),
    videoFps: pick(task.videoFps, user.videoEnabled, user.videoFps, systemDefaults.videoFps, 'videoFps'),
    preferredOutputProfile: user.preferredOutputProfile || systemDefaults.preferredOutputProfile
  };

  // §13 hard constraint
  if (effective.videoProvider !== 'hyperframes') {
    effective.videoProvider = 'hyperframes';
    if (source.videoProvider !== 'task') source.videoProvider = 'system';
  }
  if (!VIDEO_QUALITIES.includes(String(effective.videoQuality || ''))) {
    effective.videoQuality = 'standard';
    source.videoQuality = 'system';
  }

  return {
    settings: user,
    systemDefaults,
    effective,
    modelSnapshot: {
      ...effective,
      source
    }
  };
}

export default {
  emptyUserModelSettings,
  normalizeUserModelSettings,
  toDbModelSettings,
  getSystemModelDefaults,
  buildModelCatalog,
  validateUserModelSettings,
  resolveEffectiveModelConfig,
  resolveProviderCredential,
  resolveRuntimeCredentialsForJob,
  buildRuntimeProviderEnv,
  publicProviderCredentials,
  mergeProviderCredentials,
  providerCredentialReady,
  PROVIDER_CREDENTIAL_SCHEMAS,
  FREE_TTS_PROVIDERS,
  PAID_TTS_PROVIDERS,
  PAID_IMAGE_PROVIDERS,
  TTS_PROVIDERS,
  IMAGE_PROVIDERS,
  VIDEO_PROVIDERS,
  VIDEO_QUALITIES
};
