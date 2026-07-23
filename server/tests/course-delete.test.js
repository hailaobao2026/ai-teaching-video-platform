import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import http from 'node:http';

const stamp = Date.now();
const memoryFile = `/tmp/atv-course-delete-${stamp}.json`;
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
    default_image_provider: 'agnes',
    hyperframes_quality: 'standard'
  }
}, null, 2));

process.env.USE_MYSQL = 'false';
process.env.SEED_DEMO_TEACHER = 'false';
process.env.MEMORY_DB_FILE = memoryFile;
process.env.ADMIN_EMAIL = `admin_cd_${stamp}@example.com`;
process.env.ADMIN_PASSWORD = 'demo12345';
process.env.ATV_NO_LISTEN = '1';
process.env.PORT = '0';

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

test('only admin can delete plaza courses; student/teacher get 403', async () => {
  const { server, base } = await listen(app);
  try {
    const adminLogin = await req(base, 'POST', '/api/auth/login', {
      body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }
    });
    assert.ok([200, 201].includes(adminLogin.status), JSON.stringify(adminLogin.data));
    const adminToken = adminLogin.data.token;

    const studentReg = await req(base, 'POST', '/api/auth/register', {
      body: {
        email: `stu_cd_${stamp}@example.com`,
        password: 'demo12345',
        nickname: '学生删课测',
        role: 'student',
        grade: 'grade8'
      }
    });
    assert.ok([200, 201].includes(studentReg.status), JSON.stringify(studentReg.data));
    const studentToken = studentReg.data.token;
    const studentId = studentReg.data.user.id;

    const teacherReg = await req(base, 'POST', '/api/auth/register', {
      body: {
        email: `tea_cd_${stamp}@example.com`,
        password: 'demo12345',
        nickname: '教师删课测',
        role: 'teacher',
        teacherSubjects: ['physics']
      }
    });
    assert.ok([200, 201].includes(teacherReg.status), JSON.stringify(teacherReg.data));
    const teacherToken = teacherReg.data.token;

    const job = await db.createJob(studentId, {
      subject: 'physics',
      grade: 'grade8',
      chapter: '能量',
      topic: '广场删课测试',
      outputProfile: 'teaching_video_full'
    });
    const course = await db.createCourseFromJob(job, { authorName: '学生删课测' });
    await db.updateCourse(course.id, {
      publish_status: 'approved',
      visibility: 'public',
      author_role_snapshot: 'student'
    });

    const plaza = await req(base, 'GET', '/api/courses');
    assert.equal(plaza.status, 200);
    assert.equal(plaza.data.some(c => c.id === course.id), true);

    const studentDelete = await req(base, 'DELETE', `/api/courses/${course.id}`, { token: studentToken });
    assert.equal(studentDelete.status, 403, JSON.stringify(studentDelete.data));

    const teacherDelete = await req(base, 'DELETE', `/api/courses/${course.id}`, { token: teacherToken });
    assert.equal(teacherDelete.status, 403, JSON.stringify(teacherDelete.data));

    const teacherAdminPath = await req(base, 'DELETE', `/api/admin/courses/${course.id}`, { token: teacherToken });
    assert.equal(teacherAdminPath.status, 403, JSON.stringify(teacherAdminPath.data));

    // still present
    assert.ok(await db.getCourse(course.id));

    const adminDelete = await req(base, 'DELETE', `/api/admin/courses/${course.id}`, { token: adminToken });
    assert.equal(adminDelete.status, 200, JSON.stringify(adminDelete.data));
    assert.equal(adminDelete.data.deleted, true);
    assert.equal(await db.getCourse(course.id), null);

    const plazaAfter = await req(base, 'GET', '/api/courses');
    assert.equal(plazaAfter.data.some(c => c.id === course.id), false);
  } finally {
    server.close();
  }
});
