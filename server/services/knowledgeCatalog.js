/** Subject + knowledge-point catalog helpers */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SUBJECTS = Object.freeze([
  { code: 'chinese', name: '语文', sortOrder: 10 },
  { code: 'math', name: '数学', sortOrder: 20 },
  { code: 'english', name: '英语', sortOrder: 30 },
  { code: 'physics', name: '物理', sortOrder: 40 },
  { code: 'chemistry', name: '化学', sortOrder: 50 },
  { code: 'biology', name: '生物', sortOrder: 60 },
  { code: 'geography', name: '地理', sortOrder: 70 },
  { code: 'history', name: '历史', sortOrder: 80 },
  { code: 'politics', name: '政治', sortOrder: 90 }
]);

export const DEFAULT_GRADES = Object.freeze([
  { code: 'grade1', name: '一年级' },
  { code: 'grade2', name: '二年级' },
  { code: 'grade3', name: '三年级' },
  { code: 'grade4', name: '四年级' },
  { code: 'grade5', name: '五年级' },
  { code: 'grade6', name: '六年级' },
  { code: 'grade7', name: '初一' },
  { code: 'grade8', name: '初二' },
  { code: 'grade9', name: '初三' },
  { code: 'grade10', name: '高一' },
  { code: 'grade11', name: '高二' },
  { code: 'grade12', name: '高三' }
]);


/** 生成动画包 code：与 detectFamily / specialized assemblies 对齐 */
export const ANIMATION_PACK_OPTIONS = Object.freeze([
  { code: 'energy', name: '能量守恒动画包' },
  { code: 'sound', name: '声现象动画包' },
  { code: 'math', name: '数学示意动画包' },
  { code: 'light', name: '光学动画包' },
  { code: 'force', name: '力学/简单机械动画包' },
  { code: 'electric', name: '电路电学动画包' },
  { code: 'biology', name: '生物学动画包' },
  { code: 'chemistry', name: '化学动画包' },
  { code: 'geography', name: '地理动画包' },
  { code: 'history', name: '历史时间轴动画包' },
  { code: 'generic', name: '通用动画包' }
]);

export const ANIMATION_PACK_CODE_SET = new Set(ANIMATION_PACK_OPTIONS.map((x) => x.code));

