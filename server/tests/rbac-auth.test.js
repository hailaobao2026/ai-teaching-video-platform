import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LEGACY_USER_ROLE,
  ROLES,
  normalizeRole,
  parseTeacherSubjects,
  publicUser,
  validateRegisterPayload,
  validateTeacherSubjects
} from '../services/rbac.js';

test('normalizeRole migrates legacy user to student', () => {
  assert.equal(normalizeRole('user'), ROLES.STUDENT);
  assert.equal(normalizeRole(LEGACY_USER_ROLE), ROLES.STUDENT);
  assert.equal(normalizeRole('teacher'), ROLES.TEACHER);
  assert.equal(normalizeRole('admin'), ROLES.ADMIN);
});

test('validateRegisterPayload enforces student/teacher rules', () => {
  const student = validateRegisterPayload({
    email: 'stu@example.com',
    password: 'Passw0rd',
    nickname: '小明',
    role: 'student',
    grade: 'grade8'
  });
  assert.equal(student.ok, true);
  assert.equal(student.value.role, 'student');
  assert.equal(student.value.grade, 'grade8');
  assert.deepEqual(student.value.teacherSubjects, []);

  const teacherMissing = validateRegisterPayload({
    email: 't@example.com',
    password: 'Passw0rd',
    nickname: '王老师',
    role: 'teacher'
  });
  assert.equal(teacherMissing.ok, false);

  const teacherOk = validateRegisterPayload({
    email: 't@example.com',
    password: 'Passw0rd',
    nickname: '王老师',
    role: 'teacher',
    teacherSubjects: ['physics', 'physics', 'math']
  });
  assert.equal(teacherOk.ok, true);
  assert.deepEqual(teacherOk.value.teacherSubjects, ['physics', 'math']);

  const adminBlocked = validateRegisterPayload({
    email: 'a@example.com',
    password: 'Passw0rd',
    nickname: '管理员',
    role: 'admin'
  });
  assert.equal(adminBlocked.ok, false);
  assert.match(adminBlocked.error, /管理员/);

  const weakPassword = validateRegisterPayload({
    email: 'w@example.com',
    password: 'short',
    nickname: '弱密码',
    role: 'student'
  });
  assert.equal(weakPassword.ok, false);
});

test('validateTeacherSubjects requires at least one for teachers', () => {
  assert.equal(validateTeacherSubjects([], { required: true }).ok, false);
  assert.equal(validateTeacherSubjects(['physics'], { required: true }).ok, true);
  assert.equal(validateTeacherSubjects(['not-a-subject'], { required: true }).ok, false);
});

test('publicUser exposes teacherSubjects and normalizes role', () => {
  const view = publicUser({
    id: 'u1',
    email: 't@example.com',
    nickname: '王老师',
    role: 'user',
    status: 'active',
    teacher_subjects_json: '["physics"]',
    grade_code: null
  });
  assert.equal(view.role, 'student');
  assert.deepEqual(view.teacherSubjects, ['physics']);
});

test('memory db migrates legacy user role and supports teacher registration', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atv-rbac-'));
  const memoryFile = path.join(dir, 'memory-db.json');
  fs.writeFileSync(memoryFile, JSON.stringify({
    users: [{
      id: 'user_legacy',
      email: 'legacy@example.com',
      password_hash: 'x',
      nickname: '旧用户',
      role: 'user',
      status: 'active',
      created_at: new Date().toISOString()
    }],
    sessions: [],
    jobs: [],
    courses: [],
    assets: [],
    reviews: [],
    events: [],
    config: {}
  }, null, 2));

  process.env.USE_MYSQL = 'false';
  process.env.MEMORY_DB_FILE = memoryFile;
  process.env.SEED_DEMO_TEACHER = 'false';
  process.env.ADMIN_EMAIL = 'admin-rbac@example.com';
  process.env.ADMIN_PASSWORD = 'demo123';

  // Dynamic import after env set. Clear module cache first.
  const dbUrl = new URL('../db.js', import.meta.url).href + `?t=${Date.now()}`;
  const { initDb, db, hashPassword } = await import(dbUrl);
  // fix legacy password so login path not needed
  const mod = await import(dbUrl);
  await mod.initDb();
  const legacy = await mod.db.findUserByEmail('legacy@example.com');
  assert.equal(legacy.role, 'student');

  const created = await mod.db.createUser({
    email: 'physics.t@example.com',
    password: 'Passw0rd1',
    nickname: '物理老师',
    role: 'teacher',
    teacherSubjects: ['physics']
  });
  assert.equal(created.role, 'teacher');
  assert.deepEqual(parseTeacherSubjects(created.teacher_subjects_json), ['physics']);

  await assert.rejects(
    () => mod.db.createUser({
      email: 'bad.t@example.com',
      password: 'Passw0rd1',
      nickname: '无学科老师',
      role: 'teacher',
      teacherSubjects: []
    }),
    /授课学科/
  );

  const updated = await mod.db.updateUserProfile(created.id, { teacherSubjects: ['physics', 'math'] });
  assert.deepEqual(parseTeacherSubjects(updated.teacher_subjects_json), ['physics', 'math']);

  await assert.rejects(
    () => mod.db.updateUserProfile(created.id, { teacherSubjects: [] }),
    /至少一个|授课学科/
  );

  fs.rmSync(dir, { recursive: true, force: true });
});
