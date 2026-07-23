// server/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  LEGACY_USER_ROLE,
  ROLES,
  normalizeRole,
  parseTeacherSubjects,
  serializeTeacherSubjects
} from './services/rbac.js';
import {
  DEFAULT_SUBJECTS,
  defaultKnowledgePoints,
  normalizeKnowledgePointRecord,
  normalizeSubjectRecord,
  publicKnowledgePoint,
  publicSubject,
  matchKnowledgeQuery,
  groupChapters,
  knowledgePackToCatalogPoint,
  listChemAIForgeKnowledgePoints,
  listJuniorChineseKnowledgePoints,
  listJuniorEnglishKnowledgePoints,
  listJuniorHistoryKnowledgePoints,
  listJuniorGeographyKnowledgePoints,
  listJuniorPoliticsKnowledgePoints
} from './services/knowledgeCatalog.js';
import { listKnowledgePacks } from './services/storyboardBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

dotenv.config({ path: join(__dirname, '.env') });
dotenv.config({ path: join(projectRoot, '.env') });

const useMysql = String(process.env.USE_MYSQL || 'false').toLowerCase() === 'true';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'ai_teaching_video',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4'
};

const memory = {
  users: [],
  sessions: [],
  jobs: [],
  courses: [],
  assets: [],
  reviews: [],
  events: [],
  subjects: [],
  knowledge_points: [],
  user_model_settings: {},
  config: {
    teaching_media_root: process.env.TEACHING_MEDIA_ROOT || '',
    default_tts_provider: process.env.DEFAULT_TTS_PROVIDER || 'edge',
    default_edge_voice: process.env.DEFAULT_EDGE_VOICE || 'zh-CN-XiaoxiaoNeural',
    default_seed_voice: process.env.DEFAULT_SEED_VOICE || process.env.SEED_TTS_VOICE || 'zh_female_vv_uranus_bigtts',
    default_image_provider: process.env.DEFAULT_IMAGE_PROVIDER || 'volcengine',
    default_video_provider: process.env.DEFAULT_VIDEO_PROVIDER || 'hyperframes',
    hyperframes_quality: process.env.HYPERFRAMES_QUALITY || 'standard',
    worker_concurrency: process.env.WORKER_CONCURRENCY || '1',
    'models.tts.allowlist': process.env.MODELS_TTS_ALLOWLIST || 'edge,minimax,seed,say',
    'models.image.allowlist': process.env.MODELS_IMAGE_ALLOWLIST || 'agnes,mulerun,apimart,atlascloud,volcengine',
    'models.video.allowlist': process.env.MODELS_VIDEO_ALLOWLIST || 'hyperframes',
    'models.catalog_version': process.env.MODELS_CATALOG_VERSION || '1'
  }
};

function memoryDataFile() {
  return process.env.MEMORY_DB_FILE || join(__dirname, 'data', 'memory-db.json');
}


function loadMemory() {
  try {
    const dataFile = memoryDataFile();
    if (fs.existsSync(dataFile)) {
      Object.assign(memory, JSON.parse(fs.readFileSync(dataFile, 'utf8')));
    }
  } catch (e) {
    console.warn('memory load failed', e.message);
  }
  if (!memory.user_model_settings || typeof memory.user_model_settings !== 'object') {
    memory.user_model_settings = {};
  }
  if (!memory.config || typeof memory.config !== 'object') {
    memory.config = {};
  }
}

function saveMemory() {
  const dataFile = memoryDataFile();
  fs.mkdirSync(dirname(dataFile), { recursive: true });
  const tempFile = `${dataFile}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(memory, null, 2), 'utf8');
  fs.renameSync(tempFile, dataFile);
}

function refreshMemory() {
  if (!useMysql) loadMemory();
}

loadMemory();

let pool = null;
let bootstrapPool = null;
if (useMysql) {
  pool = mysql.createPool(dbConfig);
  bootstrapPool = mysql.createPool({ ...dbConfig, database: undefined });
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function legacyHashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) - hash) + password.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password, encoded) {
  if (!encoded) return false;
  if (!encoded.startsWith('scrypt$')) return legacyHashPassword(String(password)) === encoded;
  const [, salt, expectedHex] = encoded.split('$');
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(String(password), salt, 32);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function needsPasswordRehash(encoded) {
  return !String(encoded || '').startsWith('scrypt$');
}

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function ensureMysqlUsersSchema(conn) {
  if (!(await columnExists(conn, 'users', 'teacher_subjects_json'))) {
    await conn.query('ALTER TABLE users ADD COLUMN teacher_subjects_json JSON NULL');
  }
  if (!(await columnExists(conn, 'users', 'grade_code'))) {
    await conn.query('ALTER TABLE users ADD COLUMN grade_code VARCHAR(32) NULL');
  }
  // Historical flat role -> student (confirmed PRD §14)
  await conn.query("UPDATE users SET role='student' WHERE role=? OR role='' OR role IS NULL", [LEGACY_USER_ROLE]);
}

function migrateMemoryUsers() {
  let changed = false;
  for (const user of memory.users) {
    if (!user) continue;
    if (user.role === LEGACY_USER_ROLE || !user.role) {
      user.role = ROLES.STUDENT;
      changed = true;
    }
    user.role = normalizeRole(user.role);
    if (user.teacher_subjects_json == null && user.teacherSubjects == null) {
      user.teacher_subjects_json = [];
      changed = true;
    } else if (user.teacherSubjects && user.teacher_subjects_json == null) {
      user.teacher_subjects_json = parseTeacherSubjects(user.teacherSubjects);
      changed = true;
    } else if (typeof user.teacher_subjects_json === 'string') {
      user.teacher_subjects_json = parseTeacherSubjects(user.teacher_subjects_json);
      changed = true;
    } else if (!Array.isArray(user.teacher_subjects_json)) {
      user.teacher_subjects_json = parseTeacherSubjects(user.teacher_subjects_json);
      changed = true;
    }
    if (user.grade_code === undefined) {
      user.grade_code = user.grade || null;
      changed = true;
    }
    if (!user.status) {
      user.status = 'active';
      changed = true;
    }
  }
  if (changed) saveMemory();
}


async function ensureMysqlCoursesSchema(conn) {
  if (!(await columnExists(conn, 'courses', 'author_role_snapshot'))) {
    await conn.query('ALTER TABLE courses ADD COLUMN author_role_snapshot VARCHAR(16) NULL');
  }
}

async function ensureMysqlReviewsSchema(conn) {
  if (!(await columnExists(conn, 'course_reviews', 'reviewer_role'))) {
    await conn.query('ALTER TABLE course_reviews ADD COLUMN reviewer_role VARCHAR(16) NULL');
  }
  if (!(await columnExists(conn, 'course_reviews', 'subject_scope'))) {
    await conn.query('ALTER TABLE course_reviews ADD COLUMN subject_scope VARCHAR(64) NULL');
  }
}


function ensureMemoryKnowledgeCatalog() {
  if (!Array.isArray(memory.subjects)) memory.subjects = [];
  if (!Array.isArray(memory.knowledge_points)) memory.knowledge_points = [];
  const now = new Date().toISOString();
  if (!memory.subjects.length) {
    memory.subjects = DEFAULT_SUBJECTS.map((s) => ({
      code: s.code,
      name: s.name,
      sort_order: s.sortOrder,
      enabled: true,
      created_at: now,
      updated_at: now
    }));
  } else {
    // ensure defaults exist
    for (const s of DEFAULT_SUBJECTS) {
      if (!memory.subjects.find((x) => x.code === s.code)) {
        memory.subjects.push({
          code: s.code,
          name: s.name,
          sort_order: s.sortOrder,
          enabled: true,
          created_at: now,
          updated_at: now
        });
      }
    }
  }
  if (!memory.knowledge_points.length) {
    memory.knowledge_points = defaultKnowledgePoints();
  }
}


async function ensureMysqlKnowledgePointColumns(conn) {
  const cols = [
    ['learning_goals_json', 'JSON NULL'],
    ['animation_pack', 'VARCHAR(64) NULL'],
    ['pack_key', 'VARCHAR(128) NULL']
  ];
  for (const [name, ddl] of cols) {
    if (!(await columnExists(conn, 'knowledge_points', name))) {
      await conn.query(`ALTER TABLE knowledge_points ADD COLUMN ${name} ${ddl}`);
    }
  }
}

async function ensureMysqlKnowledgeCatalog(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      code VARCHAR(64) PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 100,
      enabled TINYINT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )`);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS knowledge_points (
      id VARCHAR(64) PRIMARY KEY,
      subject_code VARCHAR(64) NOT NULL,
      grade_code VARCHAR(32) NULL,
      chapter VARCHAR(128) NOT NULL,
      topic VARCHAR(256) NOT NULL,
      summary TEXT NULL,
      keywords_json JSON NULL,
      learning_goals_json JSON NULL,
      animation_pack VARCHAR(64) NULL,
      pack_key VARCHAR(128) NULL,
      sort_order INT NOT NULL DEFAULT 100,
      enabled TINYINT NOT NULL DEFAULT 1,
      source VARCHAR(32) NOT NULL DEFAULT 'manual',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_kp_subject (subject_code),
      INDEX idx_kp_chapter (chapter),
      INDEX idx_kp_topic (topic),
      INDEX idx_kp_pack_key (pack_key)
    )`);
  await ensureMysqlKnowledgePointColumns(conn);

  const [subjectRows] = await conn.query('SELECT COUNT(*) AS c FROM subjects');
  const subjectCount = Number(subjectRows?.[0]?.c || 0);
  const now = new Date();
  if (!subjectCount) {
    for (const s of DEFAULT_SUBJECTS) {
      await conn.execute(
        'INSERT INTO subjects (code,name,sort_order,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?)',
        [s.code, s.name, s.sortOrder, 1, now, now]
      );
    }
  } else {
    for (const s of DEFAULT_SUBJECTS) {
      await conn.execute(
        `INSERT IGNORE INTO subjects (code,name,sort_order,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?)`,
        [s.code, s.name, s.sortOrder, 1, now, now]
      );
    }
  }

  const [kpRows] = await conn.query('SELECT COUNT(*) AS c FROM knowledge_points');
  const kpCount = Number(kpRows?.[0]?.c || 0);
  if (!kpCount) {
    for (const p of defaultKnowledgePoints()) {
      await conn.execute(
        `INSERT INTO knowledge_points
        (id,subject_code,grade_code,chapter,topic,summary,keywords_json,learning_goals_json,animation_pack,pack_key,sort_order,enabled,source,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          p.id,
          p.subject_code,
          p.grade_code,
          p.chapter,
          p.topic,
          p.summary,
          JSON.stringify(p.keywords || []),
          JSON.stringify(p.learning_goals || []),
          p.animation_pack || null,
          p.pack_key || null,
          p.sort_order,
          p.enabled ? 1 : 0,
          p.source || 'seed',
          now,
          now
        ]
      );
    }
  }
}