const PACK_META = Object.freeze({
  能量守恒定律: { subjectCode: 'physics', gradeCode: 'grade8', chapter: '机械能与能量', animationPack: 'energy', sortOrder: 10 },
  声现象: { subjectCode: 'physics', gradeCode: 'grade8', chapter: '声现象', animationPack: 'sound', sortOrder: 20 },
  光的折射: { subjectCode: 'physics', gradeCode: 'grade8', chapter: '光现象', animationPack: 'light', sortOrder: 30 },
  凸透镜成像: { subjectCode: 'physics', gradeCode: 'grade8', chapter: '光现象', animationPack: 'light', sortOrder: 40 },
  杠杆: { subjectCode: 'physics', gradeCode: 'grade8', chapter: '简单机械', animationPack: 'force', sortOrder: 50 },
  滑轮: { subjectCode: 'physics', gradeCode: 'grade8', chapter: '简单机械', animationPack: 'force', sortOrder: 60 },
  欧姆定律: { subjectCode: 'physics', gradeCode: 'grade9', chapter: '欧姆定律与电路', animationPack: 'electric', sortOrder: 70 },
  并联电路: { subjectCode: 'physics', gradeCode: 'grade9', chapter: '欧姆定律与电路', animationPack: 'electric', sortOrder: 80 },
  质量守恒定律: { subjectCode: 'chemistry', gradeCode: 'grade9', chapter: '化学变化与守恒', animationPack: 'chemistry', sortOrder: 10 },
  燃烧与灭火: { subjectCode: 'chemistry', gradeCode: 'grade9', chapter: '燃烧与灭火', animationPack: 'chemistry', sortOrder: 20 },
  中和反应: { subjectCode: 'chemistry', gradeCode: 'grade9', chapter: '酸和碱', animationPack: 'chemistry', sortOrder: 30 },
  金属活动性顺序: { subjectCode: 'chemistry', gradeCode: 'grade9', chapter: '金属', animationPack: 'chemistry', sortOrder: 40 },
  水循环: { subjectCode: 'geography', gradeCode: 'grade7', chapter: '地球上的水', animationPack: 'geography', sortOrder: 10 },
  四季的形成: { subjectCode: 'geography', gradeCode: 'grade7', chapter: '地球运动', animationPack: 'geography', sortOrder: 20 },
  等高线: { subjectCode: 'geography', gradeCode: 'grade8', chapter: '地形图判读', animationPack: 'geography', sortOrder: 30 },
  影响气候的因素: { subjectCode: 'geography', gradeCode: 'grade8', chapter: '气候', animationPack: 'geography', sortOrder: 40 },
  鸦片战争: { subjectCode: 'history', gradeCode: 'grade8', chapter: '近代中国', animationPack: 'history', sortOrder: 10 },
  辛亥革命: { subjectCode: 'history', gradeCode: 'grade8', chapter: '近代中国', animationPack: 'history', sortOrder: 20 },
  五四运动: { subjectCode: 'history', gradeCode: 'grade8', chapter: '新民主主义革命', animationPack: 'history', sortOrder: 30 },
  勾股定理: { subjectCode: 'math', gradeCode: 'grade8', chapter: '勾股定理', animationPack: 'math', sortOrder: 10 },
  加减乘除可视化: { subjectCode: 'math', gradeCode: 'grade3', chapter: '数与运算', animationPack: 'math', sortOrder: 110 },
  分数可视化: { subjectCode: 'math', gradeCode: 'grade4', chapter: '分数', animationPack: 'math', sortOrder: 120 },
  基础几何图形: { subjectCode: 'math', gradeCode: 'grade3', chapter: '图形与几何', animationPack: 'math', sortOrder: 130 },
  集合论可视化: { subjectCode: 'math', gradeCode: 'grade5', chapter: '集合与逻辑', animationPack: 'math', sortOrder: 140 },
  黄金分割: { subjectCode: 'math', gradeCode: 'grade6', chapter: '比例与美', animationPack: 'math', sortOrder: 150 },
  数论探索: { subjectCode: 'math', gradeCode: 'grade6', chapter: '数的性质', animationPack: 'math', sortOrder: 160 },
  一次函数: { subjectCode: 'math', gradeCode: 'grade8', chapter: '一次函数', animationPack: 'math', sortOrder: 210 },
  二次函数: { subjectCode: 'math', gradeCode: 'grade9', chapter: '二次函数', animationPack: 'math', sortOrder: 220 },
  三角函数: { subjectCode: 'math', gradeCode: 'grade9', chapter: '三角函数', animationPack: 'math', sortOrder: 230 },
  极坐标图形: { subjectCode: 'math', gradeCode: 'grade9', chapter: '极坐标', animationPack: 'math', sortOrder: 240 },
  概率分布: { subjectCode: 'math', gradeCode: 'grade9', chapter: '概率统计', animationPack: 'math', sortOrder: 250 },
  贝塞尔曲线: { subjectCode: 'math', gradeCode: 'grade9', chapter: '曲线与参数', animationPack: 'math', sortOrder: 260 },
  蒙特卡洛方法: { subjectCode: 'math', gradeCode: 'grade9', chapter: '概率模拟', animationPack: 'math', sortOrder: 270 },
  光合作用: { subjectCode: 'biology', gradeCode: 'grade7', chapter: '绿色植物', animationPack: 'biology', sortOrder: 10 }
});

export function inferAnimationPack({ subjectCode, topic, pack } = {}) {
  if (pack?.animationPack && ANIMATION_PACK_CODE_SET.has(pack.animationPack)) return pack.animationPack;
  const meta = PACK_META[String(topic || '').trim()];
  if (meta?.animationPack) return meta.animationPack;
  const subject = String(subjectCode || pack?.subjectHint || '').toLowerCase();
  const map = {
    physics: 'energy',
    chemistry: 'chemistry',
    biology: 'biology',
    geography: 'geography',
    history: 'history',
    math: 'math',
    chinese: 'generic',
    english: 'generic',
    politics: 'generic'
  };
  // better physics inference
  const t = `${topic || ''} ${pack?.definition || ''}`;
  if (subject === 'physics') {
    if (/光|透镜|折射|反射|色散/.test(t)) return 'light';
    if (/电|电路|欧姆|并联|串联|电流|电压/.test(t)) return 'electric';
    if (/力|杠杆|滑轮|摩擦/.test(t)) return 'force';
    if (/声|振动|音调|响度/.test(t)) return 'sound';
    if (/能量|守恒|动能|势能/.test(t)) return 'energy';
    return 'force';
  }
  return map[subject] || 'generic';
}

