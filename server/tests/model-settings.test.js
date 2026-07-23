import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import http from 'node:http';

const stamp = Date.now();
const memoryFile = `/tmp/atv-model-settings-${stamp}.json`;
fs.writeFileSync(memoryFile, JSON.stringify({
  users: [],
  sessions: [],
  jobs: [],
  courses: [],
  assets: [],
  reviews: [],
  events: [],
  user_model_settings: {},
  config: {
    default_tts_provider: 'edge',
    default_edge_voice: 'zh-CN-XiaoxiaoNeural',
    default_image_provider: 'agnes',
    default_video_provider: 'hyperframes',
    hyperframes_quality: 'standard'
  }
}, null, 2));

process.env.USE_MYSQL = 'false';
process.env.SEED_DEMO_TEACHER = 'false';
process.env.MEMORY_DB_FILE = memoryFile;
process.env.ADMIN_EMAIL = `admin_ms_${stamp}@example.com`;
process.env.ADMIN_PASSWORD = 'demo123';
process.env.ATV_NO_LISTEN = '1';
process.env.PORT = '0';
process.env.AGNES_API_KEY = process.env.AGNES_API_KEY || 'test-agnes-key';
delete process.env.MINIMAX_API_KEY;

const {
  resolveEffectiveModelConfig,
  validateUserModelSettings,
  buildModelCatalog,
  normalizeUserModelSettings,
  emptyUserModelSettings
} = await import('../services/modelSettings.js');
const { app } = await import('../index.js');
const { default: db, initDb } = await import('../db.js');
await initDb();

