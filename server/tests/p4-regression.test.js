import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import fs from 'node:fs';

// IMPORTANT: set env BEFORE importing db/index (db captures MEMORY_DB_FILE at load time).
const stamp = Date.now();
const memoryFile = `/tmp/atv-p4-${stamp}.json`;

fs.writeFileSync(memoryFile, JSON.stringify({
  users: [{
    id: 'user_legacy_p4',
    email: `legacy_p4_${stamp}@example.com`,
    password_hash: '5c7bd16f', // legacy hash for demo123
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
  config: {
    default_tts_provider: 'edge',
    default_image_provider: 'agnes'
  }
}, null, 2));

process.env.USE_MYSQL = 'false';
process.env.SEED_DEMO_TEACHER = 'false';
process.env.MEMORY_DB_FILE = memoryFile;
process.env.ADMIN_EMAIL = `admin_p4_${stamp}@example.com`;
process.env.ADMIN_PASSWORD = 'demo123';
process.env.ATV_NO_LISTEN = '1';
process.env.PORT = '0';
// prevent host .env USE_MYSQL=true from winning if loadEnv overrides somehow
process.env.DOTENV_CONFIG_OVERRIDE = 'false';

const { OUTPUT_PROFILES } = await import('../services/teachingMediaPipeline.js');
const {
  canTeacherReviewCourse,
  normalizeRole,
  ROLES,
  validateRegisterPayload
} = await import('../services/rbac.js');
const { app } = await import('../index.js');
const { default: db } = await import('../db.js');

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

async function makePending({ subject, authorId, authorRole, title }) {
  const job = await db.createJob(authorId, {
    subject,
    grade: 'grade8',
    chapter: 'c',
    topic: title,
    outputProfile: 'teaching_video_full'
  });
  const course = await db.createCourseFromJob(job, { authorName: title });
  await db.updateCourse(course.id, {
    publish_status: 'pending',
    author_role_snapshot: authorRole
  });
  return course;
}

test('P4 checklist: migration, student all profiles, isolation 404, admin fallback', async (t) => {
  const { server, base } = await listen(app);
  t.after(() => new Promise(resolve => server.close(() => resolve())));

  const legacyLogin = await req(base, 'POST', '/api/auth/login', {
    body: { email: `legacy_p4_${stamp}@example.com`, password: 'demo123' }
  });
  assert.equal(legacyLogin.status, 200, JSON.stringify(legacyLogin.data));
  assert.equal(legacyLogin.data.user.role, 'student');

  const studentReg = await req(base, 'POST', '/api/auth/register', {
    body: {
      email: `stu_p4_${stamp}@example.com`,
      password: 'Passw0rd1',
      nickname: 'P4学生',
      role: 'student',
      grade: 'grade8'
    }
  });
  assert.equal(studentReg.status, 201, JSON.stringify(studentReg.data));
  const studentTok = studentReg.data.token;

  const phyReg = await req(base, 'POST', '/api/auth/register', {
    body: {
      email: `phy_p4_${stamp}@example.com`,
      password: 'Passw0rd1',
      nickname: 'P4物理老师',
      role: 'teacher',
      teacherSubjects: ['physics']
    }
  });
  assert.equal(phyReg.status, 201, JSON.stringify(phyReg.data));
  const phyTok = phyReg.data.token;

  const mathReg = await req(base, 'POST', '/api/auth/register', {
    body: {
      email: `math_p4_${stamp}@example.com`,
      password: 'Passw0rd1',
      nickname: 'P4数学老师',
      role: 'teacher',
      teacherSubjects: ['math']
    }
  });
  assert.equal(mathReg.status, 201, JSON.stringify(mathReg.data));
  const mathTok = mathReg.data.token;

  const adminReg = await req(base, 'POST', '/api/auth/register', {
    body: {
      email: `badadmin_p4_${stamp}@example.com`,
      password: 'Passw0rd1',
      nickname: '伪管理员',
      role: 'admin'
    }
  });
  assert.equal(adminReg.status, 400);

  const profiles = [...OUTPUT_PROFILES];
  assert.ok(profiles.length >= 7, `expected >=7 profiles, got ${profiles.length}`);
  for (const profile of profiles) {
    const payload = {
      outputProfile: profile,
      subject: 'physics',
      grade: 'grade8',
      chapter: '测试章节',
      topic: `P4-${profile}`,
      article: String(profile).includes('article') ? '# hello\n\ncontent' : undefined,
      prompt: profile === 'image_generation' ? '教学插图' : undefined,
      autoCreateCourse: false
    };
    const created = await req(base, 'POST', '/api/jobs', { token: studentTok, body: payload });
    assert.equal(created.status, 200, `${profile} => ${created.status} ${JSON.stringify(created.data)}`);
    assert.ok(created.data.jobId);
  }

  const student = await db.findUserByEmail(`stu_p4_${stamp}@example.com`);
  const phyTeacher = await db.findUserByEmail(`phy_p4_${stamp}@example.com`);

  const coursePhy = await makePending({ subject: 'physics', authorId: student.id, authorRole: 'student', title: '物理学生课' });
  const courseMath = await makePending({ subject: 'math', authorId: student.id, authorRole: 'student', title: '数学学生课' });
  const courseChem = await makePending({ subject: 'chemistry', authorId: student.id, authorRole: 'student', title: '化学无对口' });
  const courseTeacher = await makePending({ subject: 'physics', authorId: phyTeacher.id, authorRole: 'teacher', title: '教师作品' });

  const phyPending = await req(base, 'GET', '/api/teacher/reviews/pending', { token: phyTok });
  assert.equal(phyPending.status, 200);
  const phyIds = phyPending.data.map(x => x.id);
  assert.ok(phyIds.includes(coursePhy.id));
  assert.equal(phyIds.includes(courseMath.id), false);
  assert.equal(phyIds.includes(courseTeacher.id), false);

  const mathPending = await req(base, 'GET', '/api/teacher/reviews/pending', { token: mathTok });
  const mathIds = mathPending.data.map(x => x.id);
  assert.ok(mathIds.includes(courseMath.id));
  assert.equal(mathIds.includes(coursePhy.id), false);

  const cross = await req(base, 'GET', `/api/teacher/courses/${courseMath.id}`, { token: phyTok });
  assert.equal(cross.status, 404);

  const teacherWork = await req(base, 'POST', `/api/teacher/courses/${courseTeacher.id}/review`, {
    token: phyTok,
    body: { action: 'approve' }
  });
  assert.equal(teacherWork.status, 404);

  const approve = await req(base, 'POST', `/api/teacher/courses/${coursePhy.id}/review`, {
    token: phyTok,
    body: { action: 'approve' }
  });
  assert.equal(approve.status, 200, JSON.stringify(approve.data));
  assert.equal(approve.data.publishStatus || approve.data.publish_status, 'approved');

  const rejectNoComment = await req(base, 'POST', `/api/teacher/courses/${courseMath.id}/review`, {
    token: mathTok,
    body: { action: 'reject', comment: '' }
  });
  assert.equal(rejectNoComment.status, 400);

  const reject = await req(base, 'POST', `/api/teacher/courses/${courseMath.id}/review`, {
    token: mathTok,
    body: { action: 'reject', comment: '需要补充例题' }
  });
  assert.equal(reject.status, 200, JSON.stringify(reject.data));

  const mine = await req(base, 'GET', '/api/me/courses', { token: studentTok });
  assert.equal(mine.status, 200);
  const mathMine = mine.data.find(c => c.id === courseMath.id);
  assert.ok(mathMine?.latestReview);
  assert.equal(mathMine.latestReview.action, 'reject');
  assert.match(mathMine.latestReview.comment, /例题/);

  const adminLogin = await req(base, 'POST', '/api/auth/login', {
    body: { email: process.env.ADMIN_EMAIL, password: 'demo123' }
  });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
  const adminTok = adminLogin.data.token;
  const adminPending = await req(base, 'GET', '/api/admin/courses?publishStatus=pending', { token: adminTok });
  assert.equal(adminPending.status, 200);
  const chem = adminPending.data.find(c => c.id === courseChem.id);
  const twork = adminPending.data.find(c => c.id === courseTeacher.id);
  assert.ok(chem, 'chem course missing from admin pending');
  assert.equal(chem.needsAdminFallback, true);
  assert.ok(twork, 'teacher work missing from admin pending');
  assert.equal(twork.authorRole, 'teacher');

  const adminApprove = await req(base, 'POST', `/api/admin/courses/${courseChem.id}/review`, {
    token: adminTok,
    body: { action: 'approve', comment: 'admin fallback ok' }
  });
  assert.equal(adminApprove.status, 200);

  const teacherAdminUsers = await req(base, 'GET', '/api/admin/users', { token: phyTok });
  assert.equal(teacherAdminUsers.status, 403);

  const emptySubjects = await req(base, 'PATCH', '/api/me/profile', {
    token: phyTok,
    body: { teacherSubjects: [] }
  });
  assert.equal(emptySubjects.status, 400);

  const okSubjects = await req(base, 'PATCH', '/api/me/profile', {
    token: phyTok,
    body: { teacherSubjects: ['physics', 'math'] }
  });
  assert.equal(okSubjects.status, 200);
  assert.deepEqual(okSubjects.data.user.teacherSubjects.slice().sort(), ['math', 'physics']);

  assert.equal(normalizeRole('user'), ROLES.STUDENT);
  assert.equal(canTeacherReviewCourse(
    { role: 'teacher', teacherSubjects: ['physics'] },
    { publish_status: 'pending', subject: 'math' },
    { authorRole: 'student' }
  ), false);
  assert.equal(validateRegisterPayload({
    email: 'x@y.com', password: 'Passw0rd1', nickname: '测测', role: 'admin'
  }).ok, false);
});