export function knowledgePackToCatalogPoint(pack, { existingId = null } = {}) {
  const key = pack.key || pack.topic || '';
  const meta = PACK_META[key] || {};
  const subjectCode = meta.subjectCode || pack.subjectHint || 'physics';
  const learningGoals = [];
  if (Array.isArray(pack.summaryPoints)) learningGoals.push(...pack.summaryPoints);
  if (Array.isArray(pack.subconcepts)) {
    for (const sc of pack.subconcepts.slice(0, 3)) {
      if (sc?.title) learningGoals.push(`理解${sc.title}`);
    }
  }
  const keywords = [];
  if (Array.isArray(pack.badges)) keywords.push(...pack.badges);
  if (Array.isArray(pack.keyNumbers)) keywords.push(...pack.keyNumbers.map(String));
  keywords.push(key);
  return {
    id: existingId,
    subject_code: subjectCode,
    grade_code: meta.gradeCode || null,
    chapter: meta.chapter || key,
    topic: key,
    summary: String(pack.definition || '').slice(0, 300),
    keywords: [...new Set(keywords.map((k) => String(k || '').trim()).filter(Boolean))].slice(0, 20),
    learning_goals: [...new Set(learningGoals.map((g) => String(g || '').trim()).filter(Boolean))].slice(0, 8),
    animation_pack: inferAnimationPack({ subjectCode, topic: key, pack }),
    sort_order: meta.sortOrder || 100,
    enabled: true,
    source: 'knowledge_pack',
    pack_key: key
  };
}

