import { resolveKnowledge } from './storyboardBuilder.js';

const SUBJECT_NAMES = Object.freeze({
  chinese: '语文', math: '数学', english: '英语', physics: '物理', chemistry: '化学',
  biology: '生物', geography: '地理', history: '历史', politics: '政治'
});

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[\s，。！？；：、,.!?;:'"“”‘’（）()【】\[\]<>《》]/g, '');
}

function fragments(question) {
  const text = normalizeText(question);
  const values = new Set();
  for (const size of [4, 3, 2]) {
    for (let index = 0; index <= text.length - size; index += 1) values.add(text.slice(index, index + size));
  }
  return [...values].filter((item) => !['什么', '怎么', '为什么', '如何', '可以', '知识', '同学'].includes(item));
}

export function rankKnowledgePoints(points = [], question = '', limit = 3) {
  const needle = normalizeText(question);
  const terms = fragments(question);
  return points.map((point) => {
    const topic = normalizeText(point.topic);
    const chapter = normalizeText(point.chapter);
    const summary = normalizeText(point.summary);
    const keywords = (point.keywords || []).map(normalizeText);
    let score = topic && needle.includes(topic) ? 80 : 0;
    if (topic && topic.includes(needle) && needle.length >= 2) score += 60;
    if (chapter && needle.includes(chapter)) score += 24;
    for (const keyword of keywords) if (keyword && needle.includes(keyword)) score += 18;
    for (const term of terms) {
      if (topic.includes(term)) score += term.length * 3;
      if (chapter.includes(term)) score += term.length;
      if (summary.includes(term)) score += Math.max(1, term.length - 1);
      if (keywords.some((keyword) => keyword.includes(term))) score += term.length * 2;
    }
    return { point, score };
  }).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(Number(limit) || 3, 5)))
    .map((item) => item.point);
}

function llmConfig(overrides = {}) {
  const apiKey = process.env.ASSISTANT_LLM_API_KEY || process.env.BAILIAN_API_KEY || process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseUrl = (process.env.ASSISTANT_LLM_BASE_URL || process.env.BAILIAN_BASE_URL || process.env.DASHSCOPE_BASE_URL || process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.ASSISTANT_LLM_MODEL || process.env.BAILIAN_MODEL || process.env.DASHSCOPE_MODEL || process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'qwen3-max';
  const enabled = String(process.env.ASSISTANT_LLM_ENABLED || (apiKey ? 'true' : 'false')).toLowerCase() !== 'false';
  const timeoutMs = Math.max(3000, Number(process.env.ASSISTANT_LLM_TIMEOUT_MS || 20000));
  return { apiKey, baseUrl, model, enabled, timeoutMs, ...overrides };
}

function knowledgeContext(knowledge, sources) {
  const lines = [];
  if (knowledge?.definition) lines.push(`定义：${knowledge.definition}`);
  if (knowledge?.formula) lines.push(`关系：${knowledge.formula}${knowledge.formulaNote ? `（${knowledge.formulaNote}）` : ''}`);
  if (knowledge?.conditions) lines.push(`条件：${knowledge.conditions}`);
  if (knowledge?.examples?.length) lines.push(`例子：${knowledge.examples.slice(0, 3).join('；')}`);
  if (knowledge?.misconceptions?.length) lines.push(`易错点：${knowledge.misconceptions.slice(0, 3).join('；')}`);
  for (const source of sources) lines.push(`目录：${source.topic}｜${source.chapter}｜${source.summary || '暂无摘要'}`);
  return lines.join('\n');
}

function localAnswer(input, knowledge, sources) {
  const primary = sources[0];
  const topic = primary?.topic || knowledge?.topic || input.question;
  const definition = knowledge?.definition || primary?.summary || `${topic}需要结合定义、条件和例子理解。`;
  const details = [];
  if (knowledge?.conditions) details.push(`先看适用条件：${knowledge.conditions}`);
  if (knowledge?.formula) details.push(`关键关系：${knowledge.formula}${knowledge.formulaNote ? `，${knowledge.formulaNote}` : ''}`);
  if (knowledge?.examples?.[0]) details.push(`生活或实验例子：${knowledge.examples[0]}`);
  if (knowledge?.misconceptions?.[0]) details.push(`容易出错：${knowledge.misconceptions[0]}`);
  return [
    `先抓住“${topic}”这个核心。${definition}`,
    ...details,
    `课堂上可让学生先复述，再用一道${SUBJECT_NAMES[input.subject] || '本学科'}小题检查理解。`,
    input.grade ? `回答已按${input.grade}控制难度；补充教材页码或原题后可以继续分步骤讲。` : '补充年级、教材版本或原题后可以继续分步骤讲。'
  ].join('\n\n');
}

async function fetchLlmAnswer(input, knowledge, sources, overrides = {}) {
  const config = llmConfig(overrides);
  if (!config.enabled || !config.apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const history = (input.history || []).slice(-6).map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '').slice(0, 2000)
    }));
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.25,
        messages: [
          { role: 'system', content: '你是乡村K12课堂AI助教。只依据知识上下文，短句分步骤回答；证据不足时说明，不编造教材页码或数据；最后给一个检查理解的小问题。' },
          ...history,
          { role: 'user', content: `学科：${SUBJECT_NAMES[input.subject] || input.subject || '未指定'}\n年级：${input.grade || '未指定'}\n章节：${input.chapter || '未指定'}\n教材：${input.textbookEdition || '未指定'}\n问题：${input.question}\n知识上下文：\n${knowledgeContext(knowledge, sources) || '未检索到目录知识点'}` }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`AI助教模型 HTTP ${response.status}`);
    const data = await response.json();
    const answer = String(data?.choices?.[0]?.message?.content || '').trim();
    return answer ? { answer: answer.slice(0, 6000), model: config.model } : null;
  } finally {
    clearTimeout(timer);
  }
}

export async function answerRuralTeachingQuestion(input = {}, options = {}) {
  const question = String(input.question || '').trim();
  if (!question) throw new Error('请输入问题');
  const ranked = rankKnowledgePoints(options.knowledgePoints || [], question, 3);
  const primary = ranked[0];
  const knowledge = await resolveKnowledge({
    topic: primary?.topic || question.slice(0, 120),
    subject: input.subject || primary?.subjectCode || 'general',
    grade: input.grade || primary?.gradeCode || 'general',
    chapter: input.chapter || primary?.chapter || '课堂问答',
    learningGoals: primary?.learningGoals || [],
    styleNotes: '乡村课堂AI助教：短句、分步骤、避免超纲'
  }, options.knowledgeOptions || {});
  let llm = null;
  try { llm = await fetchLlmAnswer(input, knowledge, ranked, options.llm || {}); } catch (error) {
    if (options.throwOnLlmError) throw error;
  }
  const sources = ranked.map((point) => ({
    id: point.id, topic: point.topic, chapter: point.chapter, summary: point.summary || '',
    subjectCode: point.subjectCode || input.subject || '', gradeCode: point.gradeCode || input.grade || ''
  }));
  return {
    answer: llm?.answer || localAnswer(input, knowledge, ranked),
    mode: llm ? 'llm' : 'local',
    model: llm?.model || null,
    sources,
    suggestedQuestions: [`请用生活例子解释${primary?.topic || '这个知识点'}`, '这个知识点最容易错在哪里？', '请给一道课堂检查小题']
  };
}
