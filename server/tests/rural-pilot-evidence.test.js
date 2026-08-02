import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';

process.env.USE_MYSQL = 'false';
process.env.SEED_DEMO_ACCOUNTS = 'false';
process.env.MEMORY_DB_FILE = path.join(os.tmpdir(), `rural-pilot-evidence-${process.pid}.json`);

const { db, initDb } = await import(`../db.js?pilot-evidence=${Date.now()}`);
await initDb();

function validPayload(overrides = {}) {
  return {
    schoolName: '测试乡村学校',
    region: '测试县测试乡',
    teacherName: '测试教师',
    topic: '能量守恒',
    prepBeforeMinutes: 60,
    prepAfterMinutes: 25,
    preQuizTotal: 10,
    preQuizCorrect: 4,
    postQuizTotal: 10,
    postQuizCorrect: 8,
    teacherAccuracyScore: 4.5,
    teacherUsefulnessScore: 4,
    networkMode: 'offline',
    offlineDownloaded: true,
    offlinePlayed: true,
    playbackDurationSec: 900,
    playbackInterruptionCount: 0,
    consentConfirmed: true,
    ...overrides
  };
}

test('rural pilot evidence creates, submits and summarizes real metrics', async () => {
  const created = await db.createRuralPilotEvidence('teacher_a', validPayload());
  assert.equal(created.status, 'draft');
  const submitted = await db.submitRuralPilotEvidence(created.id, 'teacher_a');
  assert.equal(submitted.status, 'submitted');
  const summary = await db.summarizeRuralPilotEvidence({ userId: 'teacher_a' });
  assert.equal(summary.hasData, true);
  assert.equal(summary.submittedRecordCount, 1);
  assert.equal(summary.prep.savedAvgMinutes, 35);
  assert.equal(summary.quiz.improvement, 0.4);
  assert.equal(summary.network.offlinePlayedCount, 1);
});

test('rural pilot evidence rejects invalid quiz and score values', async () => {
  await assert.rejects(() => db.createRuralPilotEvidence('teacher_b', validPayload({ preQuizCorrect: 11 })), /课前答对数/);
  await assert.rejects(() => db.createRuralPilotEvidence('teacher_b', validPayload({ teacherAccuracyScore: 6 })), /1-5/);
});

test('rural pilot evidence requires consent before submit', async () => {
  const created = await db.createRuralPilotEvidence('teacher_c', validPayload({ consentConfirmed: false }));
  await assert.rejects(() => db.submitRuralPilotEvidence(created.id, 'teacher_c'), /授权/);
});

test('rural pilot evidence isolates teacher records', async () => {
  const mine = await db.createRuralPilotEvidence('teacher_d', validPayload({ topic: '勾股定理' }));
  const ownList = await db.listRuralPilotEvidence({ userId: 'teacher_d' });
  const otherList = await db.listRuralPilotEvidence({ userId: 'teacher_e' });
  assert.equal(ownList.some((item) => item.id === mine.id), true);
  assert.equal(otherList.some((item) => item.id === mine.id), false);
});