/** Seed knowledge points used for generate form defaults and admin bootstrap. */
export function defaultKnowledgePoints() {
  const now = new Date().toISOString();
  const rows = [
    // physics
    ['physics', 'grade8', '机械能与能量', '能量守恒定律', '能量不生不灭，只转化或转移', ['守恒', '转化', '转移'], 10],
    ['physics', 'grade8', '声现象', '声现象', '振动发声、介质传播、音调响度音色', ['振动', '声波'], 20],
    ['physics', 'grade8', '光现象', '光的折射', '光从一种介质斜射入另一种介质时传播方向改变', ['折射', '法线'], 30],
    ['physics', 'grade8', '光现象', '凸透镜成像', '物距与焦距关系决定像的性质', ['焦点', '实像', '虚像'], 40],
    ['physics', 'grade8', '简单机械', '杠杆', '在力的作用下能绕固定点转动的硬棒', ['支点', '力臂'], 50],
    ['physics', 'grade8', '简单机械', '滑轮', '定滑轮改变方向，动滑轮省力', ['定滑轮', '动滑轮'], 60],
    ['physics', 'grade9', '欧姆定律与电路', '欧姆定律', '同一导体中电流与电压成正比、与电阻成反比', ['I=U/R'], 70],
    ['physics', 'grade9', '欧姆定律与电路', '并联电路', '多路径，电流分流、电压相等', ['支路', '干路'], 80],
    // chemistry
    ['chemistry', 'grade9', '化学变化与守恒', '质量守恒定律', '反应前后总质量相等，原子重新组合', ['m前=m后', '原子'], 10],
    ['chemistry', 'grade9', '燃烧与灭火', '燃烧与灭火', '燃烧三要素：可燃物、氧气、着火点', ['可燃物', '着火点'], 20],
    ['chemistry', 'grade9', '酸和碱', '中和反应', '酸与碱生成盐和水，实质 H⁺+OH⁻=H₂O', ['中和', '指示剂'], 30],
    ['chemistry', 'grade9', '金属', '金属活动性顺序', '前强后弱，可判断置换与酸反应', ['置换', '氢前'], 40],
    // geography
    ['geography', 'grade7', '地球上的水', '水循环', '蒸发、凝结、降水、径流的循环过程', ['蒸发', '降水'], 10],
    ['geography', 'grade7', '地球运动', '四季的形成', '公转与地轴倾斜导致四季更替', ['公转', '直射点'], 20],
    ['geography', 'grade8', '地形图判读', '等高线', '同线同高，密陡疏缓', ['等高距', '山顶'], 30],
    ['geography', 'grade8', '气候', '影响气候的因素', '纬度、海陆、地形等共同影响气候', ['纬度', '海陆', '地形'], 40],
    // history
    ['history', 'grade8', '近代中国', '鸦片战争', '1840—1842，南京条约，社会性质开始变化', ['1840', '南京条约'], 10],
    ['history', 'grade8', '近代中国', '辛亥革命', '1911 武昌起义，结束帝制建立民国', ['1911', '共和'], 20],
    ['history', 'grade8', '新民主主义革命', '五四运动', '1919 彻底反帝反封建，新民主主义开端', ['1919', '巴黎和会'], 30],
    // math / biology existing packs
    ['math', 'grade8', '勾股定理', '勾股定理', '直角三角形两直角边平方和等于斜边平方', ['a²+b²=c²'], 10],
    // mathviz 第一批：入门级（小学 6-12 岁）
    ['math', 'grade3', '数与运算', '加减乘除可视化', '用图形理解加、减、乘、除的意义与运算关系', ['加减乘除', '四则运算', '可视化', 'mathviz'], 110],
    ['math', 'grade4', '分数', '分数可视化', '用饼图、条形图理解分数的意义、比较与运算', ['分数', '饼图', '条形图', 'mathviz'], 120],
    ['math', 'grade3', '图形与几何', '基础几何图形', '认识常见平面图形，理解周长与面积的计算思路', ['几何', '周长', '面积', 'mathviz'], 130],
    ['math', 'grade5', '集合与逻辑', '集合论可视化', '用韦恩图理解集合、交集、并集与补集', ['集合', '韦恩图', '交集', '并集', 'mathviz'], 140],
    ['math', 'grade6', '比例与美', '黄金分割', '认识黄金分割比、斐波那契数列与黄金螺线', ['黄金分割', '斐波那契', '比例', 'mathviz'], 150],
    ['math', 'grade6', '数的性质', '数论探索', '探索素数、因数与 Collatz 猜想等数论现象', ['素数', '数论', 'Collatz', 'mathviz'], 160],
    // mathviz 第二批：基础级（初中 12-15 岁）
    ['math', 'grade8', '一次函数', '一次函数', '理解一次函数 y=kx+b 的斜率、截距与图象', ['斜率', '截距', '线性', 'mathviz'], 210],
    ['math', 'grade9', '二次函数', '二次函数', '认识抛物线、顶点、开口方向与对称轴', ['抛物线', '顶点', '对称轴', 'mathviz'], 220],
    ['math', 'grade9', '三角函数', '三角函数', '借助单位圆理解正弦、余弦与周期性', ['单位圆', '正弦', '余弦', 'mathviz'], 230],
    ['math', 'grade9', '极坐标', '极坐标图形', '用极坐标绘制玫瑰线、心形线等曲线', ['极坐标', '玫瑰线', '心形线', 'mathviz'], 240],
    ['math', 'grade9', '概率统计', '概率分布', '认识正态、二项、泊松等常见概率分布', ['概率', '正态分布', '二项分布', 'mathviz'], 250],
    ['math', 'grade9', '曲线与参数', '贝塞尔曲线', '理解控制点如何塑造贝塞尔曲线形态', ['贝塞尔', '控制点', '曲线', 'mathviz'], 260],
    ['math', 'grade9', '概率模拟', '蒙特卡洛方法', '用随机模拟近似计算面积、概率等问题', ['蒙特卡洛', '随机模拟', 'mathviz'], 270],
    ['biology', 'grade7', '绿色植物', '光合作用', '叶绿体利用光能把 CO₂ 和水转化成有机物并释放氧气', ['叶绿体', '氧气'], 10],
    // chinese / english / politics starter samples
    ['chinese', 'grade7', '现代文阅读', '记叙文六要素', '时间、地点、人物、起因、经过、结果', ['六要素'], 10],
    ['chinese', 'grade8', '文言文基础', '一词多义', '同一文言词在不同语境意义不同', ['文言'], 20],
    ['english', 'grade7', '语法基础', '一般现在时', '表示经常性习惯或客观事实', ['present simple'], 10],
    ['english', 'grade8', '语法基础', '被动语态', '主语是动作承受者，be + 过去分词', ['passive'], 20],
    ['politics', 'grade8', '道德与法治', '权利与义务', '公民享有权利同时必须履行义务', ['权利', '义务'], 10],
    ['politics', 'grade9', '国情国策', '改革开放', '强国之路，推动中国发展', ['改革', '开放'], 20]
  ];
  const LEARNING_GOALS = {
    '加减乘除可视化': ['理解加减乘除的含义', '能用图形表示四则运算过程', '建立运算与实际问题的联系'],
    '分数可视化': ['理解分数表示整体与部分', '会用饼图/条形图比较分数', '初步理解分数加减思路'],
    '基础几何图形': ['识别常见平面图形', '理解周长与面积含义', '能完成简单周长面积计算'],
    '集合论可视化': ['理解集合、元素的概念', '会用韦恩图表示交/并/补', '能解释集合关系'],
    '黄金分割': ['认识黄金分割比', '了解斐波那契数列与螺线', '感受数学与自然/艺术的联系'],
    '数论探索': ['认识素数与合数', '了解因数/倍数关系', '体验 Collatz 等数论探索问题'],
    '一次函数': ['理解 y=kx+b 的意义', '会读斜率与截距', '能根据图象分析变化趋势'],
    '二次函数': ['认识抛物线基本形态', '会找顶点与对称轴', '理解开口方向与系数关系'],
    '勾股定理': ['理解直角三角形边长关系', '会应用 a²+b²=c² 解题', '了解几何证明思路'],
    '三角函数': ['借助单位圆理解 sin/cos', '认识周期性与特殊角', '能把角度与比值对应'],
    '极坐标图形': ['理解极径与极角', '会识别玫瑰线/心形线', '感受参数变化对图形影响'],
    '概率分布': ['理解随机变量与分布', '认识正态/二项/泊松分布特征', '会读分布图做简单判断'],
    '贝塞尔曲线': ['理解控制点作用', '认识曲线光滑插值思想', '能描述 de Casteljau 直觉'],
    '蒙特卡洛方法': ['理解随机模拟思想', '会用频率估计概率/面积', '知道精度与试验次数关系']
  };

  const base = rows.map((row, index) => {
    const [subjectCode, gradeCode, chapter, topic, summary, keywords, sortOrder] = row;
    const meta = PACK_META[topic] || {};
    return {
      id: `kp_seed_${index + 1}`,
      subject_code: subjectCode,
      grade_code: gradeCode,
      chapter,
      topic,
      summary,
      keywords: keywords || [],
      learning_goals: LEARNING_GOALS[topic] || [],
      animation_pack: meta.animationPack || inferAnimationPack({ subjectCode, topic }),
      pack_key: PACK_META[topic] ? topic : null,
      sort_order: sortOrder || (index + 1) * 10,
      enabled: true,
      source: 'seed',
      created_at: now,
      updated_at: now
    };
  });
  // Append ChemAIForge chemistry experiments (102) for fresh installs / memory mode.
  return [...base, ...listChemAIForgeKnowledgePoints(), ...listJuniorChineseKnowledgePoints(), ...listJuniorEnglishKnowledgePoints(), ...listJuniorHistoryKnowledgePoints(), ...listJuniorGeographyKnowledgePoints(), ...listJuniorPoliticsKnowledgePoints()];
}

