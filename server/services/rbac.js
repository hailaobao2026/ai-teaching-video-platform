/** Role / registration helpers aligned with docs/PRD.md §14 */

export const ROLES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin'
});

/** Historical flat role; always migrate to student. */
export const LEGACY_USER_ROLE = 'user';

export const PUBLIC_REGISTER_ROLES = new Set([ROLES.STUDENT, ROLES.TEACHER]);

export const SUBJECT_CODES = Object.freeze([
  'chinese',
  'math',
  'english',
  'physics',
  'chemistry',
  'biology',
  'geography',
  'history',
  'politics'
]);

export const SUBJECT_CODE_SET = new Set(SUBJECT_CODES);

export const GRADE_CODES = Object.freeze([
  'grade1',
  'grade2',
  'grade3',
  'grade4',
  'grade5',
  'grade6',
  'grade7',
  'grade8',
  'grade9',
  'grade10',
  'grade11',
  'grade12'
]);

export const GRADE_CODE_SET = new Set(GRADE_CODES);

export function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (!value || value === LEGACY_USER_ROLE) return ROLES.STUDENT;
  if (value === ROLES.STUDENT || value === ROLES.TEACHER || value === ROLES.ADMIN) return value;
  return ROLES.STUDENT;
}

export function parseTeacherSubjects(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
  }
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseTeacherSubjects(parsed);
    } catch {
      return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function serializeTeacherSubjects(subjects) {
  return JSON.stringify(parseTeacherSubjects(subjects));
}

export function validateTeacherSubjects(subjects, { required = false } = {}) {
  const list = parseTeacherSubjects(subjects);
  if (required && list.length === 0) {
    return { ok: false, error: '请至少选择一个授课学科', subjects: list };
  }
  const invalid = list.filter(code => !SUBJECT_CODE_SET.has(code));
  if (invalid.length) {
    return { ok: false, error: `不支持的学科: ${invalid.join(', ')}`, subjects: list };
  }
  return { ok: true, subjects: list };
}

export function validateRegisterPayload(body = {}) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const nickname = String(body.nickname || '').trim();
  const role = String(body.role || ROLES.STUDENT).trim().toLowerCase();
  const grade = body.grade ? String(body.grade).trim() : '';
  const teacherSubjectsRaw = body.teacherSubjects ?? body.teacher_subjects ?? [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: '邮箱格式无效' };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false, error: '密码长度应为 8-128 位' };
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: '密码需同时包含字母和数字' };
  }
  if (nickname.length < 2 || nickname.length > 32) {
    return { ok: false, error: '昵称长度应为 2-32 字' };
  }
  if (role === ROLES.ADMIN) {
    return { ok: false, error: '不允许注册管理员账号' };
  }
  if (!PUBLIC_REGISTER_ROLES.has(role)) {
    return { ok: false, error: '角色无效，仅支持 student 或 teacher' };
  }
  if (grade && !GRADE_CODE_SET.has(grade)) {
    return { ok: false, error: '年级无效' };
  }

  let teacherSubjects = [];
  if (role === ROLES.TEACHER) {
    const checked = validateTeacherSubjects(teacherSubjectsRaw, { required: true });
    if (!checked.ok) return { ok: false, error: checked.error };
    teacherSubjects = checked.subjects;
  }

  return {
    ok: true,
    value: {
      email,
      password,
      nickname,
      role,
      grade: role === ROLES.STUDENT ? (grade || null) : null,
      teacherSubjects: role === ROLES.TEACHER ? teacherSubjects : []
    }
  };
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    role: normalizeRole(user.role),
    status: user.status || 'active',
    teacherSubjects: parseTeacherSubjects(user.teacher_subjects_json ?? user.teacherSubjects ?? user.teacher_subjects),
    grade: user.grade_code || user.grade || null
  };
}

export function isAdmin(user) {
  return normalizeRole(user?.role) === ROLES.ADMIN;
}

export function isTeacher(user) {
  return normalizeRole(user?.role) === ROLES.TEACHER;
}

export function isStudent(user) {
  return normalizeRole(user?.role) === ROLES.STUDENT;
}

/** Teacher may review only pending student courses in their subjects. */
export function canTeacherReviewCourse(teacher, course, { authorRole } = {}) {
  if (!teacher || !course) return false;
  if (normalizeRole(teacher.role) !== ROLES.TEACHER) return false;
  const status = course.publish_status || course.publishStatus;
  if (status !== 'pending') return false;
  const role = normalizeRole(authorRole || course.author_role_snapshot || course.authorRoleSnapshot || course.authorRole);
  if (role !== ROLES.STUDENT) return false;
  const subjects = parseTeacherSubjects(teacher.teacher_subjects_json ?? teacher.teacherSubjects);
  const subject = course.subject;
  return Boolean(subject && subjects.includes(subject));
}

export function canAdminReviewCourse(admin, course) {
  if (!admin || !course) return false;
  if (normalizeRole(admin.role) !== ROLES.ADMIN) return false;
  const status = course.publish_status || course.publishStatus;
  return status === 'pending' || status === 'approved' || status === 'rejected';
}

export default {
  ROLES,
  LEGACY_USER_ROLE,
  PUBLIC_REGISTER_ROLES,
  SUBJECT_CODES,
  SUBJECT_CODE_SET,
  GRADE_CODES,
  normalizeRole,
  parseTeacherSubjects,
  serializeTeacherSubjects,
  validateTeacherSubjects,
  validateRegisterPayload,
  publicUser,
  isAdmin,
  isTeacher,
  isStudent,
  canTeacherReviewCourse,
  canAdminReviewCourse
};