function listen(appInstance) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function req(base, method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

test('resolveEffectiveModelConfig priority task > user > system', () => {
  const resolved = resolveEffectiveModelConfig({
    userSettings: {
      ttsEnabled: true,
      ttsProvider: 'edge',
      ttsVoice: 'zh-CN-YunxiNeural',
      imageEnabled: true,
      imageProvider: 'mulerun',
      videoEnabled: true,
      videoProvider: 'hyperframes',
      videoQuality: 'draft'
    },
    systemConfig: {
      default_tts_provider: 'edge',
      default_edge_voice: 'zh-CN-XiaoxiaoNeural',
      default_image_provider: 'agnes',
      hyperframes_quality: 'standard'
    },
    taskInput: {
      imageProvider: 'apimart',
      videoQuality: 'high'
    }
  });
  assert.equal(resolved.effective.ttsVoice, 'zh-CN-YunxiNeural');
  assert.equal(resolved.modelSnapshot.source.ttsVoice, 'user');
  assert.equal(resolved.effective.imageProvider, 'apimart');
  assert.equal(resolved.modelSnapshot.source.imageProvider, 'task');
  assert.equal(resolved.effective.videoQuality, 'high');
  assert.equal(resolved.modelSnapshot.source.videoQuality, 'task');
  assert.equal(resolved.effective.videoProvider, 'hyperframes');
});

test('validateUserModelSettings rejects unready provider', () => {
  const catalog = buildModelCatalog({ role: 'student' }, {
    default_tts_provider: 'edge',
    'models.tts.allowlist': 'edge,minimax'
  });
  const minimax = catalog.tts.find(x => x.provider === 'minimax');
  assert.ok(minimax);
  assert.equal(minimax.ready, false);
  const bad = validateUserModelSettings({
    ttsEnabled: true,
    ttsProvider: 'minimax'
  }, catalog);
  assert.equal(bad.ok, false);
});

test('model settings API: catalog, put, get, reset, job snapshot', async () => {
  const { server, base } = await listen(app);
  try {
    const email = `stu_ms_${stamp}@example.com`;
    const reg = await req(base, 'POST', '/api/auth/register', {
      body: { email, password: 'demo12345', nickname: '学生A', role: 'student', grade: 'grade8' }
    });
    assert.ok([200,201].includes(reg.status), JSON.stringify(reg.data));
    const token = reg.data.token;

    const cat = await req(base, 'GET', '/api/models/catalog', { token });
    assert.equal(cat.status, 200);
    assert.ok(Array.isArray(cat.data.tts));
    assert.ok(cat.data.video.some(v => v.provider === 'hyperframes'));

    const put = await req(base, 'PUT', '/api/me/model-settings', {
      token,
      body: {
        ttsEnabled: true,
        ttsProvider: 'edge',
        ttsVoice: 'zh-CN-YunxiNeural',
        imageEnabled: false,
        imageProvider: 'agnes',
        videoEnabled: true,
        videoProvider: 'hyperframes',
        videoQuality: 'draft',
        preferredOutputProfile: 'teaching_video_full',
        providerCredentials: {
          agnes: { apiKey: 'sk-test-agnes', apiUrl: 'https://example.agnes', model: 'agnes-image-2.1-flash' }
        }
      }
    });
    assert.equal(put.status, 200, JSON.stringify(put.data));
    assert.equal(put.data.settings.ttsVoice, 'zh-CN-YunxiNeural');
    assert.equal(put.data.effective.videoQuality, 'draft');
    assert.equal(put.data.effective.ttsVoice, 'zh-CN-YunxiNeural');

    const get = await req(base, 'GET', '/api/me/model-settings', { token });
    assert.equal(get.status, 200);
    assert.equal(get.data.settings.ttsEnabled, true);
    assert.equal(get.data.effective.imageProvider, process.env.DEFAULT_IMAGE_PROVIDER || 'volcengine');

    const job = await req(base, 'POST', '/api/jobs', {
      token,
      body: {
        subject: 'physics',
        grade: 'grade8',
        chapter: '能量',
        topic: '模型设置联调',
        outputProfile: 'teaching_video_full',
        videoQuality: 'high'
      }
    });
    assert.equal(job.status, 200, JSON.stringify(job.data));
    assert.equal(job.data.modelSnapshot.videoQuality, 'high');
    assert.equal(job.data.modelSnapshot.source.videoQuality, 'task');
    assert.equal(job.data.modelSnapshot.ttsVoice, 'zh-CN-YunxiNeural');
    assert.equal(job.data.modelSnapshot.source.ttsVoice, 'user');

    const detail = await req(base, 'GET', `/api/jobs/${job.data.jobId}`, { token });
    assert.equal(detail.status, 200);
    const input = detail.data.input_json || detail.data.inputJson || detail.data;
    // publicJob may expose input_json nested
    const snapshot = detail.data.input_json?.modelSnapshot
      || detail.data.modelSnapshot
      || job.data.modelSnapshot;
    assert.ok(snapshot);
    assert.equal(snapshot.videoQuality, 'high');

    const putPaid = await req(base, 'PUT', '/api/me/model-settings', {
      token,
      body: {
        ttsEnabled: true,
        ttsProvider: 'seed',
        ttsVoice: 'zh_female_vv_uranus_bigtts',
        imageEnabled: true,
        imageProvider: 'volcengine',
        providerCredentials: {
          seed: { apiKey: 'ark-test-seed', apiUrl: 'https://openspeech.example/tts', model: 'seed-tts-2.0' },
          volcengine: { apiKey: 'ark-test-img', apiUrl: 'https://ark.example/v3', model: 'doubao-seedream-5.0-lite' }
        }
      }
    });
    assert.equal(putPaid.status, 200, JSON.stringify(putPaid.data));
    assert.equal(putPaid.data.settings.providerCredentials.seed.apiKeySet, true);
    assert.ok(String(putPaid.data.settings.providerCredentials.seed.apiKey).includes('••••'));
    assert.equal(putPaid.data.settings.providerCredentials.volcengine.apiUrl, 'https://ark.example/v3');

    const cat2 = await req(base, 'GET', '/api/models/catalog', { token });
    assert.equal(cat2.status, 200);
    const seedItem = cat2.data.tts.find(x => x.provider === 'seed');
    const volcItem = cat2.data.image.find(x => x.provider === 'volcengine');
    assert.equal(seedItem?.ready, true);
    assert.equal(volcItem?.ready, true);

    const reset = await req(base, 'POST', '/api/me/model-settings/reset', { token });
    assert.equal(reset.status, 200);
    assert.equal(reset.data.settings.ttsEnabled, false);
    assert.equal(reset.data.effective.videoQuality, 'standard');
  } finally {
    server.close();
  }
});
