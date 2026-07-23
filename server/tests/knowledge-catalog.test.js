import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SUBJECTS,
  defaultKnowledgePoints,
  normalizeKnowledgePointRecord,
  normalizeSubjectRecord,
  matchKnowledgeQuery,
  publicKnowledgePoint,
  groupChapters
} from '../services/knowledgeCatalog.js';
import { SUBJECT_CODES } from '../services/rbac.js';
import { initDb } from '../db.js';
import db from '../db.js';

test('default subjects cover requested major categories', () => {
  const codes = DEFAULT_SUBJECTS.map((s) => s.code);
  for (const need of ['chinese', 'math', 'english', 'physics', 'chemistry', 'geography', 'history', 'politics']) {
    assert.ok(codes.includes(need), need);
  }
  for (const code of codes) {
    assert.ok(SUBJECT_CODES.includes(code), `rbac missing ${code}`);
  }
});

test('seed knowledge points include chemistry/geography/history topics', () => {
  const rows = defaultKnowledgePoints();
  assert.ok(rows.length >= 20);
  const topics = rows.map((r) => r.topic);
  for (const t of ['中和反应', '金属活动性顺序', '等高线', '影响气候的因素', '鸦片战争', '五四运动', '能量守恒定律']) {
    assert.ok(topics.includes(t), t);
  }
});

test('normalize subject/knowledge validators', () => {
  assert.equal(normalizeSubjectRecord({ code: 'Physics', name: '物理' }).ok, true);
  assert.equal(normalizeSubjectRecord({ code: 'P', name: '物理' }).ok, false);
  assert.equal(normalizeKnowledgePointRecord({
    subjectCode: 'physics', chapter: '光现象', topic: '凸透镜成像'
  }).ok, true);
  assert.equal(normalizeKnowledgePointRecord({ subjectCode: 'physics', chapter: '', topic: 'x' }).ok, false);
});

test('query match and chapter grouping', () => {
  const point = publicKnowledgePoint({
    id: '1', subject_code: 'physics', grade_code: 'grade8', chapter: '光现象', topic: '凸透镜成像',
    summary: '成像规律', keywords: ['焦点', '实像'], sort_order: 1, enabled: true
  });
  assert.equal(matchKnowledgeQuery(point, '焦点'), true);
  assert.equal(matchKnowledgeQuery(point, '电路'), false);
  const groups = groupChapters([point, { ...point, id: '2', topic: '光的折射' }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 2);
});

test('db memory catalog seed + CRUD', async () => {
  process.env.USE_MYSQL = 'false';
  process.env.MEMORY_DB_FILE = `/tmp/atv_knowledge_test_${process.pid}.json`;
  await initDb();
  const subjects = await db.listSubjects();
  assert.ok(subjects.some((s) => s.code === 'geography'));
  const points = await db.listKnowledgePoints({ subject: 'chemistry', q: '中和' });
  assert.ok(points.some((p) => p.topic.includes('中和')));
  const created = await db.createKnowledgePoint({
    subjectCode: 'politics',
    gradeCode: 'grade8',
    chapter: '法治',
    topic: '测试知识点',
    summary: '单测创建',
    keywords: ['测试']
  });
  assert.equal(created.topic, '测试知识点');
  const updated = await db.updateKnowledgePoint(created.id, { summary: '已更新' });
  assert.equal(updated.summary, '已更新');
  const del = await db.deleteKnowledgePoint(created.id);
  assert.equal(del.deleted, 1);
  const chapters = await db.listKnowledgeChapters({ subject: 'physics' });
  assert.ok(chapters.length >= 1);
  assert.ok(chapters[0].topics?.length >= 1);
});

test('sync knowledge packs fills animationPack and learningGoals', async () => {
  process.env.USE_MYSQL = 'false';
  process.env.MEMORY_DB_FILE = `/tmp/atv_knowledge_sync_${process.pid}.json`;
  // force fresh memory file
  try { await import('node:fs').then(fs => fs.rmSync(process.env.MEMORY_DB_FILE, { force: true })); } catch {}
  const { initDb } = await import('../db.js');
  const db = (await import('../db.js')).default;
  await initDb();
  const summary = await db.syncKnowledgePacks({ overwrite: true });
  assert.ok(summary.total >= 20);
  assert.ok(summary.created + summary.updated >= 20);
  const energy = (await db.listKnowledgePoints({ q: '能量守恒', includeDisabled: true })).find((p) => p.topic.includes('能量守恒'));
  assert.ok(energy, 'energy point');
  assert.equal(energy.animationPack, 'energy');
  assert.ok((energy.learningGoals || []).length >= 1);
  const lens = (await db.listKnowledgePoints({ q: '凸透镜', includeDisabled: true })).find((p) => p.topic.includes('凸透镜'));
  assert.ok(lens);
  assert.equal(lens.animationPack, 'light');
  const opium = (await db.listKnowledgePoints({ q: '鸦片战争', includeDisabled: true }))[0];
  assert.ok(opium);
  assert.equal(opium.animationPack, 'history');
});
