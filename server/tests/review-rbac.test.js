import assert from 'node:assert/strict';
import test from 'node:test';
import { canTeacherReviewCourse, ROLES } from '../services/rbac.js';

test('canTeacherReviewCourse enforces student+subject+pending', () => {
  const teacher = { role: 'teacher', teacherSubjects: ['physics'] };
  const ok = {
    publish_status: 'pending',
    subject: 'physics',
    author_role_snapshot: 'student'
  };
  assert.equal(canTeacherReviewCourse(teacher, ok, { authorRole: 'student' }), true);
  assert.equal(canTeacherReviewCourse(teacher, { ...ok, subject: 'math' }, { authorRole: 'student' }), false);
  assert.equal(canTeacherReviewCourse(teacher, { ...ok, author_role_snapshot: 'teacher' }, { authorRole: 'teacher' }), false);
  assert.equal(canTeacherReviewCourse(teacher, { ...ok, publish_status: 'draft' }, { authorRole: 'student' }), false);
  assert.equal(canTeacherReviewCourse({ role: 'admin', teacherSubjects: ['physics'] }, ok, { authorRole: 'student' }), false);
});

test('memory review queues isolate subjects and fallback to admin', async () => {
  process.env.USE_MYSQL = 'false';
  process.env.SEED_DEMO_TEACHER = 'false';
  process.env.ADMIN_EMAIL = `admin_rev_${Date.now()}@example.com`;
  process.env.ADMIN_PASSWORD = 'demo123';
  process.env.MEMORY_DB_FILE = `/tmp/atv-review-${Date.now()}.json`;

  const mod = await import(`../db.js?review=${Date.now()}`);
  await mod.initDb();
  const db = mod.db;

  const student = await db.createUser({
    email: `stu_${Date.now()}@example.com`,
    password: 'Passw0rd1',
    nickname: '学生甲',
    role: 'student',
    grade: 'grade8'
  });
  const physicsTeacher = await db.createUser({
    email: `phy_${Date.now()}@example.com`,
    password: 'Passw0rd1',
    nickname: '物理老师',
    role: 'teacher',
    teacherSubjects: ['physics']
  });
  const mathTeacher = await db.createUser({
    email: `math_${Date.now()}@example.com`,
    password: 'Passw0rd1',
    nickname: '数学老师',
    role: 'teacher',
    teacherSubjects: ['math']
  });

  const jobPhy = await db.createJob(student.id, {
    subject: 'physics', grade: 'grade8', chapter: '机械能', topic: '能量守恒', outputProfile: 'teaching_video_full'
  });
  const coursePhy = await db.createCourseFromJob(jobPhy, { authorName: student.nickname });
  await db.updateCourse(coursePhy.id, { publish_status: 'pending', author_role_snapshot: 'student' });

  const jobMath = await db.createJob(student.id, {
    subject: 'math', grade: 'grade8', chapter: '勾股', topic: '勾股定理', outputProfile: 'teaching_video_full'
  });
  const courseMath = await db.createCourseFromJob(jobMath, { authorName: student.nickname });
  await db.updateCourse(courseMath.id, { publish_status: 'pending', author_role_snapshot: 'student' });

  // teacher course -> only admin
  const jobTeacher = await db.createJob(physicsTeacher.id, {
    subject: 'physics', grade: 'grade8', chapter: '力', topic: '牛顿定律', outputProfile: 'teaching_video_full'
  });
  const courseTeacher = await db.createCourseFromJob(jobTeacher, { authorName: physicsTeacher.nickname });
  await db.updateCourse(courseTeacher.id, { publish_status: 'pending', author_role_snapshot: 'teacher' });

  const phyPending = await db.listTeacherPendingCourses(physicsTeacher);
  assert.equal(phyPending.some(c => c.id === coursePhy.id), true);
  assert.equal(phyPending.some(c => c.id === courseMath.id), false);
  assert.equal(phyPending.some(c => c.id === courseTeacher.id), false);

  const mathPending = await db.listTeacherPendingCourses(mathTeacher);
  assert.equal(mathPending.some(c => c.id === courseMath.id), true);
  assert.equal(mathPending.some(c => c.id === coursePhy.id), false);

  // chemistry student course without chemistry teacher -> admin fallback marker via hasActiveTeacherForSubject
  const jobChem = await db.createJob(student.id, {
    subject: 'chemistry', grade: 'grade9', chapter: '酸碱', topic: '中和反应', outputProfile: 'teaching_video_full'
  });
  const courseChem = await db.createCourseFromJob(jobChem, { authorName: student.nickname });
  await db.updateCourse(courseChem.id, { publish_status: 'pending', author_role_snapshot: 'student' });
  assert.equal(await db.hasActiveTeacherForSubject('chemistry'), false);
  assert.equal(await db.hasActiveTeacherForSubject('physics'), true);

  const adminPending = await db.listAdminPendingCourses({});
  assert.equal(adminPending.some(c => c.id === courseChem.id), true);
  assert.equal(adminPending.some(c => c.id === courseTeacher.id), true);
  assert.equal(adminPending.some(c => c.id === coursePhy.id), true);

  // teacher cannot "see" math course via getCourseWithAuthor + canTeacherReviewCourse
  const mathDetail = await db.getCourseWithAuthor(courseMath.id);
  assert.equal(canTeacherReviewCourse(physicsTeacher, mathDetail, { authorRole: mathDetail.authorRole }), false);
});