async function initMysql() {
  const conn = await bootstrapPool.getConnection();
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4`);
    await conn.query(`USE \`${dbConfig.database}\``);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(128) UNIQUE NOT NULL,
        password_hash VARCHAR(128) NOT NULL,
        nickname VARCHAR(64) NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'student',
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        teacher_subjects_json JSON NULL,
        grade_code VARCHAR(32) NULL,
        created_at DATETIME NOT NULL
      )`);
    await ensureMysqlUsersSchema(conn);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL
      )`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS generation_jobs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        output_profile VARCHAR(64) NOT NULL,
        input_json JSON NOT NULL,
        progress INT NOT NULL DEFAULT 0,
        current_stage VARCHAR(64) NOT NULL DEFAULT 'queued',
        work_dir VARCHAR(512) NULL,
        result_course_id VARCHAR(64) NULL,
        video_url VARCHAR(512) NULL,
        cover_url VARCHAR(512) NULL,
        error_message TEXT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        started_at DATETIME NULL,
        finished_at DATETIME NULL
      )`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        subject VARCHAR(64) NOT NULL,
        grade VARCHAR(64) NOT NULL,
        chapter VARCHAR(128) NOT NULL,
        title VARCHAR(256) NOT NULL,
        topic VARCHAR(256) NOT NULL,
        summary TEXT,
        visibility VARCHAR(16) NOT NULL DEFAULT 'private',
        publish_status VARCHAR(16) NOT NULL DEFAULT 'draft',
        author_role_snapshot VARCHAR(16) NULL,
        cover_url VARCHAR(512) NULL,
        video_url VARCHAR(512) NULL,
        duration_sec INT NULL,
        view_count INT NOT NULL DEFAULT 0,
        source_job_id VARCHAR(64) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      )`);
    await ensureMysqlCoursesSchema(conn);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS course_assets (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64) NOT NULL,
        course_id VARCHAR(64) NULL,
        asset_type VARCHAR(64) NOT NULL,
        path VARCHAR(512) NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        size_bytes BIGINT NOT NULL DEFAULT 0,
        metadata_json JSON NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_assets_job (job_id),
        INDEX idx_assets_course (course_id)
      )`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        config_key VARCHAR(128) PRIMARY KEY,
        value_json JSON NOT NULL,
        updated_at DATETIME NOT NULL
      )`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_model_settings (
        user_id VARCHAR(64) PRIMARY KEY,
        tts_enabled TINYINT NOT NULL DEFAULT 0,
        tts_provider VARCHAR(32) NULL,
        tts_voice VARCHAR(64) NULL,
        tts_speed DECIMAL(4,2) NULL,
        image_enabled TINYINT NOT NULL DEFAULT 0,
        image_provider VARCHAR(32) NULL,
        image_style VARCHAR(64) NULL,
        image_aspect_ratio VARCHAR(16) NULL,
        video_enabled TINYINT NOT NULL DEFAULT 0,
        video_provider VARCHAR(32) NULL,
        video_quality VARCHAR(16) NULL,
        video_fps INT NULL,
        preferred_output_profile VARCHAR(64) NULL,
        extra_json JSON NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      )`);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS course_reviews (
        id VARCHAR(64) PRIMARY KEY,
        course_id VARCHAR(64) NOT NULL,
        reviewer_id VARCHAR(64) NOT NULL,
        reviewer_role VARCHAR(16) NULL,
        action VARCHAR(16) NOT NULL,
        comment TEXT NULL,
        subject_scope VARCHAR(64) NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_reviews_course (course_id),
        INDEX idx_reviews_reviewer (reviewer_id)
      )`);
    await ensureMysqlReviewsSchema(conn);
    await ensureMysqlKnowledgeCatalog(conn);
  } finally {
    conn.release();
    await bootstrapPool.end();
  }
}

export async function initDb() {
  if (!useMysql) {
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    migrateMemoryUsers();
    const demoEmail = process.env.ADMIN_EMAIL || 'teacher@demo.local';
    const demoPassword = process.env.ADMIN_PASSWORD || 'demo123';
    if (!memory.users.find(u => u.email === demoEmail)) {
      memory.users.push({
        id: generateId('user'),
        email: demoEmail,
        password_hash: hashPassword(demoPassword),
        nickname: process.env.ADMIN_NICKNAME || '系统管理员',
        role: ROLES.ADMIN,
        status: 'active',
        teacher_subjects_json: [],
        grade_code: null,
        created_at: new Date().toISOString()
      });
      saveMemory();
    }
    const seedDemoAccounts = String(process.env.SEED_DEMO_ACCOUNTS || process.env.SEED_DEMO_TEACHER || 'true').toLowerCase() !== 'false';
    const demoTeacherEmail = process.env.DEMO_TEACHER_EMAIL || 'physics.teacher@demo.local';
    const demoTeacherPassword = process.env.DEMO_TEACHER_PASSWORD || 'demo123';
    if (seedDemoAccounts && !memory.users.find(u => u.email === demoTeacherEmail)) {
      memory.users.push({
        id: generateId('user'),
        email: demoTeacherEmail,
        password_hash: hashPassword(demoTeacherPassword),
        nickname: process.env.DEMO_TEACHER_NICKNAME || '物理老师',
        role: ROLES.TEACHER,
        status: 'active',
        teacher_subjects_json: parseTeacherSubjects(process.env.DEMO_TEACHER_SUBJECTS || '["physics"]'),
        grade_code: null,
        created_at: new Date().toISOString()
      });
      saveMemory();
    }
    const demoStudentEmail = process.env.DEMO_STUDENT_EMAIL || 'student@demo.local';
    const demoStudentPassword = process.env.DEMO_STUDENT_PASSWORD || 'demo123';
    if (seedDemoAccounts && !memory.users.find(u => u.email === demoStudentEmail)) {
      memory.users.push({
        id: generateId('user'),
        email: demoStudentEmail,
        password_hash: hashPassword(demoStudentPassword),
        nickname: process.env.DEMO_STUDENT_NICKNAME || '演示学生',
        role: ROLES.STUDENT,
        status: 'active',
        teacher_subjects_json: [],
        grade_code: process.env.DEMO_STUDENT_GRADE || 'grade8',
        created_at: new Date().toISOString()
      });
      saveMemory();
    }
  }
  if (useMysql) {
    await initMysql();
    const email = process.env.ADMIN_EMAIL || 'teacher@demo.local';
    const password = process.env.ADMIN_PASSWORD || 'demo123';
    if (email && password) {
      try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email=? LIMIT 1', [email]);
        if (!rows[0]) {
          await pool.execute(
            'INSERT INTO users (id,email,password_hash,nickname,role,status,teacher_subjects_json,grade_code,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [generateId('user'), email, hashPassword(password), process.env.ADMIN_NICKNAME || '系统管理员', ROLES.ADMIN, 'active', serializeTeacherSubjects([]), null, new Date()]
          );
        }
      } catch (error) {
        // api + worker may race on first boot; duplicate means admin already exists.
        if (!(error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062))) throw error;
      }
      // Ensure legacy roles are migrated even if table already existed.
      await pool.execute("UPDATE users SET role='student' WHERE role=? OR role='' OR role IS NULL", [LEGACY_USER_ROLE]);
      // Ensure seeded admin keeps admin role/password if email matches ADMIN_EMAIL.
      try {
        await pool.execute(
          'UPDATE users SET role=?, nickname=COALESCE(NULLIF(nickname, ""), ?), status="active", password_hash=? WHERE email=?',
          [ROLES.ADMIN, process.env.ADMIN_NICKNAME || '系统管理员', hashPassword(password), email]
        );
      } catch (error) {
        // ignore if concurrent
      }

      const seedDemoAccounts = String(process.env.SEED_DEMO_ACCOUNTS || process.env.SEED_DEMO_TEACHER || 'true').toLowerCase() !== 'false';
      const demoTeacherEmail = process.env.DEMO_TEACHER_EMAIL || 'physics.teacher@demo.local';
      const demoTeacherPassword = process.env.DEMO_TEACHER_PASSWORD || 'demo123';
      if (seedDemoAccounts && demoTeacherEmail) {
        try {
          const [trows] = await pool.execute('SELECT id FROM users WHERE email=? LIMIT 1', [demoTeacherEmail]);
          if (!trows[0]) {
            await pool.execute(
              'INSERT INTO users (id,email,password_hash,nickname,role,status,teacher_subjects_json,grade_code,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
              [
                generateId('user'),
                demoTeacherEmail,
                hashPassword(demoTeacherPassword),
                process.env.DEMO_TEACHER_NICKNAME || '物理老师',
                ROLES.TEACHER,
                'active',
                serializeTeacherSubjects(process.env.DEMO_TEACHER_SUBJECTS || '["physics"]'),
                null,
                new Date()
              ]
            );
          }
        } catch (error) {
          if (!(error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062))) throw error;
        }
      }

      const demoStudentEmail = process.env.DEMO_STUDENT_EMAIL || 'student@demo.local';
      const demoStudentPassword = process.env.DEMO_STUDENT_PASSWORD || 'demo123';
      if (seedDemoAccounts && demoStudentEmail) {
        try {
          const [srows] = await pool.execute('SELECT id FROM users WHERE email=? LIMIT 1', [demoStudentEmail]);
          if (!srows[0]) {
            await pool.execute(
              'INSERT INTO users (id,email,password_hash,nickname,role,status,teacher_subjects_json,grade_code,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
              [
                generateId('user'),
                demoStudentEmail,
                hashPassword(demoStudentPassword),
                process.env.DEMO_STUDENT_NICKNAME || '演示学生',
                ROLES.STUDENT,
                'active',
                serializeTeacherSubjects([]),
                process.env.DEMO_STUDENT_GRADE || 'grade8',
                new Date()
              ]
            );
          }
        } catch (error) {
          if (!(error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062))) throw error;
        }
      }
    }
  }
  return { mode: useMysql ? 'mysql' : 'memory' };
}

