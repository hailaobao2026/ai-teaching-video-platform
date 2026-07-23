import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { hashPassword, needsPasswordRehash, verifyPassword } from '../db.js';

const dbModule = new URL('../db.js', import.meta.url).pathname;

test('password hashing uses scrypt and rejects wrong passwords', () => {
  const encoded = hashPassword('correct-password');
  assert.match(encoded, /^scrypt\$/);
  assert.equal(verifyPassword('correct-password', encoded), true);
  assert.equal(verifyPassword('wrong-password', encoded), false);
  assert.equal(verifyPassword('demo123', '5c7bd16f'), true);
  assert.equal(needsPasswordRehash('5c7bd16f'), true);
  assert.equal(needsPasswordRehash(encoded), false);
});

function runModule(script, dataFile) {
  const env = { ...process.env, USE_MYSQL: 'false', MEMORY_DB_FILE: dataFile };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env
  });
  assert.equal(result.status, 0, `status=${result.status} signal=${result.signal} stderr=${result.stderr} stdout=${result.stdout}`);
  return result.stdout.trim();
}

test('memory repository refreshes state written by another process', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atv-memory-db-'));
  const dataFile = path.join(tempDir, 'memory-db.json');
  try {
    runModule(`
      const { default: db, initDb } = await import(${JSON.stringify(dbModule)});
      await initDb();
      const user = await db.findUserByEmail('teacher@demo.local');
      const job = await db.createJob(user.id, {
        subject: 'physics', grade: 'grade8', chapter: 'test', topic: 'cross-process',
        outputProfile: 'infographic_only'
      });
      await db.updateConfig({ default_image_provider: 'apimart' });
    `, dataFile);
    const created = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const jobId = created.jobs[0]?.id;
    assert.ok(jobId, 'writer process did not persist a job');

    runModule(`
      const { default: db, initDb } = await import(${JSON.stringify(dbModule)});
      await initDb();
      const job = await db.claimNextJob();
      await db.updateJob(job.id, { status: 'failed', current_stage: 'failed', error_message: 'expected failure' });
    `, dataFile);
    const updated = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    assert.equal(updated.jobs[0]?.status, 'failed');

    runModule(`
      const { default: db, initDb } = await import(${JSON.stringify(dbModule)});
      await initDb();
      const job = await db.getJob(${JSON.stringify(jobId)});
      const config = await db.getConfig();
      const fs = await import('node:fs');
      fs.writeFileSync(${JSON.stringify(path.join(tempDir, 'result.json'))}, JSON.stringify({ status: job.status, error: job.errorMessage, provider: config.default_image_provider }));
    `, dataFile);

    const result = JSON.parse(fs.readFileSync(path.join(tempDir, 'result.json'), 'utf8'));
    assert.deepEqual(result, { status: 'failed', error: 'expected failure', provider: 'apimart' });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('expired memory sessions are rejected and removed', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atv-session-db-'));
  const dataFile = path.join(tempDir, 'memory-db.json');
  const resultFile = path.join(tempDir, 'result.json');
  try {
    runModule(`
      const { default: db, initDb } = await import(${JSON.stringify(dbModule)});
      await initDb();
      const user = await db.findUserByEmail('teacher@demo.local');
      await db.createSession(user.id);
    `, dataFile);
    const snapshot = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const token = snapshot.sessions[0].token;
    snapshot.sessions[0].created_at = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(dataFile, JSON.stringify(snapshot), 'utf8');

    runModule(`
      const fs = await import('node:fs');
      const { default: db, initDb } = await import(${JSON.stringify(dbModule)});
      await initDb();
      const user = await db.getSessionUser(${JSON.stringify(token)});
      fs.writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify({ authenticated: Boolean(user) }));
    `, dataFile);

    assert.deepEqual(JSON.parse(fs.readFileSync(resultFile, 'utf8')), { authenticated: false });
    assert.equal(JSON.parse(fs.readFileSync(dataFile, 'utf8')).sessions.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
