import assert from 'node:assert/strict';
import test from 'node:test';
import { answerRuralTeachingQuestion, rankKnowledgePoints } from '../services/ruralTeachingAssistant.js';

const points = [
  { id: 'kp_energy', subjectCode: 'physics', gradeCode: 'grade8', chapter: '机械能与能量', topic: '能量守恒定律', summary: '能量不会凭空产生或消失，只会转化或转移。', keywords: ['能量', '守恒', '转化'], learningGoals: ['理解能量转化与转移'] },
  { id: 'kp_force', subjectCode: 'physics', gradeCode: 'grade8', chapter: '运动和力', topic: '惯性', summary: '物体保持原有运动状态的性质。', keywords: ['惯性', '运动状态'] }
];

test('rankKnowledgePoints prioritizes matching topic', () => {
  const ranked = rankKnowledgePoints(points, '为什么摩擦后机械能减少但能量仍然守恒？');
  assert.equal(ranked[0].id, 'kp_energy');
});

test('assistant provides local grounded fallback', async () => {
  const result = await answerRuralTeachingQuestion({ question: '能量守恒是什么意思？', subject: 'physics', grade: 'grade8', chapter: '机械能与能量', textbookEdition: '人教版' }, {
    knowledgePoints: points,
    llm: { enabled: false, apiKey: '' }
  });
  assert.equal(result.mode, 'local');
  assert.equal(result.sources[0].id, 'kp_energy');
  assert.match(result.answer, /能量|转化|转移|守恒/);
  assert.equal(result.suggestedQuestions.length, 3);
});