export const db = {
  async createUser({ email, password, nickname, role = ROLES.STUDENT, teacherSubjects = [], grade = null }) {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === ROLES.ADMIN) throw new Error('不允许通过注册创建管理员');
    const subjects = normalizedRole === ROLES.TEACHER ? parseTeacherSubjects(teacherSubjects) : [];
    if (normalizedRole === ROLES.TEACHER && subjects.length === 0) throw new Error('请至少选择一个授课学科');
    const gradeCode = normalizedRole === ROLES.STUDENT ? (grade || null) : null;
    if (useMysql) {
      const id = generateId('user');
      const now = new Date();
      try {
        await pool.execute(
          'INSERT INTO users (id,email,password_hash,nickname,role,status,teacher_subjects_json,grade_code,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
          [id, email, hashPassword(password), nickname, normalizedRole, 'active', serializeTeacherSubjects(subjects), gradeCode, now]
        );
      } catch (error) {
        if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) throw new Error('邮箱已注册');
        throw error;
      }
      return {
        id,
        email,
        nickname,
        role: normalizedRole,
        status: 'active',
        teacher_subjects_json: subjects,
        grade_code: gradeCode
      };
    }
    refreshMemory();
    if (memory.users.some(u => u.email === email)) throw new Error('邮箱已注册');
    const user = {
      id: generateId('user'),
      email,
      password_hash: hashPassword(password),
      nickname,
      role: normalizedRole,
      status: 'active',
      teacher_subjects_json: subjects,
      grade_code: gradeCode,
      created_at: new Date().toISOString()
    };
    memory.users.push(user);
    saveMemory();
    return {
      id: user.id,
      email,
      nickname,
      role: normalizedRole,
      status: 'active',
      teacher_subjects_json: subjects,
      grade_code: gradeCode
    };
  },

  async findUserByEmail(email) {
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [email]);
      return rows[0] || null;
    }
    refreshMemory();
    return memory.users.find(u => u.email === email) || null;
  },

  async findUserById(id) {
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM users WHERE id=?', [id]);
      return rows[0] || null;
    }
    refreshMemory();
    return memory.users.find(u => u.id === id) || null;
  },

  async createSession(userId) {
    const token = generateId('tok');
    if (useMysql) {
      await pool.execute('INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)', [token, userId, new Date()]);
      return token;
    }
    refreshMemory();
    memory.sessions.push({ token, user_id: userId, created_at: new Date().toISOString() });
    saveMemory();
    return token;
  },

  async getSessionUser(token) {
    if (!token) return null;
    if (useMysql) {
      const [rows] = await pool.execute(
        'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)',
        [token]
      );
      return rows[0] || null;
    }
    refreshMemory();
    const s = memory.sessions.find(x => x.token === token);
    if (!s) return null;
    if (!Number.isFinite(Date.parse(s.created_at)) || Date.now() - Date.parse(s.created_at) > 7 * 24 * 60 * 60 * 1000) {
      memory.sessions = memory.sessions.filter(item => item.token !== token);
      saveMemory();
      return null;
    }
    return memory.users.find(u => u.id === s.user_id) || null;
  },

  async deleteSession(token) {
    if (!token) return;
    if (useMysql) {
      await pool.execute('DELETE FROM sessions WHERE token=?', [token]);
      return;
    }
    refreshMemory();
    memory.sessions = memory.sessions.filter(session => session.token !== token);
    saveMemory();
  },

  async updateUserPasswordHash(userId, passwordHash) {
    if (useMysql) {
      await pool.execute('UPDATE users SET password_hash=? WHERE id=?', [passwordHash, userId]);
      return;
    }
    refreshMemory();
    const user = memory.users.find(item => item.id === userId);
    if (!user) return;
    user.password_hash = passwordHash;
    saveMemory();
  },

  async updateUserProfile(userId, patch = {}) {
    const current = await this.findUserById(userId);
    if (!current) throw new Error('用户不存在');
    const role = normalizeRole(current.role);
    const next = {
      nickname: current.nickname,
      teacher_subjects_json: parseTeacherSubjects(current.teacher_subjects_json ?? current.teacherSubjects),
      grade_code: current.grade_code || current.grade || null
    };
    if (patch.nickname != null) {
      const nickname = String(patch.nickname).trim();
      if (nickname.length < 2 || nickname.length > 32) throw new Error('昵称长度应为 2-32 字');
      next.nickname = nickname;
    }
    if (patch.teacherSubjects != null || patch.teacher_subjects != null) {
      if (role !== ROLES.TEACHER && role !== ROLES.ADMIN) {
        throw new Error('仅教师可维护授课学科');
      }
      const subjects = parseTeacherSubjects(patch.teacherSubjects ?? patch.teacher_subjects);
      if (role === ROLES.TEACHER && subjects.length === 0) throw new Error('请至少保留一个授课学科');
      next.teacher_subjects_json = subjects;
    }
    if (patch.grade != null || patch.grade_code != null) {
      next.grade_code = patch.grade_code ?? patch.grade ?? null;
    }
    if (useMysql) {
      await pool.execute(
        'UPDATE users SET nickname=?, teacher_subjects_json=?, grade_code=? WHERE id=?',
        [next.nickname, serializeTeacherSubjects(next.teacher_subjects_json), next.grade_code, userId]
      );
      return this.findUserById(userId);
    }
    refreshMemory();
    const user = memory.users.find(item => item.id === userId);
    if (!user) throw new Error('用户不存在');
    user.nickname = next.nickname;
    user.teacher_subjects_json = next.teacher_subjects_json;
    user.grade_code = next.grade_code;
    saveMemory();
    return user;
  },


  async listUsers({ role = null, status = null, query = null, page = 1, limit = 50 } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const offset = (safePage - 1) * safeLimit;
    if (useMysql) {
      let sql = 'SELECT id,email,nickname,role,status,teacher_subjects_json,grade_code,created_at FROM users WHERE 1=1';
      const params = [];
      if (role) { sql += ' AND role=?'; params.push(normalizeRole(role)); }
      if (status) { sql += ' AND status=?'; params.push(status); }
      if (query) {
        sql += ' AND (email LIKE ? OR nickname LIKE ?)';
        params.push(`%${query}%`, `%${query}%`);
      }
      sql += ` ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`;
      const [rows] = await pool.execute(sql, params);
      return rows.map(row => ({
        id: row.id,
        email: row.email,
        nickname: row.nickname,
        role: normalizeRole(row.role),
        status: row.status || 'active',
        teacherSubjects: parseTeacherSubjects(row.teacher_subjects_json),
        grade: row.grade_code || null,
        createdAt: row.created_at
      }));
    }
    refreshMemory();
    return memory.users
      .filter(u => {
        if (role && normalizeRole(u.role) !== normalizeRole(role)) return false;
        if (status && (u.status || 'active') !== status) return false;
        if (query) {
          const q = String(query).toLowerCase();
          if (!`${u.email} ${u.nickname}`.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(offset, offset + safeLimit)
      .map(u => ({
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        role: normalizeRole(u.role),
        status: u.status || 'active',
        teacherSubjects: parseTeacherSubjects(u.teacher_subjects_json),
        grade: u.grade_code || null,
        createdAt: u.created_at
      }));
  },

  async updateUserByAdmin(userId, patch = {}, { actorId = null } = {}) {
    const current = await this.findUserById(userId);
    if (!current) throw new Error('用户不存在');
    const next = {
      nickname: current.nickname,
      role: normalizeRole(current.role),
      status: current.status || 'active',
      teacher_subjects_json: parseTeacherSubjects(current.teacher_subjects_json ?? current.teacherSubjects),
      grade_code: current.grade_code || current.grade || null
    };
    if (patch.nickname != null) {
      const nickname = String(patch.nickname).trim();
      if (nickname.length < 2 || nickname.length > 32) throw new Error('昵称长度应为 2-32 字');
      next.nickname = nickname;
    }
    if (patch.role != null) {
      const role = String(patch.role).trim().toLowerCase();
      if (![ROLES.STUDENT, ROLES.TEACHER, ROLES.ADMIN].includes(role)) throw new Error('角色无效');
      // prevent demoting/locking the last admin self-destruct when actor is same
      if (normalizeRole(current.role) === ROLES.ADMIN && role !== ROLES.ADMIN && actorId && actorId === userId) {
        throw new Error('不能降低自己的管理员角色');
      }
      next.role = role;
    }
    if (patch.status != null) {
      const status = String(patch.status).trim();
      if (!['active', 'disabled'].includes(status)) throw new Error('状态无效');
      if (status === 'disabled' && actorId && actorId === userId) throw new Error('不能禁用自己的账号');
      next.status = status;
    }
    if (patch.teacherSubjects != null || patch.teacher_subjects != null) {
      const subjects = parseTeacherSubjects(patch.teacherSubjects ?? patch.teacher_subjects);
      if (next.role === ROLES.TEACHER && subjects.length === 0) throw new Error('教师须至少保留一个授课学科');
      next.teacher_subjects_json = next.role === ROLES.TEACHER || next.role === ROLES.ADMIN ? subjects : [];
    } else if (next.role === ROLES.TEACHER && next.teacher_subjects_json.length === 0) {
      throw new Error('教师须至少保留一个授课学科');
    } else if (next.role === ROLES.STUDENT) {
      next.teacher_subjects_json = [];
    }
    if (patch.grade != null || patch.grade_code != null) {
      next.grade_code = next.role === ROLES.STUDENT ? (patch.grade_code ?? patch.grade ?? null) : null;
    }
    if (useMysql) {
      await pool.execute(
        'UPDATE users SET nickname=?, role=?, status=?, teacher_subjects_json=?, grade_code=? WHERE id=?',
        [next.nickname, next.role, next.status, serializeTeacherSubjects(next.teacher_subjects_json), next.grade_code, userId]
      );
      return this.findUserById(userId);
    }
    refreshMemory();
    const user = memory.users.find(item => item.id === userId);
    if (!user) throw new Error('用户不存在');
    user.nickname = next.nickname;
    user.role = next.role;
    user.status = next.status;
    user.teacher_subjects_json = next.teacher_subjects_json;
    user.grade_code = next.grade_code;
    saveMemory();
    return user;
  },

  async listReviewsForCourse(courseId, { limit = 20 } = {}) {
    const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
    if (useMysql) {
      const [rows] = await pool.execute(
        `SELECT r.*, u.nickname AS reviewerName
         FROM course_reviews r
         LEFT JOIN users u ON u.id = r.reviewer_id
         WHERE r.course_id=?
         ORDER BY r.created_at DESC
         LIMIT ${safeLimit}`,
        [courseId]
      );
      return rows;
    }
    refreshMemory();
    return memory.reviews
      .filter(r => r.course_id === courseId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, safeLimit)
      .map(r => {
        const reviewer = memory.users.find(u => u.id === r.reviewer_id);
        return { ...r, reviewerName: reviewer?.nickname || null };
      });
  },

  async getLatestReviewForCourse(courseId) {
    const list = await this.listReviewsForCourse(courseId, { limit: 1 });
    return list[0] || null;
  },

    async createJob(userId, input) {
    const now = new Date().toISOString();
    const job = {
      id: generateId('job'),
      user_id: userId,
      status: 'queued',
      output_profile: input.outputProfile || 'teaching_video_full',
      input_json: input,
      progress: 0,
      current_stage: 'queued',
      work_dir: null,
      result_course_id: null,
      video_url: null,
      cover_url: null,
      error_message: null,
      created_at: now,
      updated_at: now,
      started_at: null,
      finished_at: null,
      topic: input.topic,
      subject: input.subject,
      grade: input.grade,
      chapter: input.chapter
    };
    if (useMysql) {
      await pool.execute(
        `INSERT INTO generation_jobs
        (id,user_id,status,output_profile,input_json,progress,current_stage,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?)`,
        [job.id, userId, job.status, job.output_profile, JSON.stringify(input), 0, 'queued', new Date(), new Date()]
      );
      return job;
    }
    refreshMemory();
    memory.jobs.unshift(job);
    saveMemory();
    return job;
  },

  async listJobs(userId, isAdmin = false, { status = null, page = 1, limit = 50 } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const offset = (safePage - 1) * safeLimit;
    if (useMysql) {
      const conditions = [];
      const params = [];
      if (!isAdmin) { conditions.push('user_id=?'); params.push(userId); }
      if (status) { conditions.push('status=?'); params.push(status); }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      const [rows] = await pool.execute(
        `SELECT * FROM generation_jobs${where} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`,
        params
      );
      return rows.map(normalizeJobRow);
    }
    refreshMemory();
    return memory.jobs
      .filter(j => (isAdmin || j.user_id === userId) && (!status || j.status === status))
      .slice(offset, offset + safeLimit)
      .map(publicJob);
  },

  async getJob(id) {
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM generation_jobs WHERE id=?', [id]);
      return rows[0] ? normalizeJobRow(rows[0]) : null;
    }
    refreshMemory();
    const job = memory.jobs.find(j => j.id === id);
    return job ? publicJob(job) : null;
  },

  async claimNextJob() {
    if (useMysql) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
          `SELECT * FROM generation_jobs WHERE status='queued' ORDER BY created_at ASC LIMIT 1 FOR UPDATE`
        );
        if (!rows[0]) {
          await conn.commit();
          return null;
        }
        const job = rows[0];
        await conn.execute(
          `UPDATE generation_jobs SET status='running', current_stage='storyboard', progress=5, started_at=?, updated_at=? WHERE id=?`,
          [new Date(), new Date(), job.id]
        );
        await conn.commit();
        return normalizeJobRow({ ...job, status: 'running', current_stage: 'storyboard', progress: 5 });
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }
    refreshMemory();
    const job = memory.jobs.find(j => j.status === 'queued');
    if (!job) return null;
    job.status = 'running';
    job.current_stage = 'storyboard';
    job.progress = 5;
    job.started_at = new Date().toISOString();
    job.updated_at = job.started_at;
    saveMemory();
    return publicJob(job);
  },

  async updateJob(id, patch) {
    if (useMysql) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(patch)) {
        const col = toSnake(k);
        fields.push(`${col}=?`);
        values.push(MYSQL_DATE_FIELDS.has(col) ? toMysqlDate(v) : v);
      }
      fields.push('updated_at=?');
      values.push(new Date());
      values.push(id);
      await pool.execute(`UPDATE generation_jobs SET ${fields.join(',')} WHERE id=?`, values);
      return this.getJob(id);
    }
    refreshMemory();
    const job = memory.jobs.find(j => j.id === id);
    if (!job) return null;
    Object.assign(job, patch, { updated_at: new Date().toISOString() });
    saveMemory();
    return publicJob(job);
  },

  async cancelJob(id) {
    if (useMysql) {
      await pool.execute(
        `UPDATE generation_jobs SET status='cancelled', current_stage='cancelled', finished_at=?, updated_at=?
         WHERE id=? AND status IN ('queued','running')`,
        [new Date(), new Date(), id]
      );
      return this.getJob(id);
    }
    refreshMemory();
    const job = memory.jobs.find(j => j.id === id);
    if (!job || !['queued', 'running'].includes(job.status)) return job ? publicJob(job) : null;
    Object.assign(job, { status: 'cancelled', current_stage: 'cancelled', finished_at: new Date().toISOString() });
    saveMemory();
    return publicJob(job);
  },

  async createAsset(jobId, asset, courseId = null) {
    const record = {
      id: generateId('asset'),
      job_id: jobId,
      course_id: courseId,
      asset_type: asset.type,
      path: asset.storageKey || asset.url,
      mime_type: asset.mimeType || 'application/octet-stream',
      size_bytes: Number(asset.sizeBytes || 0),
      metadata_json: asset.metadata || {},
      created_at: new Date().toISOString()
    };
    if (useMysql) {
      await pool.execute(
        `INSERT INTO course_assets (id,job_id,course_id,asset_type,path,mime_type,size_bytes,metadata_json,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [record.id, record.job_id, record.course_id, record.asset_type, record.path, record.mime_type,
          record.size_bytes, JSON.stringify(record.metadata_json), new Date()]
      );
      return record;
    }
    refreshMemory();
    const duplicate = memory.assets.find(x => x.job_id === jobId && x.asset_type === record.asset_type && x.path === record.path);
    if (duplicate) return duplicate;
    memory.assets.push(record);
    saveMemory();
    return record;
  },

  async listAssets({ jobId = null, courseId = null } = {}) {
    if (useMysql) {
      let sql = 'SELECT * FROM course_assets WHERE 1=1';
      const params = [];
      if (jobId) { sql += ' AND job_id=?'; params.push(jobId); }
      if (courseId) { sql += ' AND course_id=?'; params.push(courseId); }
      sql += ' ORDER BY created_at ASC';
      const [rows] = await pool.execute(sql, params);
      return rows.map(row => ({ ...row, metadata_json: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json }));
    }
    refreshMemory();
    return memory.assets.filter(asset => (!jobId || asset.job_id === jobId) && (!courseId || asset.course_id === courseId));
  },

  async getAsset(id) {
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM course_assets WHERE id=?', [id]);
      const row = rows[0];
      if (!row) return null;
      return { ...row, metadata_json: typeof row.metadata_json === 'string' ? JSON.parse(row.metadata_json) : row.metadata_json };
    }
    refreshMemory();
    return memory.assets.find(asset => asset.id === id) || null;
  },

  async createReview({ courseId, reviewerId, reviewerRole = null, action, comment = '', subjectScope = null }) {
    const review = {
      id: generateId('review'),
      course_id: courseId,
      reviewer_id: reviewerId,
      reviewer_role: reviewerRole ? normalizeRole(reviewerRole) : null,
      action,
      comment: String(comment || '').slice(0, 2000),
      subject_scope: subjectScope || null,
      created_at: new Date().toISOString()
    };
    if (useMysql) {
      await pool.execute(
        'INSERT INTO course_reviews (id,course_id,reviewer_id,reviewer_role,action,comment,subject_scope,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [review.id, review.course_id, review.reviewer_id, review.reviewer_role, review.action, review.comment, review.subject_scope, new Date()]
      );
      return review;
    }
    refreshMemory();
    memory.reviews.push(review);
    saveMemory();
    return review;
  },

  async listReviewsByReviewer(reviewerId, { page = 1, limit = 50 } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const offset = (safePage - 1) * safeLimit;
    if (useMysql) {
      const [rows] = await pool.execute(
        `SELECT r.*, c.title, c.topic, c.subject, c.grade, c.publish_status, u.nickname AS authorName
         FROM course_reviews r
         LEFT JOIN courses c ON c.id = r.course_id
         LEFT JOIN users u ON u.id = c.user_id
         WHERE r.reviewer_id=?
         ORDER BY r.created_at DESC
         LIMIT ${safeLimit} OFFSET ${offset}`,
        [reviewerId]
      );
      return rows;
    }
    refreshMemory();
    return memory.reviews
      .filter(r => r.reviewer_id === reviewerId)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(offset, offset + safeLimit)
      .map(r => {
        const course = memory.courses.find(c => c.id === r.course_id) || {};
        const author = memory.users.find(u => u.id === course.user_id);
        return {
          ...r,
          title: course.title,
          topic: course.topic,
          subject: course.subject,
          grade: course.grade,
          publish_status: course.publish_status,
          authorName: author?.nickname || course.authorName || '用户'
        };
      });
  },

  async listTeacherPendingCourses(teacher, { subject = null, grade = null, query = null, page = 1, limit = 50 } = {}) {
    const subjects = parseTeacherSubjects(teacher?.teacher_subjects_json ?? teacher?.teacherSubjects);
    if (!subjects.length) return [];
    const filteredSubjects = subject ? subjects.filter(s => s === subject) : subjects;
    if (!filteredSubjects.length) return [];
    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const offset = (safePage - 1) * safeLimit;

    if (useMysql) {
      const placeholders = filteredSubjects.map(() => '?').join(',');
      let sql = `
        SELECT c.*, u.nickname AS authorName, u.role AS authorRole
        FROM courses c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.publish_status='pending'
          AND c.subject IN (${placeholders})
          AND COALESCE(c.author_role_snapshot, u.role, 'student') = 'student'
      `;
      const params = [...filteredSubjects];
      if (grade) { sql += ' AND c.grade=?'; params.push(grade); }
      if (query) { sql += ' AND (c.title LIKE ? OR c.topic LIKE ?)'; params.push(`%${query}%`, `%${query}%`); }
      sql += ` ORDER BY c.updated_at DESC LIMIT ${safeLimit} OFFSET ${offset}`;
      const [rows] = await pool.execute(sql, params);
      return rows.map(publicCourse);
    }

    refreshMemory();
    return memory.courses
      .filter(c => {
        if (c.publish_status !== 'pending') return false;
        if (!filteredSubjects.includes(c.subject)) return false;
        const author = memory.users.find(u => u.id === c.user_id);
        const authorRole = normalizeRole(c.author_role_snapshot || author?.role || ROLES.STUDENT);
        if (authorRole !== ROLES.STUDENT) return false;
        if (grade && c.grade !== grade) return false;
        if (query && !`${c.title} ${c.topic}`.toLowerCase().includes(String(query).toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
      .slice(offset, offset + safeLimit)
      .map(c => {
        const author = memory.users.find(u => u.id === c.user_id);
        return publicCourse({ ...c, authorName: author?.nickname || c.authorName || '用户', authorRole: normalizeRole(c.author_role_snapshot || author?.role) });
      });
  },

  async listAdminPendingCourses({ grade = null, query = null, subject = null, page = 1, limit = 50 } = {}) {
    // Admin sees all pending: student + teacher works. Fallback is implicit (full queue).
    return this.listCourses({
      publishStatus: 'pending',
      subject,
      grade,
      query,
      page,
      limit,
      includeAuthorRole: true
    });
  },

  async hasActiveTeacherForSubject(subject) {
    if (!subject) return false;
    if (useMysql) {
      const [rows] = await pool.execute(
        `SELECT id, teacher_subjects_json FROM users WHERE role='teacher' AND status='active'`
      );
      return rows.some(row => parseTeacherSubjects(row.teacher_subjects_json).includes(subject));
    }
    refreshMemory();
    return memory.users.some(u =>
      normalizeRole(u.role) === ROLES.TEACHER
      && (u.status || 'active') === 'active'
      && parseTeacherSubjects(u.teacher_subjects_json).includes(subject)
    );
  },

  async getCourseWithAuthor(id) {
    if (useMysql) {
      const [rows] = await pool.execute(
        `SELECT c.*, u.nickname AS authorName, u.role AS authorRole
         FROM courses c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=?`,
        [id]
      );
      if (!rows[0]) return null;
      const row = rows[0];
      return {
        ...publicCourse(row),
        authorRole: normalizeRole(row.author_role_snapshot || row.authorRole || ROLES.STUDENT),
        author_role_snapshot: row.author_role_snapshot || null
      };
    }
    refreshMemory();
    const course = memory.courses.find(c => c.id === id);
    if (!course) return null;
    const author = memory.users.find(u => u.id === course.user_id);
    return {
      ...publicCourse({ ...course, authorName: author?.nickname || course.authorName || '用户' }),
      authorRole: normalizeRole(course.author_role_snapshot || author?.role || ROLES.STUDENT),
      author_role_snapshot: course.author_role_snapshot || null
    };
  },


  async createCourseFromJob(job, extra = {}) {
    const input = job.input_json || job.input || {};
    const now = new Date().toISOString();
    const author = await this.findUserById(job.user_id);
    const authorRole = normalizeRole(extra.authorRole || author?.role || ROLES.STUDENT);
    const course = {
      id: generateId('course'),
      user_id: job.user_id,
      subject: input.subject || job.subject,
      grade: input.grade || job.grade,
      chapter: input.chapter || job.chapter,
      title: extra.title || `${input.topic || job.topic} 教学视频`,
      topic: input.topic || job.topic,
      summary: extra.summary || `基于 ai-teaching-media 自动生成：${input.topic || job.topic}`,
      visibility: 'private',
      publish_status: 'draft',
      author_role_snapshot: authorRole,
      cover_url: job.cover_url || job.coverUrl || null,
      video_url: job.video_url || job.videoUrl || null,
      duration_sec: extra.duration_sec || null,
      view_count: 0,
      source_job_id: job.id,
      authorName: extra.authorName || author?.nickname || '用户',
      created_at: now,
      updated_at: now
    };
    if (useMysql) {
      await pool.execute(
        `INSERT INTO courses
        (id,user_id,subject,grade,chapter,title,topic,summary,visibility,publish_status,author_role_snapshot,cover_url,video_url,duration_sec,view_count,source_job_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [course.id, course.user_id, course.subject, course.grade, course.chapter, course.title, course.topic, course.summary,
          course.visibility, course.publish_status, course.author_role_snapshot, course.cover_url, course.video_url, course.duration_sec, 0, course.source_job_id, new Date(), new Date()]
      );
      await this.updateJob(job.id, { result_course_id: course.id });
      await pool.execute('UPDATE course_assets SET course_id=? WHERE job_id=?', [course.id, job.id]);
      return publicCourse(course);
    }
    refreshMemory();
    memory.courses.unshift(course);
    const storedJob = memory.jobs.find(item => item.id === job.id);
    if (storedJob) storedJob.result_course_id = course.id;
    memory.assets.forEach(asset => { if (asset.job_id === job.id) asset.course_id = course.id; });
    saveMemory();
    return publicCourse(course);
  },

  async deleteCourse(courseId) {
    if (!courseId) return null;
    if (useMysql) {
      const course = await this.getCourse(courseId);
      if (!course) return null;
      // detach job linkage first (keep jobs/history, drop course reference)
      await pool.execute('UPDATE generation_jobs SET result_course_id=NULL WHERE result_course_id=?', [courseId]);
      await pool.execute('DELETE FROM course_reviews WHERE course_id=?', [courseId]);
      await pool.execute('DELETE FROM course_assets WHERE course_id=?', [courseId]);
      await pool.execute('DELETE FROM courses WHERE id=?', [courseId]);
      return course;
    }
    refreshMemory();
    const idx = memory.courses.findIndex(c => c.id === courseId);
    if (idx < 0) return null;
    const [course] = memory.courses.splice(idx, 1);
    memory.reviews = memory.reviews.filter(r => r.course_id !== courseId);
    memory.assets = memory.assets.filter(a => a.course_id !== courseId);
    memory.jobs.forEach(job => {
      if (job.result_course_id === courseId) job.result_course_id = null;
    });
    saveMemory();
    return publicCourse(course);
  },

  async listCourses({ publicOnly = false, userId = null, publishStatus = null, subject = null, grade = null, query = null, includeAuthorRole = false, page = 1, limit = 200 } = {}) {
    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 200));
    const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
    const offset = (safePage - 1) * safeLimit;
    if (useMysql) {
      let sql = 'SELECT c.*, u.nickname AS authorName, u.role AS authorRole FROM courses c LEFT JOIN users u ON u.id=c.user_id WHERE 1=1';
      const params = [];
      if (publicOnly) {
        sql += ` AND c.visibility='public' AND c.publish_status='approved'`;
      }
      if (userId) {
        sql += ' AND c.user_id=?';
        params.push(userId);
      }
      if (publishStatus) {
        sql += ' AND c.publish_status=?';
        params.push(publishStatus);
      }
      if (subject) { sql += ' AND c.subject=?'; params.push(subject); }
      if (grade) { sql += ' AND c.grade=?'; params.push(grade); }
      if (query) { sql += ' AND (c.title LIKE ? OR c.topic LIKE ?)'; params.push(`%${query}%`, `%${query}%`); }
      sql += ` ORDER BY c.created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`;
      const [rows] = await pool.execute(sql, params);
      return rows.map(row => {
        const base = publicCourse(row);
        if (!includeAuthorRole) return base;
        return {
          ...base,
          authorRole: normalizeRole(row.author_role_snapshot || row.authorRole || ROLES.STUDENT),
          needsAdminFallback: normalizeRole(row.author_role_snapshot || row.authorRole) === ROLES.STUDENT
            ? null
            : false
        };
      });
    }
    refreshMemory();
    return memory.courses.filter(c => {
      if (publicOnly && !(c.visibility === 'public' && c.publish_status === 'approved')) return false;
      if (userId && c.user_id !== userId) return false;
      if (publishStatus && c.publish_status !== publishStatus) return false;
      if (subject && c.subject !== subject) return false;
      if (grade && c.grade !== grade) return false;
      if (query && !`${c.title} ${c.topic}`.toLowerCase().includes(String(query).toLowerCase())) return false;
      return true;
    }).slice(offset, offset + safeLimit).map(c => {
      const author = memory.users.find(u => u.id === c.user_id);
      const base = publicCourse({ ...c, authorName: author?.nickname || c.authorName || '用户' });
      if (!includeAuthorRole) return base;
      return {
        ...base,
        authorRole: normalizeRole(c.author_role_snapshot || author?.role || ROLES.STUDENT)
      };
    });
  },

  async getCourse(id) {
    if (useMysql) {
      const [rows] = await pool.execute(
        'SELECT c.*, u.nickname AS authorName FROM courses c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=?',
        [id]
      );
      return rows[0] ? publicCourse(rows[0]) : null;
    }
    refreshMemory();
    const course = memory.courses.find(c => c.id === id);
    return course ? publicCourse(course) : null;
  },

  async updateCourse(id, patch) {
    if (useMysql) {
      const fields = [];
      const values = [];
      for (const [k, v] of Object.entries(patch)) {
        const col = toSnake(k);
        fields.push(`${col}=?`);
        values.push(MYSQL_DATE_FIELDS.has(col) ? toMysqlDate(v) : v);
      }
      fields.push('updated_at=?');
      values.push(new Date());
      values.push(id);
      await pool.execute(`UPDATE courses SET ${fields.join(',')} WHERE id=?`, values);
      return this.getCourse(id);
    }
    refreshMemory();
    const c = memory.courses.find(x => x.id === id);
    if (!c) return null;
    Object.assign(c, patch, { updated_at: new Date().toISOString() });
    saveMemory();
    return publicCourse(c);
  },

  async stats() {
    if (useMysql) {
      const [[users]] = await pool.query('SELECT COUNT(*) AS c FROM users');
      const [[jobs]] = await pool.query('SELECT COUNT(*) AS c FROM generation_jobs');
      const [[running]] = await pool.query(`SELECT COUNT(*) AS c FROM generation_jobs WHERE status='running'`);
      const [[courses]] = await pool.query('SELECT COUNT(*) AS c FROM courses');
      const [[pending]] = await pool.query(`SELECT COUNT(*) AS c FROM courses WHERE publish_status='pending'`);
      return {
        users: users.c,
        jobs: jobs.c,
        runningJobs: running.c,
        courses: courses.c,
        pendingReviews: pending.c
      };
    }
    refreshMemory();
    return {
      users: memory.users.length,
      jobs: memory.jobs.length,
      runningJobs: memory.jobs.filter(j => j.status === 'running').length,
      courses: memory.courses.length,
      pendingReviews: memory.courses.filter(c => c.publish_status === 'pending').length
    };
  },

  async getUserModelSettings(userId) {
    if (!userId) return null;
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM user_model_settings WHERE user_id=?', [userId]);
      return rows[0] || null;
    }
    refreshMemory();
    return memory.user_model_settings?.[userId] || null;
  },

  async upsertUserModelSettings(userId, settings = {}) {
    if (!userId) throw new Error('userId 必填');
    const now = new Date().toISOString();
    const {
      tts_enabled = 0,
      tts_provider = null,
      tts_voice = null,
      tts_speed = null,
      image_enabled = 0,
      image_provider = null,
      image_style = null,
      image_aspect_ratio = null,
      video_enabled = 0,
      video_provider = null,
      video_quality = null,
      video_fps = null,
      preferred_output_profile = null,
      extra_json = null
    } = settings;

    if (useMysql) {
      await pool.execute(
        `INSERT INTO user_model_settings (
          user_id, tts_enabled, tts_provider, tts_voice, tts_speed,
          image_enabled, image_provider, image_style, image_aspect_ratio,
          video_enabled, video_provider, video_quality, video_fps,
          preferred_output_profile, extra_json, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          tts_enabled=VALUES(tts_enabled),
          tts_provider=VALUES(tts_provider),
          tts_voice=VALUES(tts_voice),
          tts_speed=VALUES(tts_speed),
          image_enabled=VALUES(image_enabled),
          image_provider=VALUES(image_provider),
          image_style=VALUES(image_style),
          image_aspect_ratio=VALUES(image_aspect_ratio),
          video_enabled=VALUES(video_enabled),
          video_provider=VALUES(video_provider),
          video_quality=VALUES(video_quality),
          video_fps=VALUES(video_fps),
          preferred_output_profile=VALUES(preferred_output_profile),
          extra_json=VALUES(extra_json),
          updated_at=VALUES(updated_at)`,
        [
          userId,
          tts_enabled ? 1 : 0,
          tts_provider,
          tts_voice,
          tts_speed,
          image_enabled ? 1 : 0,
          image_provider,
          image_style,
          image_aspect_ratio,
          video_enabled ? 1 : 0,
          video_provider,
          video_quality,
          video_fps,
          preferred_output_profile,
          extra_json == null ? null : JSON.stringify(extra_json),
          new Date(now),
          new Date(now)
        ]
      );
      return this.getUserModelSettings(userId);
    }

    refreshMemory();
    memory.user_model_settings[userId] = {
      user_id: userId,
      tts_enabled: tts_enabled ? 1 : 0,
      tts_provider,
      tts_voice,
      tts_speed,
      image_enabled: image_enabled ? 1 : 0,
      image_provider,
      image_style,
      image_aspect_ratio,
      video_enabled: video_enabled ? 1 : 0,
      video_provider,
      video_quality,
      video_fps,
      preferred_output_profile,
      extra_json,
      created_at: memory.user_model_settings[userId]?.created_at || now,
      updated_at: now
    };
    saveMemory();
    return memory.user_model_settings[userId];
  },

  async resetUserModelSettings(userId) {
    if (!userId) throw new Error('userId 必填');
    if (useMysql) {
      await pool.execute('DELETE FROM user_model_settings WHERE user_id=?', [userId]);
      return null;
    }
    refreshMemory();
    if (memory.user_model_settings?.[userId]) {
      delete memory.user_model_settings[userId];
      saveMemory();
    }
    return null;
  },


  async listSubjects({ includeDisabled = false } = {}) {
    if (useMysql) {
      const sql = includeDisabled
        ? 'SELECT * FROM subjects ORDER BY sort_order ASC, code ASC'
        : 'SELECT * FROM subjects WHERE enabled=1 ORDER BY sort_order ASC, code ASC';
      const [rows] = await pool.execute(sql);
      return rows.map(publicSubject);
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    return memory.subjects
      .filter((s) => includeDisabled || s.enabled !== false)
      .sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
      .map(publicSubject);
  },

  async upsertSubject(input = {}) {
    const checked = normalizeSubjectRecord(input, { partial: false });
    if (!checked.ok) throw new Error(checked.error);
    const now = new Date().toISOString();
    const row = {
      code: checked.subject.code,
      name: checked.subject.name,
      sort_order: checked.subject.sort_order,
      enabled: checked.subject.enabled !== false,
      created_at: now,
      updated_at: now
    };
    if (useMysql) {
      const [existing] = await pool.execute('SELECT code, created_at FROM subjects WHERE code=?', [row.code]);
      if (existing.length) {
        await pool.execute(
          'UPDATE subjects SET name=?, sort_order=?, enabled=?, updated_at=? WHERE code=?',
          [row.name, row.sort_order, row.enabled ? 1 : 0, new Date(), row.code]
        );
        row.created_at = existing[0].created_at;
      } else {
        await pool.execute(
          'INSERT INTO subjects (code,name,sort_order,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?)',
          [row.code, row.name, row.sort_order, row.enabled ? 1 : 0, new Date(), new Date()]
        );
      }
      const [rows] = await pool.execute('SELECT * FROM subjects WHERE code=?', [row.code]);
      return publicSubject(rows[0]);
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    const idx = memory.subjects.findIndex((s) => s.code === row.code);
    if (idx >= 0) {
      row.created_at = memory.subjects[idx].created_at;
      memory.subjects[idx] = { ...memory.subjects[idx], ...row, updated_at: now };
    } else {
      memory.subjects.push(row);
    }
    saveMemory();
    return publicSubject(memory.subjects.find((s) => s.code === row.code));
  },

  async updateSubject(code, patch = {}) {
    const subjectCode = String(code || '').trim().toLowerCase();
    if (!subjectCode) throw new Error('缺少学科 code');
    const checked = normalizeSubjectRecord({ ...patch, code: subjectCode }, { partial: true });
    if (!checked.ok) throw new Error(checked.error);
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM subjects WHERE code=?', [subjectCode]);
      if (!rows.length) throw new Error('学科不存在');
      const current = rows[0];
      const next = {
        name: checked.subject.name ?? current.name,
        sort_order: patch.sortOrder != null || patch.sort_order != null ? checked.subject.sort_order : current.sort_order,
        enabled: patch.enabled === undefined ? current.enabled : (checked.subject.enabled ? 1 : 0)
      };
      await pool.execute(
        'UPDATE subjects SET name=?, sort_order=?, enabled=?, updated_at=? WHERE code=?',
        [next.name, next.sort_order, next.enabled ? 1 : 0, new Date(), subjectCode]
      );
      const [updated] = await pool.execute('SELECT * FROM subjects WHERE code=?', [subjectCode]);
      return publicSubject(updated[0]);
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    const current = memory.subjects.find((s) => s.code === subjectCode);
    if (!current) throw new Error('学科不存在');
    if (checked.subject.name != null) current.name = checked.subject.name;
    if (patch.sortOrder != null || patch.sort_order != null) current.sort_order = checked.subject.sort_order;
    if (patch.enabled !== undefined) current.enabled = checked.subject.enabled !== false;
    current.updated_at = new Date().toISOString();
    saveMemory();
    return publicSubject(current);
  },

  async listKnowledgePoints({
    subject = null,
    grade = null,
    chapter = null,
    q = null,
    includeDisabled = false,
    limit = 200
  } = {}) {
    const lim = Math.max(1, Math.min(Number(limit) || 200, 500));
    if (useMysql) {
      let sql = 'SELECT * FROM knowledge_points WHERE 1=1';
      const params = [];
      if (!includeDisabled) { sql += ' AND enabled=1'; }
      if (subject) { sql += ' AND subject_code=?'; params.push(String(subject)); }
      if (grade) { sql += ' AND (grade_code=? OR grade_code IS NULL OR grade_code=\'\')'; params.push(String(grade)); }
      if (chapter) { sql += ' AND chapter=?'; params.push(String(chapter)); }
      if (q) {
        const like = `%${String(q)}%`;
        sql += ' AND (topic LIKE ? OR chapter LIKE ? OR summary LIKE ? OR CAST(keywords_json AS CHAR) LIKE ?)';
        params.push(like, like, like, like);
      }
      // mysql2 prepared statements can reject LIMIT ?; interpolate validated integer.
      sql += ` ORDER BY sort_order ASC, topic ASC LIMIT ${lim}`;
      const [rows] = await pool.execute(sql, params);
      return rows.map((row) => publicKnowledgePoint({ ...row, keywords: row.keywords_json, learning_goals: row.learning_goals_json }));
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    let rows = memory.knowledge_points.slice();
    if (!includeDisabled) rows = rows.filter((r) => r.enabled !== false);
    if (subject) rows = rows.filter((r) => r.subject_code === subject);
    if (grade) rows = rows.filter((r) => !r.grade_code || r.grade_code === grade);
    if (chapter) rows = rows.filter((r) => r.chapter === chapter);
    if (q) rows = rows.filter((r) => matchKnowledgeQuery(publicKnowledgePoint(r), q));
    rows.sort((a, b) => (a.sort_order - b.sort_order) || String(a.topic).localeCompare(String(b.topic), 'zh'));
    return rows.slice(0, lim).map(publicKnowledgePoint);
  },

  async listKnowledgeChapters({ subject = null, grade = null, q = null, includeDisabled = false } = {}) {
    const points = await this.listKnowledgePoints({ subject, grade, q, includeDisabled, limit: 500 });
    return groupChapters(points);
  },

  async getKnowledgePoint(id) {
    if (!id) return null;
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM knowledge_points WHERE id=?', [id]);
      if (!rows.length) return null;
      return publicKnowledgePoint({ ...rows[0], keywords: rows[0].keywords_json, learning_goals: rows[0].learning_goals_json });
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    const row = memory.knowledge_points.find((p) => p.id === id);
    return row ? publicKnowledgePoint(row) : null;
  },

  async createKnowledgePoint(input = {}) {
    const checked = normalizeKnowledgePointRecord(input, { partial: false });
    if (!checked.ok) throw new Error(checked.error);
    // subject must exist
    const subjects = await this.listSubjects({ includeDisabled: true });
    if (!subjects.find((s) => s.code === checked.point.subject_code)) {
      throw new Error('学科不存在，请先创建学科');
    }
    const now = new Date().toISOString();
    const row = {
      id: generateId('kp'),
      subject_code: checked.point.subject_code,
      grade_code: checked.point.grade_code,
      chapter: checked.point.chapter,
      topic: checked.point.topic,
      summary: checked.point.summary || '',
      keywords: checked.point.keywords || [],
      learning_goals: checked.point.learning_goals || [],
      animation_pack: checked.point.animation_pack || null,
      pack_key: checked.point.pack_key || null,
      sort_order: checked.point.sort_order,
      enabled: checked.point.enabled !== false,
      source: 'manual',
      created_at: now,
      updated_at: now
    };
    if (useMysql) {
      await pool.execute(
        `INSERT INTO knowledge_points
        (id,subject_code,grade_code,chapter,topic,summary,keywords_json,learning_goals_json,animation_pack,pack_key,sort_order,enabled,source,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          row.id, row.subject_code, row.grade_code, row.chapter, row.topic, row.summary,
          JSON.stringify(row.keywords), JSON.stringify(row.learning_goals || []), row.animation_pack, row.pack_key,
          row.sort_order, row.enabled ? 1 : 0, row.source, new Date(), new Date()
        ]
      );
      return this.getKnowledgePoint(row.id);
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    memory.knowledge_points.push(row);
    saveMemory();
    return publicKnowledgePoint(row);
  },

  async updateKnowledgePoint(id, patch = {}) {
    if (!id) throw new Error('缺少知识点 id');
    const checked = normalizeKnowledgePointRecord(patch, { partial: true });
    if (!checked.ok) throw new Error(checked.error);
    if (useMysql) {
      const [rows] = await pool.execute('SELECT * FROM knowledge_points WHERE id=?', [id]);
      if (!rows.length) throw new Error('知识点不存在');
      const current = rows[0];
      const next = {
        subject_code: checked.point.subject_code ?? current.subject_code,
        grade_code: patch.gradeCode !== undefined || patch.grade_code !== undefined || patch.grade !== undefined
          ? (checked.point.grade_code ?? null)
          : current.grade_code,
        chapter: checked.point.chapter ?? current.chapter,
        topic: checked.point.topic ?? current.topic,
        summary: patch.summary !== undefined ? (checked.point.summary || '') : (current.summary || ''),
        keywords_json: patch.keywords !== undefined ? JSON.stringify(checked.point.keywords || []) : current.keywords_json,
        learning_goals_json: (patch.learningGoals !== undefined || patch.learning_goals !== undefined)
          ? JSON.stringify(checked.point.learning_goals || [])
          : current.learning_goals_json,
        animation_pack: (patch.animationPack !== undefined || patch.animation_pack !== undefined)
          ? (checked.point.animation_pack || null)
          : current.animation_pack,
        pack_key: (patch.packKey !== undefined || patch.pack_key !== undefined)
          ? (checked.point.pack_key || null)
          : current.pack_key,
        sort_order: patch.sortOrder !== undefined || patch.sort_order !== undefined ? checked.point.sort_order : current.sort_order,
        enabled: patch.enabled === undefined ? current.enabled : (checked.point.enabled ? 1 : 0)
      };
      if (next.subject_code) {
        const subjects = await this.listSubjects({ includeDisabled: true });
        if (!subjects.find((s) => s.code === next.subject_code)) throw new Error('学科不存在');
      }
      await pool.execute(
        `UPDATE knowledge_points SET subject_code=?, grade_code=?, chapter=?, topic=?, summary=?, keywords_json=?, learning_goals_json=?, animation_pack=?, pack_key=?, sort_order=?, enabled=?, updated_at=? WHERE id=?`,
        [next.subject_code, next.grade_code, next.chapter, next.topic, next.summary, next.keywords_json, next.learning_goals_json, next.animation_pack, next.pack_key, next.sort_order, next.enabled ? 1 : 0, new Date(), id]
      );
      return this.getKnowledgePoint(id);
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    const current = memory.knowledge_points.find((p) => p.id === id);
    if (!current) throw new Error('知识点不存在');
    if (checked.point.subject_code) {
      const subjects = await this.listSubjects({ includeDisabled: true });
      if (!subjects.find((s) => s.code === checked.point.subject_code)) throw new Error('学科不存在');
      current.subject_code = checked.point.subject_code;
    }
    if (patch.gradeCode !== undefined || patch.grade_code !== undefined || patch.grade !== undefined) {
      current.grade_code = checked.point.grade_code ?? null;
    }
    if (checked.point.chapter != null) current.chapter = checked.point.chapter;
    if (checked.point.topic != null) current.topic = checked.point.topic;
    if (patch.summary !== undefined) current.summary = checked.point.summary || '';
    if (patch.keywords !== undefined) current.keywords = checked.point.keywords || [];
    if (patch.sortOrder !== undefined || patch.sort_order !== undefined) current.sort_order = checked.point.sort_order;
    if (patch.enabled !== undefined) current.enabled = checked.point.enabled !== false;
    current.updated_at = new Date().toISOString();
    saveMemory();
    return publicKnowledgePoint(current);
  },

  async deleteKnowledgePoint(id) {
    if (!id) throw new Error('缺少知识点 id');
    if (useMysql) {
      const [ret] = await pool.execute('DELETE FROM knowledge_points WHERE id=?', [id]);
      return { ok: true, deleted: ret.affectedRows || 0 };
    }
    refreshMemory();
    ensureMemoryKnowledgeCatalog();
    const before = memory.knowledge_points.length;
    memory.knowledge_points = memory.knowledge_points.filter((p) => p.id !== id);
    saveMemory();
    return { ok: true, deleted: before - memory.knowledge_points.length };
  },


  
  
  
  
  async syncJuniorHistoryKnowledge({ overwrite = true } = {}) {
    const packs = listJuniorHistoryKnowledgePoints();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items = [];
    for (const mapped of packs) {
      let existing = null;
      if (useMysql) {
        if (mapped.pack_key) {
          const [byPack] = await pool.execute('SELECT * FROM knowledge_points WHERE pack_key=? LIMIT 1', [mapped.pack_key]);
          existing = byPack[0] || null;
        }
        if (!existing) {
          const [byTopic] = await pool.execute(
            'SELECT * FROM knowledge_points WHERE subject_code=? AND topic=? LIMIT 1',
            [mapped.subject_code, mapped.topic]
          );
          existing = byTopic[0] || null;
        }
      } else {
        refreshMemory();
        ensureMemoryKnowledgeCatalog();
        existing = memory.knowledge_points.find((p) => p.pack_key && mapped.pack_key && p.pack_key === mapped.pack_key)
          || memory.knowledge_points.find((p) => p.subject_code === mapped.subject_code && p.topic === mapped.topic)
          || null;
      }
      const payload = {
        subjectCode: mapped.subject_code,
        gradeCode: mapped.grade_code,
        chapter: mapped.chapter,
        topic: mapped.topic,
        summary: mapped.summary,
        keywords: mapped.keywords || [],
        learningGoals: mapped.learning_goals || [],
        animationPack: mapped.animation_pack || 'generic',
        packKey: mapped.pack_key || null,
        sortOrder: mapped.sort_order,
        enabled: mapped.enabled !== false
      };
      if (!existing) {
        const row = await this.createKnowledgePoint(payload);
        if (useMysql) {
          await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_history', mapped.pack_key, new Date(), row.id]);
        } else {
          const mem = memory.knowledge_points.find((p) => p.id === row.id);
          if (mem) { mem.source = 'junior_history'; mem.pack_key = mapped.pack_key; saveMemory(); }
        }
        created += 1;
        items.push({ topic: mapped.topic, action: 'created', id: row.id });
        continue;
      }
      if (!overwrite) {
        skipped += 1;
        items.push({ topic: mapped.topic, action: 'skipped', id: existing.id });
        continue;
      }
      await this.updateKnowledgePoint(existing.id, payload);
      if (useMysql) {
        await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_history', mapped.pack_key, new Date(), existing.id]);
      } else {
        const mem = memory.knowledge_points.find((p) => p.id === existing.id);
        if (mem) { mem.source = 'junior_history'; mem.pack_key = mapped.pack_key; saveMemory(); }
      }
      updated += 1;
      items.push({ topic: mapped.topic, action: 'updated', id: existing.id });
    }
    return { total: packs.length, created, updated, skipped, items };
  },

  async syncJuniorGeographyKnowledge({ overwrite = true } = {}) {
    const packs = listJuniorGeographyKnowledgePoints();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items = [];
    for (const mapped of packs) {
      let existing = null;
      if (useMysql) {
        if (mapped.pack_key) {
          const [byPack] = await pool.execute('SELECT * FROM knowledge_points WHERE pack_key=? LIMIT 1', [mapped.pack_key]);
          existing = byPack[0] || null;
        }
        if (!existing) {
          const [byTopic] = await pool.execute(
            'SELECT * FROM knowledge_points WHERE subject_code=? AND topic=? LIMIT 1',
            [mapped.subject_code, mapped.topic]
          );
          existing = byTopic[0] || null;
        }
      } else {
        refreshMemory();
        ensureMemoryKnowledgeCatalog();
        existing = memory.knowledge_points.find((p) => p.pack_key && mapped.pack_key && p.pack_key === mapped.pack_key)
          || memory.knowledge_points.find((p) => p.subject_code === mapped.subject_code && p.topic === mapped.topic)
          || null;
      }
      const payload = {
        subjectCode: mapped.subject_code,
        gradeCode: mapped.grade_code,
        chapter: mapped.chapter,
        topic: mapped.topic,
        summary: mapped.summary,
        keywords: mapped.keywords || [],
        learningGoals: mapped.learning_goals || [],
        animationPack: mapped.animation_pack || 'generic',
        packKey: mapped.pack_key || null,
        sortOrder: mapped.sort_order,
        enabled: mapped.enabled !== false
      };
      if (!existing) {
        const row = await this.createKnowledgePoint(payload);
        if (useMysql) {
          await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_geography', mapped.pack_key, new Date(), row.id]);
        } else {
          const mem = memory.knowledge_points.find((p) => p.id === row.id);
          if (mem) { mem.source = 'junior_geography'; mem.pack_key = mapped.pack_key; saveMemory(); }
        }
        created += 1;
        items.push({ topic: mapped.topic, action: 'created', id: row.id });
        continue;
      }
      if (!overwrite) {
        skipped += 1;
        items.push({ topic: mapped.topic, action: 'skipped', id: existing.id });
        continue;
      }
      await this.updateKnowledgePoint(existing.id, payload);
      if (useMysql) {
        await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_geography', mapped.pack_key, new Date(), existing.id]);
      } else {
        const mem = memory.knowledge_points.find((p) => p.id === existing.id);
        if (mem) { mem.source = 'junior_geography'; mem.pack_key = mapped.pack_key; saveMemory(); }
      }
      updated += 1;
      items.push({ topic: mapped.topic, action: 'updated', id: existing.id });
    }
    return { total: packs.length, created, updated, skipped, items };
  },

  async syncJuniorPoliticsKnowledge({ overwrite = true } = {}) {
    const packs = listJuniorPoliticsKnowledgePoints();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items = [];
    for (const mapped of packs) {
      let existing = null;
      if (useMysql) {
        if (mapped.pack_key) {
          const [byPack] = await pool.execute('SELECT * FROM knowledge_points WHERE pack_key=? LIMIT 1', [mapped.pack_key]);
          existing = byPack[0] || null;
        }
        if (!existing) {
          const [byTopic] = await pool.execute(
            'SELECT * FROM knowledge_points WHERE subject_code=? AND topic=? LIMIT 1',
            [mapped.subject_code, mapped.topic]
          );
          existing = byTopic[0] || null;
        }
      } else {
        refreshMemory();
        ensureMemoryKnowledgeCatalog();
        existing = memory.knowledge_points.find((p) => p.pack_key && mapped.pack_key && p.pack_key === mapped.pack_key)
          || memory.knowledge_points.find((p) => p.subject_code === mapped.subject_code && p.topic === mapped.topic)
          || null;
      }
      const payload = {
        subjectCode: mapped.subject_code,
        gradeCode: mapped.grade_code,
        chapter: mapped.chapter,
        topic: mapped.topic,
        summary: mapped.summary,
        keywords: mapped.keywords || [],
        learningGoals: mapped.learning_goals || [],
        animationPack: mapped.animation_pack || 'generic',
        packKey: mapped.pack_key || null,
        sortOrder: mapped.sort_order,
        enabled: mapped.enabled !== false
      };
      if (!existing) {
        const row = await this.createKnowledgePoint(payload);
        if (useMysql) {
          await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_politics', mapped.pack_key, new Date(), row.id]);
        } else {
          const mem = memory.knowledge_points.find((p) => p.id === row.id);
          if (mem) { mem.source = 'junior_politics'; mem.pack_key = mapped.pack_key; saveMemory(); }
        }
        created += 1;
        items.push({ topic: mapped.topic, action: 'created', id: row.id });
        continue;
      }
      if (!overwrite) {
        skipped += 1;
        items.push({ topic: mapped.topic, action: 'skipped', id: existing.id });
        continue;
      }
      await this.updateKnowledgePoint(existing.id, payload);
      if (useMysql) {
        await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_politics', mapped.pack_key, new Date(), existing.id]);
      } else {
        const mem = memory.knowledge_points.find((p) => p.id === existing.id);
        if (mem) { mem.source = 'junior_politics'; mem.pack_key = mapped.pack_key; saveMemory(); }
      }
      updated += 1;
      items.push({ topic: mapped.topic, action: 'updated', id: existing.id });
    }
    return { total: packs.length, created, updated, skipped, items };
  },

  async syncJuniorEnglishKnowledge({ overwrite = true } = {}) {
    const packs = listJuniorEnglishKnowledgePoints();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items = [];
    for (const mapped of packs) {
      let existing = null;
      if (useMysql) {
        if (mapped.pack_key) {
          const [byPack] = await pool.execute('SELECT * FROM knowledge_points WHERE pack_key=? LIMIT 1', [mapped.pack_key]);
          existing = byPack[0] || null;
        }
        if (!existing) {
          const [byTopic] = await pool.execute(
            'SELECT * FROM knowledge_points WHERE subject_code=? AND topic=? LIMIT 1',
            [mapped.subject_code, mapped.topic]
          );
          existing = byTopic[0] || null;
        }
      } else {
        refreshMemory();
        ensureMemoryKnowledgeCatalog();
        existing = memory.knowledge_points.find((p) => p.pack_key && mapped.pack_key && p.pack_key === mapped.pack_key)
          || memory.knowledge_points.find((p) => p.subject_code === mapped.subject_code && p.topic === mapped.topic)
          || null;
      }
      const payload = {
        subjectCode: mapped.subject_code,
        gradeCode: mapped.grade_code,
        chapter: mapped.chapter,
        topic: mapped.topic,
        summary: mapped.summary,
        keywords: mapped.keywords || [],
        learningGoals: mapped.learning_goals || [],
        animationPack: mapped.animation_pack || 'generic',
        packKey: mapped.pack_key || null,
        sortOrder: mapped.sort_order,
        enabled: mapped.enabled !== false
      };
      if (!existing) {
        const row = await this.createKnowledgePoint(payload);
        if (useMysql) {
          await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_english', mapped.pack_key, new Date(), row.id]);
        } else {
          const mem = memory.knowledge_points.find((p) => p.id === row.id);
          if (mem) { mem.source = 'junior_english'; mem.pack_key = mapped.pack_key; saveMemory(); }
        }
        created += 1;
        items.push({ topic: mapped.topic, action: 'created', id: row.id });
        continue;
      }
      if (!overwrite) {
        skipped += 1;
        items.push({ topic: mapped.topic, action: 'skipped', id: existing.id });
        continue;
      }
      await this.updateKnowledgePoint(existing.id, payload);
      if (useMysql) {
        await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_english', mapped.pack_key, new Date(), existing.id]);
      } else {
        const mem = memory.knowledge_points.find((p) => p.id === existing.id);
        if (mem) { mem.source = 'junior_english'; mem.pack_key = mapped.pack_key; saveMemory(); }
      }
      updated += 1;
      items.push({ topic: mapped.topic, action: 'updated', id: existing.id });
    }
    return { total: packs.length, created, updated, skipped, items };
  },

  async syncJuniorChineseKnowledge({ overwrite = true } = {}) {
    const packs = listJuniorChineseKnowledgePoints();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items = [];
    for (const mapped of packs) {
      let existing = null;
      if (useMysql) {
        if (mapped.pack_key) {
          const [byPack] = await pool.execute('SELECT * FROM knowledge_points WHERE pack_key=? LIMIT 1', [mapped.pack_key]);
          existing = byPack[0] || null;
        }
        if (!existing) {
          const [byTopic] = await pool.execute(
            'SELECT * FROM knowledge_points WHERE subject_code=? AND topic=? LIMIT 1',
            [mapped.subject_code, mapped.topic]
          );
          existing = byTopic[0] || null;
        }
      } else {
        refreshMemory();
        ensureMemoryKnowledgeCatalog();
        existing = memory.knowledge_points.find((p) => p.pack_key && mapped.pack_key && p.pack_key === mapped.pack_key)
          || memory.knowledge_points.find((p) => p.subject_code === mapped.subject_code && p.topic === mapped.topic)
          || null;
      }
      const payload = {
        subjectCode: mapped.subject_code,
        gradeCode: mapped.grade_code,
        chapter: mapped.chapter,
        topic: mapped.topic,
        summary: mapped.summary,
        keywords: mapped.keywords || [],
        learningGoals: mapped.learning_goals || [],
        animationPack: mapped.animation_pack || 'generic',
        packKey: mapped.pack_key || null,
        sortOrder: mapped.sort_order,
        enabled: mapped.enabled !== false
      };
      if (!existing) {
        const row = await this.createKnowledgePoint(payload);
        if (useMysql) {
          await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_chinese', mapped.pack_key, new Date(), row.id]);
        } else {
          const mem = memory.knowledge_points.find((p) => p.id === row.id);
          if (mem) { mem.source = 'junior_chinese'; mem.pack_key = mapped.pack_key; saveMemory(); }
        }
        created += 1;
        items.push({ topic: mapped.topic, action: 'created', id: row.id });
        continue;
      }
      if (!overwrite) {
        skipped += 1;
        items.push({ topic: mapped.topic, action: 'skipped', id: existing.id });
        continue;
      }
      await this.updateKnowledgePoint(existing.id, payload);
      if (useMysql) {
        await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['junior_chinese', mapped.pack_key, new Date(), existing.id]);
      } else {
        const mem = memory.knowledge_points.find((p) => p.id === existing.id);
        if (mem) { mem.source = 'junior_chinese'; mem.pack_key = mapped.pack_key; saveMemory(); }
      }
      updated += 1;
      items.push({ topic: mapped.topic, action: 'updated', id: existing.id });
    }
    return { total: packs.length, created, updated, skipped, items };
  },

  async syncChemAIForgeKnowledge({ overwrite = true } = {}) {
    const packs = listChemAIForgeKnowledgePoints();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const items = [];
    for (const mapped of packs) {
      let existing = null;
      if (useMysql) {
        if (mapped.pack_key) {
          const [byPack] = await pool.execute('SELECT * FROM knowledge_points WHERE pack_key=? LIMIT 1', [mapped.pack_key]);
          existing = byPack[0] || null;
        }
        if (!existing) {
          const [byTopic] = await pool.execute(
            'SELECT * FROM knowledge_points WHERE subject_code=? AND topic=? AND chapter=? LIMIT 1',
            [mapped.subject_code, mapped.topic, mapped.chapter]
          );
          existing = byTopic[0] || null;
        }
      } else {
        refreshMemory();
        ensureMemoryKnowledgeCatalog();
        existing = memory.knowledge_points.find((p) => p.pack_key && mapped.pack_key && p.pack_key === mapped.pack_key)
          || memory.knowledge_points.find((p) => p.subject_code === mapped.subject_code && p.topic === mapped.topic && p.chapter === mapped.chapter)
          || null;
      }
      const payload = {
        subjectCode: mapped.subject_code,
        gradeCode: mapped.grade_code,
        chapter: mapped.chapter,
        topic: mapped.topic,
        summary: mapped.summary,
        keywords: mapped.keywords || [],
        learningGoals: mapped.learning_goals || [],
        animationPack: mapped.animation_pack || 'chemistry',
        packKey: mapped.pack_key || null,
        sortOrder: mapped.sort_order,
        enabled: mapped.enabled !== false
      };
      if (!existing) {
        const row = await this.createKnowledgePoint(payload);
        // mark source
        if (useMysql) {
          await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['chemaiforge', mapped.pack_key, new Date(), row.id]);
        } else {
          const mem = memory.knowledge_points.find((p) => p.id === row.id);
          if (mem) { mem.source = 'chemaiforge'; mem.pack_key = mapped.pack_key; saveMemory(); }
        }
        created += 1;
        items.push({ topic: mapped.topic, action: 'created', id: row.id });
        continue;
      }
      if (!overwrite) {
        skipped += 1;
        items.push({ topic: mapped.topic, action: 'skipped', id: existing.id });
        continue;
      }
      const row = await this.updateKnowledgePoint(existing.id, payload);
      if (useMysql) {
        await pool.execute('UPDATE knowledge_points SET source=?, pack_key=?, updated_at=? WHERE id=?', ['chemaiforge', mapped.pack_key, new Date(), existing.id]);
      } else {
        const mem = memory.knowledge_points.find((p) => p.id === existing.id);
        if (mem) { mem.source = 'chemaiforge'; mem.pack_key = mapped.pack_key; saveMemory(); }
      }
      updated += 1;
      items.push({ topic: mapped.topic, action: 'updated', id: existing.id });
    }
    return { total: packs.length, created, updated, skipped, items };
  },

  async syncKnowledgePacks({ overwrite = true } = {}) {
    const packs = listKnowledgePacks();
    const summary = { total: packs.length, created: 0, updated: 0, skipped: 0, items: [] };
    for (const pack of packs) {
      const mapped = knowledgePackToCatalogPoint(pack);
      const subjects = await this.listSubjects({ includeDisabled: true });
      if (!subjects.find((s) => s.code === mapped.subject_code)) {
        const def = DEFAULT_SUBJECTS.find((s) => s.code === mapped.subject_code);
        await this.upsertSubject({
          code: mapped.subject_code,
          name: def?.name || mapped.subject_code,
          sortOrder: def?.sortOrder || 100,
          enabled: true
        });
      }

      let existing = null;
      if (useMysql) {
        const [byPack] = await pool.execute('SELECT * FROM knowledge_points WHERE pack_key=? LIMIT 1', [mapped.pack_key]);
        if (byPack.length) existing = byPack[0];
        if (!existing) {
          const [byTopic] = await pool.execute(
            'SELECT * FROM knowledge_points WHERE subject_code=? AND topic=? LIMIT 1',
            [mapped.subject_code, mapped.topic]
          );
          if (byTopic.length) existing = byTopic[0];
        }
      } else {
        refreshMemory();
        ensureMemoryKnowledgeCatalog();
        existing = memory.knowledge_points.find((p) => p.pack_key === mapped.pack_key)
          || memory.knowledge_points.find((p) => p.subject_code === mapped.subject_code && p.topic === mapped.topic)
          || null;
      }

      const payload = {
        subjectCode: mapped.subject_code,
        gradeCode: mapped.grade_code,
        chapter: mapped.chapter,
        topic: mapped.topic,
        summary: mapped.summary,
        keywords: mapped.keywords,
        learningGoals: mapped.learning_goals,
        animationPack: mapped.animation_pack,
        packKey: mapped.pack_key,
        sortOrder: mapped.sort_order,
        enabled: true
      };

      if (!existing) {
        const created = await this.createKnowledgePoint(payload);
        if (useMysql) {
          await pool.execute(
            'UPDATE knowledge_points SET source=?, pack_key=?, animation_pack=?, learning_goals_json=?, updated_at=? WHERE id=?',
            ['knowledge_pack', mapped.pack_key, mapped.animation_pack, JSON.stringify(mapped.learning_goals || []), new Date(), created.id]
          );
        } else {
          refreshMemory();
          const row = memory.knowledge_points.find((p) => p.id === created.id);
          if (row) {
            row.source = 'knowledge_pack';
            row.pack_key = mapped.pack_key;
            row.animation_pack = mapped.animation_pack;
            row.learning_goals = mapped.learning_goals || [];
            saveMemory();
          }
        }
        summary.created += 1;
        summary.items.push({ topic: mapped.topic, action: 'created', id: created.id });
        continue;
      }

      if (!overwrite) {
        summary.skipped += 1;
        summary.items.push({ topic: mapped.topic, action: 'skipped', id: existing.id });
        continue;
      }

      await this.updateKnowledgePoint(existing.id, payload);
      if (useMysql) {
        await pool.execute(
          'UPDATE knowledge_points SET source=?, pack_key=?, animation_pack=?, learning_goals_json=?, updated_at=? WHERE id=?',
          ['knowledge_pack', mapped.pack_key, mapped.animation_pack, JSON.stringify(mapped.learning_goals || []), new Date(), existing.id]
        );
      } else {
        refreshMemory();
        const row = memory.knowledge_points.find((p) => p.id === existing.id);
        if (row) {
          row.source = 'knowledge_pack';
          row.pack_key = mapped.pack_key;
          row.animation_pack = mapped.animation_pack;
          row.learning_goals = mapped.learning_goals || [];
          row.updated_at = new Date().toISOString();
          saveMemory();
        }
      }
      summary.updated += 1;
      summary.items.push({ topic: mapped.topic, action: 'updated', id: existing.id });
    }
    return summary;
  },

  async getConfig() {
    if (useMysql) {
      const [rows] = await pool.execute('SELECT config_key,value_json FROM system_config ORDER BY config_key');
      const defaults = {
        teaching_media_root: process.env.TEACHING_MEDIA_ROOT || '',
        default_tts_provider: process.env.DEFAULT_TTS_PROVIDER || 'edge',
        default_edge_voice: process.env.DEFAULT_EDGE_VOICE || 'zh-CN-XiaoxiaoNeural',
        default_seed_voice: process.env.DEFAULT_SEED_VOICE || process.env.SEED_TTS_VOICE || 'zh_female_vv_uranus_bigtts',
        default_image_provider: process.env.DEFAULT_IMAGE_PROVIDER || 'volcengine',
        default_video_provider: process.env.DEFAULT_VIDEO_PROVIDER || 'hyperframes',
        worker_concurrency: process.env.WORKER_CONCURRENCY || '1',
        hyperframes_quality: process.env.HYPERFRAMES_QUALITY || 'standard',
        'models.tts.allowlist': process.env.MODELS_TTS_ALLOWLIST || 'edge,minimax,seed,say',
        'models.image.allowlist': process.env.MODELS_IMAGE_ALLOWLIST || 'agnes,mulerun,apimart,atlascloud,volcengine',
        'models.video.allowlist': process.env.MODELS_VIDEO_ALLOWLIST || 'hyperframes',
        'models.catalog_version': process.env.MODELS_CATALOG_VERSION || '1'
      };
      return {
        ...defaults,
        ...Object.fromEntries(rows.map(row => {
          let value = row.value_json;
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch {
              // tolerate legacy plain-string rows
              value = value;
            }
          }
          return [row.config_key, value];
        }))
      };
    }
    refreshMemory();
    return { ...memory.config };
  },

  async updateConfig(patch = {}) {
    const allowed = new Set([
      'teaching_media_root',
      'default_tts_provider',
      'default_edge_voice',
      'default_seed_voice',
      'default_image_provider',
      'default_video_provider',
      'worker_concurrency',
      'hyperframes_quality',
      'models.tts.allowlist',
      'models.image.allowlist',
      'models.video.allowlist',
      'models.catalog_version'
    ]);
    const dottedKeys = new Set([
      'models.tts.allowlist',
      'models.image.allowlist',
      'models.video.allowlist',
      'models.catalog_version'
    ]);
    const alias = {
      models_tts_allowlist: 'models.tts.allowlist',
      models_image_allowlist: 'models.image.allowlist',
      models_video_allowlist: 'models.video.allowlist',
      models_catalog_version: 'models.catalog_version'
    };
    const normalized = {};
    for (const [rawKey, value] of Object.entries(patch || {})) {
      let key = String(rawKey);
      if (alias[key]) key = alias[key];
      else if (!dottedKeys.has(key) && !allowed.has(key)) key = toSnake(key);
      if (alias[key]) key = alias[key];
      normalized[key] = value;
    }
    for (const key of Object.keys(normalized)) {
      if (!allowed.has(key)) throw new Error(`不允许修改配置: ${key}`);
      const value = normalized[key];
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new Error(`配置值无效: ${key}`);
      }
    }
    if (useMysql) {
      for (const [key, value] of Object.entries(normalized)) {
        await pool.execute(
          `INSERT INTO system_config (config_key,value_json,updated_at) VALUES (?,?,?)
           ON DUPLICATE KEY UPDATE value_json=VALUES(value_json), updated_at=VALUES(updated_at)`,
          [key, JSON.stringify(value), new Date()]
        );
      }
      return this.getConfig();
    }
    refreshMemory();
    Object.assign(memory.config, normalized);
    saveMemory();
    return { ...memory.config };
  }
};


function toMysqlDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return value;
}

const MYSQL_DATE_FIELDS = new Set([
  'created_at', 'updated_at', 'started_at', 'finished_at'
]);

function publicJob(job) {
  return {
    id: job.id,
    user_id: job.user_id,
    status: job.status,
    progress: job.progress,
    currentStage: job.current_stage || job.currentStage,
    topic: job.topic || job.input_json?.topic,
    subject: job.subject || job.input_json?.subject,
    grade: job.grade || job.input_json?.grade,
    chapter: job.chapter || job.input_json?.chapter,
    outputProfile: job.output_profile || job.outputProfile,
    videoUrl: job.video_url || job.videoUrl,
    coverUrl: job.cover_url || job.coverUrl,
    errorMessage: job.error_message || job.errorMessage,
    input_json: job.input_json,
    work_dir: job.work_dir,
    result_course_id: job.result_course_id,
    createdAt: job.created_at || job.createdAt,
    updatedAt: job.updated_at || job.updatedAt
  };
}

function normalizeJobRow(row) {
  const input = typeof row.input_json === 'string' ? JSON.parse(row.input_json) : row.input_json;
  return publicJob({
    ...row,
    input_json: input,
    topic: input?.topic,
    subject: input?.subject,
    grade: input?.grade,
    chapter: input?.chapter
  });
}

function publicCourse(course) {
  const authorRole = course.authorRole || course.author_role || course.author_role_snapshot || null;
  return {
    ...course,
    authorName: course.authorName || course.author_name || '用户',
    authorRole: authorRole ? normalizeRole(authorRole) : undefined,
    authorRoleSnapshot: course.author_role_snapshot || course.authorRoleSnapshot || null,
    publishStatus: course.publish_status || course.publishStatus,
    coverUrl: course.cover_url || course.coverUrl,
    videoUrl: course.video_url || course.videoUrl,
    durationSec: course.duration_sec ?? course.durationSec,
    viewCount: course.view_count ?? course.viewCount ?? 0,
    createdAt: course.created_at || course.createdAt,
    updatedAt: course.updated_at || course.updatedAt
  };
}

function toSnake(key) {
  return key.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);
}

export default db;
