import assert from 'node:assert/strict';
import test from 'node:test';

test('admin can list/update users; teacher profile subjects enforced', async () => {
  process.env.USE_MYSQL = 'false';
  process.env.SEED_DEMO_TEACHER = 'false';
  process.env.ADMIN_EMAIL = `admin_p3_${Date.now()}@example.com`;
  process.env.ADMIN_PASSWORD = 'demo123';
  process.env.MEMORY_DB_FILE = `/tmp/atv-admin-users-${Date.now()}.json`;

  const mod = await import(`../db.js?p3=${Date.now()}`);
  await mod.initDb();
  const db = mod.db;

  const admin = await db.findUserByEmail(process.env.ADMIN_EMAIL);
  assert.equal(admin.role, 'admin');

  const teacher = await db.createUser({
    email: `t_p3_${Date.now()}@example.com`,
    password: 'Passw0rd1',
    nickname: '学科老师',
    role: 'teacher',
    teacherSubjects: ['physics']
  });

  const listed = await db.listUsers({ role: 'teacher' });
  assert.equal(listed.some(u => u.id === teacher.id), true);

  const updated = await db.updateUserByAdmin(teacher.id, {
    role: 'teacher',
    teacherSubjects: ['physics', 'math'],
    status: 'active'
  }, { actorId: admin.id });
  assert.deepEqual(
    (updated.teacher_subjects_json || []).slice().sort(),
    ['math', 'physics']
  );

  await assert.rejects(
    () => db.updateUserByAdmin(teacher.id, { teacherSubjects: [] }, { actorId: admin.id }),
    /授课学科|至少一个/
  );

  await assert.rejects(
    () => db.updateUserByAdmin(admin.id, { status: 'disabled' }, { actorId: admin.id }),
    /不能禁用自己/
  );

  // latest review on course
  const student = await db.createUser({
    email: `s_p3_${Date.now()}@example.com`,
    password: 'Passw0rd1',
    nickname: '学生',
    role: 'student'
  });
  const job = await db.createJob(student.id, {
    subject: 'physics', grade: 'grade8', chapter: 'x', topic: 'y', outputProfile: 'teaching_video_full'
  });
  const course = await db.createCourseFromJob(job, { authorName: student.nickname });
  await db.updateCourse(course.id, { publish_status: 'rejected', author_role_snapshot: 'student' });
  await db.createReview({
    courseId: course.id,
    reviewerId: teacher.id,
    reviewerRole: 'teacher',
    action: 'reject',
    comment: '公式有误',
    subjectScope: 'physics'
  });
  const latest = await db.getLatestReviewForCourse(course.id);
  assert.equal(latest.action, 'reject');
  assert.equal(latest.comment, '公式有误');
});