export function normalizeSubjectCode(code) {
  return String(code || '').trim().toLowerCase();
}

export function normalizeSubjectRecord(input = {}, { partial = false } = {}) {
  const code = normalizeSubjectCode(input.code);
  const name = String(input.name || '').trim();
  const sortOrder = Number.isFinite(Number(input.sortOrder ?? input.sort_order))
    ? Number(input.sortOrder ?? input.sort_order)
    : 100;
  const enabled = input.enabled === undefined ? true : Boolean(input.enabled);
  if (!partial) {
    if (!code || !/^[a-z][a-z0-9_]{1,31}$/.test(code)) {
      return { ok: false, error: '学科 code 需为 2-32 位小写字母/数字/下划线' };
    }
    if (!name) return { ok: false, error: '学科名称不能为空' };
  } else if (input.code != null && (!code || !/^[a-z][a-z0-9_]{1,31}$/.test(code))) {
    return { ok: false, error: '学科 code 无效' };
  } else if (input.name != null && !name) {
    return { ok: false, error: '学科名称不能为空' };
  }
  return {
    ok: true,
    subject: {
      code,
      name: name || undefined,
      sort_order: sortOrder,
      enabled,
      sortOrder,
    }
  };
}

export function normalizeKnowledgePointRecord(input = {}, { partial = false } = {}) {
  const subjectCode = normalizeSubjectCode(input.subjectCode ?? input.subject_code ?? input.subject);
  const gradeCode = String(input.gradeCode ?? input.grade_code ?? input.grade ?? '').trim();
  const chapter = String(input.chapter || '').trim();
  const topic = String(input.topic || '').trim();
  const summary = String(input.summary || '').trim();
  const animationPackRaw = String(input.animationPack ?? input.animation_pack ?? '').trim().toLowerCase();
  const packKey = String(input.packKey ?? input.pack_key ?? '').trim();

  let keywords = input.keywords;
  if (typeof keywords === 'string') {
    keywords = keywords.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(keywords)) keywords = [];
  keywords = [...new Set(keywords.map((k) => String(k || '').trim()).filter(Boolean))].slice(0, 20);

  let learningGoals = input.learningGoals ?? input.learning_goals;
  if (typeof learningGoals === 'string') {
    learningGoals = learningGoals.split(/[\n;；]+/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(learningGoals)) learningGoals = [];
  learningGoals = [...new Set(learningGoals.map((g) => String(g || '').trim()).filter(Boolean))].slice(0, 8);

  const sortOrder = Number.isFinite(Number(input.sortOrder ?? input.sort_order))
    ? Number(input.sortOrder ?? input.sort_order)
    : 100;
  const enabled = input.enabled === undefined ? true : Boolean(input.enabled);
  const animationPack = animationPackRaw && ANIMATION_PACK_CODE_SET.has(animationPackRaw)
    ? animationPackRaw
    : (animationPackRaw ? null : '');

  if (!partial) {
    if (!subjectCode) return { ok: false, error: '请选择学科' };
    if (!chapter) return { ok: false, error: '章节不能为空' };
    if (!topic) return { ok: false, error: '知识点不能为空' };
    if (animationPackRaw && !ANIMATION_PACK_CODE_SET.has(animationPackRaw)) {
      return { ok: false, error: `不支持的动画包: ${animationPackRaw}` };
    }
  } else {
    if (input.subjectCode != null || input.subject_code != null || input.subject != null) {
      if (!subjectCode) return { ok: false, error: '学科无效' };
    }
    if (input.chapter != null && !chapter) return { ok: false, error: '章节不能为空' };
    if (input.topic != null && !topic) return { ok: false, error: '知识点不能为空' };
    if (animationPackRaw && !ANIMATION_PACK_CODE_SET.has(animationPackRaw)) {
      return { ok: false, error: `不支持的动画包: ${animationPackRaw}` };
    }
  }

  return {
    ok: true,
    point: {
      subject_code: subjectCode || undefined,
      grade_code: gradeCode || null,
      chapter: chapter || undefined,
      topic: topic || undefined,
      summary,
      keywords,
      learning_goals: learningGoals,
      animation_pack: animationPackRaw || null,
      pack_key: packKey || null,
      sort_order: sortOrder,
      enabled,
      subjectCode: subjectCode || undefined,
      gradeCode: gradeCode || null,
      learningGoals,
      animationPack: animationPackRaw || null,
      packKey: packKey || null,
      sortOrder
    }
  };
}

export function publicSubject(row) {
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order ?? row.sortOrder ?? 100,
    enabled: row.enabled !== false && row.enabled !== 0,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
}

export function publicKnowledgePoint(row) {
  if (!row) return null;
  let keywords = row.keywords ?? row.keywords_json;
  if (typeof keywords === 'string') {
    try { keywords = JSON.parse(keywords); } catch { keywords = String(keywords).split(',').filter(Boolean); }
  }
  if (!Array.isArray(keywords)) keywords = [];

  let learningGoals = row.learning_goals ?? row.learningGoals ?? row.learning_goals_json;
  if (typeof learningGoals === 'string') {
    try { learningGoals = JSON.parse(learningGoals); } catch {
      learningGoals = String(learningGoals).split(/[\n;；]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(learningGoals)) learningGoals = [];

  return {
    id: row.id,
    subjectCode: row.subject_code || row.subjectCode,
    gradeCode: row.grade_code || row.gradeCode || null,
    chapter: row.chapter,
    topic: row.topic,
    summary: row.summary || '',
    keywords,
    learningGoals,
    animationPack: row.animation_pack || row.animationPack || null,
    packKey: row.pack_key || row.packKey || null,
    sortOrder: row.sort_order ?? row.sortOrder ?? 100,
    enabled: row.enabled !== false && row.enabled !== 0,
    source: row.source || 'manual',
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
}


/** mathviz narration-plan batch1(入门/小学) + batch2(基础/初中) catalog rows */

/** ChemAIForge 102 experiments → chemistry knowledge catalog */

/** 初中语文知识点库 */

/** 初中英语知识点库 */

/** 初中history知识点库 */
export function listJuniorHistoryKnowledgePoints() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(here, '../data/junior-history-knowledge-points.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) return [];
    const now = new Date().toISOString();
    return raw.map((row, index) => ({
      id: `kp_hist_junior_${index + 1}`,
      subject_code: row.subjectCode || 'history',
      grade_code: row.gradeCode || 'grade7',
      chapter: row.chapter,
      topic: row.topic,
      summary: row.summary || '',
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      learning_goals: Array.isArray(row.learningGoals) ? row.learningGoals : [],
      animation_pack: row.animationPack || 'history',
      pack_key: `junior-history:${row.gradeCode || 'grade7'}:${row.topic}`,
      sort_order: Number(row.sortOrder) || (index + 1) * 10,
      enabled: row.enabled !== false,
      source: 'junior_history',
      created_at: now,
      updated_at: now
    })).filter((p) => p.topic && p.chapter);
  } catch {
    return [];
  }
}

/** 初中geography知识点库 */
export function listJuniorGeographyKnowledgePoints() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(here, '../data/junior-geography-knowledge-points.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) return [];
    const now = new Date().toISOString();
    return raw.map((row, index) => ({
      id: `kp_geo_junior_${index + 1}`,
      subject_code: row.subjectCode || 'geography',
      grade_code: row.gradeCode || 'grade7',
      chapter: row.chapter,
      topic: row.topic,
      summary: row.summary || '',
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      learning_goals: Array.isArray(row.learningGoals) ? row.learningGoals : [],
      animation_pack: row.animationPack || 'geography',
      pack_key: `junior-geography:${row.gradeCode || 'grade7'}:${row.topic}`,
      sort_order: Number(row.sortOrder) || (index + 1) * 10,
      enabled: row.enabled !== false,
      source: 'junior_geography',
      created_at: now,
      updated_at: now
    })).filter((p) => p.topic && p.chapter);
  } catch {
    return [];
  }
}

/** 初中politics知识点库 */
export function listJuniorPoliticsKnowledgePoints() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(here, '../data/junior-politics-knowledge-points.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) return [];
    const now = new Date().toISOString();
    return raw.map((row, index) => ({
      id: `kp_pol_junior_${index + 1}`,
      subject_code: row.subjectCode || 'politics',
      grade_code: row.gradeCode || 'grade7',
      chapter: row.chapter,
      topic: row.topic,
      summary: row.summary || '',
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      learning_goals: Array.isArray(row.learningGoals) ? row.learningGoals : [],
      animation_pack: row.animationPack || 'generic',
      pack_key: `junior-politics:${row.gradeCode || 'grade7'}:${row.topic}`,
      sort_order: Number(row.sortOrder) || (index + 1) * 10,
      enabled: row.enabled !== false,
      source: 'junior_politics',
      created_at: now,
      updated_at: now
    })).filter((p) => p.topic && p.chapter);
  } catch {
    return [];
  }
}

export function listJuniorEnglishKnowledgePoints() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(here, '../data/junior-english-knowledge-points.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) return [];
    const now = new Date().toISOString();
    return raw.map((row, index) => ({
      id: `kp_en_junior_${index + 1}`,
      subject_code: row.subjectCode || 'english',
      grade_code: row.gradeCode || 'grade7',
      chapter: row.chapter,
      topic: row.topic,
      summary: row.summary || '',
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      learning_goals: Array.isArray(row.learningGoals) ? row.learningGoals : [],
      animation_pack: row.animationPack || 'generic',
      pack_key: `junior-english:${row.gradeCode || 'grade7'}:${row.topic}`,
      sort_order: Number(row.sortOrder) || (index + 1) * 10,
      enabled: row.enabled !== false,
      source: 'junior_english',
      created_at: now,
      updated_at: now
    })).filter((p) => p.topic && p.chapter);
  } catch {
    return [];
  }
}

export function listJuniorChineseKnowledgePoints() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(here, '../data/junior-chinese-knowledge-points.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) return [];
    const now = new Date().toISOString();
    return raw.map((row, index) => ({
      id: `kp_zh_junior_${index + 1}`,
      subject_code: row.subjectCode || 'chinese',
      grade_code: row.gradeCode || 'grade7',
      chapter: row.chapter,
      topic: row.topic,
      summary: row.summary || '',
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      learning_goals: Array.isArray(row.learningGoals) ? row.learningGoals : [],
      animation_pack: row.animationPack || 'generic',
      pack_key: `junior-chinese:${row.gradeCode || 'grade7'}:${row.topic}`,
      sort_order: Number(row.sortOrder) || (index + 1) * 10,
      enabled: row.enabled !== false,
      source: 'junior_chinese',
      created_at: now,
      updated_at: now
    })).filter((p) => p.topic && p.chapter);
  } catch {
    return [];
  }
}

export function listChemAIForgeKnowledgePoints() {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const file = path.resolve(here, '../data/chemaiforge-knowledge-points.json');
    if (!fs.existsSync(file)) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(raw)) return [];
    const now = new Date().toISOString();
    return raw.map((row, index) => ({
      id: `kp_chemforge_${index + 1}`,
      subject_code: row.subjectCode || 'chemistry',
      grade_code: row.gradeCode || 'grade9',
      chapter: row.chapter,
      topic: row.topic,
      summary: row.summary || '',
      keywords: Array.isArray(row.keywords) ? row.keywords : [],
      learning_goals: Array.isArray(row.learningGoals) ? row.learningGoals : [],
      animation_pack: row.animationPack || 'chemistry',
      pack_key: row.slug ? `chemaiforge:${row.slug}` : (row.packKey || null),
      sort_order: Number(row.sortOrder) || (1000 + index + 1),
      enabled: row.enabled !== false,
      source: 'chemaiforge',
      created_at: now,
      updated_at: now
    })).filter((p) => p.topic && p.chapter);
  } catch {
    return [];
  }
}

export function listMathvizCatalogPoints() {
  return defaultKnowledgePoints().filter((p) =>
    Array.isArray(p.keywords) && p.keywords.map(String).includes('mathviz')
  );
}

export function matchKnowledgeQuery(point, q) {
  if (!q) return true;
  const needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    point.topic,
    point.chapter,
    point.summary,
    ...(point.keywords || [])
  ].join(' ').toLowerCase();
  return hay.includes(needle);
}

export function groupChapters(points = []) {
  const map = new Map();
  for (const p of points) {
    const key = p.chapter || '未分类';
    if (!map.has(key)) map.set(key, { chapter: key, count: 0, topics: [] });
    const bucket = map.get(key);
    bucket.count += 1;
    bucket.topics.push({
      id: p.id,
      topic: p.topic,
      gradeCode: p.gradeCode,
      summary: p.summary,
      keywords: p.keywords
    });
  }
  return [...map.values()].sort((a, b) => a.chapter.localeCompare(b.chapter, 'zh'));
}
