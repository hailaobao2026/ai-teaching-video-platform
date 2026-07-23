import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStoryboard,
  buildKnowledgeStoryboard,
  validateStoryboardQuality,
  fillTeachingIndexHtml,
  findKnowledgePack
} from '../services/storyboardBuilder.js';

test('energy conservation pack produces principle-rich storyboard', async () => {
  const { storyboard, knowledge, quality } = await buildKnowledgeStoryboard({
    topic: '能量守恒定律',
    grade: 'grade8',
    subject: 'physics',
    chapter: '机械能与能量',
    learningGoals: ['理解能量守恒', '区分机械能守恒与能量守恒'],
    styleNotes: '适合暑假复习，口语化'
  }, {}, { strict: true });

  assert.equal(storyboard.segments.length, 7);
  assert.equal(knowledge.source, 'knowledge_pack');
  assert.match(knowledge.definition, /不生不灭|总量保持不变|转化/);
  assert.ok(quality.ok, quality.errors?.join(';'));
  const joined = storyboard.segments.map((s) => s.narration).join('\n');
  assert.doesNotMatch(joined, /把复杂现象讲清楚/);
  assert.match(joined, /转化|转移|摩擦|滚摆|发电|势能|动能/);
  assert.ok(storyboard.segments[1].points?.length >= 2);
});

test('legacy hollow template is rejected by quality gate', () => {
  const hollow = buildStoryboard({ topic: '随便一个未知概念XYZ' });
  // Force hollow narrations like old builder
  hollow.segments = hollow.segments.map((seg, idx) => ({
    ...seg,
    narration: [
      '同学们，今天我们来学习随便一个未知概念XYZ。先从一个生活问题出发。',
      '随便一个未知概念XYZ的核心是把复杂现象讲清楚。我们先记住定义与关键关系。',
      '接下来把随便一个未知概念XYZ拆成可观察的步骤，一步一步看它如何发生。',
      '这里有一个容易混淆的点。注意条件、变量和结论之间的对应关系。',
      '把它放回生活或实验场景中，你会发现它并不抽象。',
      '做题或复习时，按固定步骤走：审题、定位概念、推理、回代检验。',
      '最后记住：关键不是死记硬背，而是抓住核心条件与转化关系。'
    ][idx],
    points: []
  }));
  hollow.knowledge = { definition: '', formula: '', examples: [], misconceptions: [], conditions: '' };
  const result = validateStoryboardQuality(hollow);
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 1);
});

test('history heuristic fallback is rejected by subject-aware quality gate', () => {
  const hollow = buildStoryboard({
    topic: '某个未知历史事件XYZ',
    grade: 'grade9',
    subject: 'history',
    chapter: '世界近代史',
    learningGoals: ['说明前提与进程', '分析经济社会影响']
  });
  const result = validateStoryboardQuality(hollow);
  assert.equal(hollow.palette, 'history');
  assert.equal(hollow.knowledge.source, 'heuristic');
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /历史主题不能使用通用 heuristic|历史分镜像理科模板/);
});

test('fillTeachingIndexHtml replaces TODO cards with knowledge points', async () => {
  const { storyboard } = await buildKnowledgeStoryboard({
    topic: '能量守恒定律',
    grade: 'grade8',
    subject: 'physics',
    chapter: '机械能与能量'
  }, {}, { strict: true });

  const scaffold = `<!doctype html><html><body>
  <div id="s1-tagline" class="t-label">—— TODO: 副标题 ——</div>
  <div id="s7-number"><span id="s7-number-inner">TODO 大数字/公式</span></div>
  <div id="s7-note">TODO 注释</div>
  <div class="card-body">
            <p>TODO 要点一</p>
            <p>TODO 要点二</p>
            <p>TODO 要点三</p>
          </div>
  <div id="s2" class="scene">
    <div class="diagram-zone">
      <svg>
            <!-- TODO: 按上方 visual 描述画示意图 (零件见 references/svg-parts.md),
                 至少 3 个图形元素 -->
      </svg>
    </div>
    <div class="card-body">
              <p>TODO 要点一</p>
              <p>TODO 要点二</p>
            </div>
  </div>
  <div class="badge"><div class="icon">?</div><div class="name">TODO</div></div>
  <div class="badge"><div class="icon">?</div><div class="name">TODO</div></div>
  <div class="badge"><div class="icon">?</div><div class="name">TODO</div></div>
  <div class="badge"><div class="icon">?</div><div class="name">TODO</div></div>
  </body></html>`;

  const filled = fillTeachingIndexHtml(scaffold, storyboard, {
    topic: '能量守恒定律',
    chapter: '机械能与能量'
  });
  assert.doesNotMatch(filled, /TODO/);
  assert.match(filled, /守恒|转化|转移|E总|机械能/);
  assert.match(filled, /机械能与能量|关键记忆锚点|注释/);
  assert.ok(findKnowledgePack('能量守恒定律'));
});


test('chemistry/geography/history packs produce principle-rich storyboards', async () => {
  const cases = [
    { topic: '质量守恒定律', subject: 'chemistry', must: /质量|原子|反应|气体|m前/ },
    { topic: '燃烧与灭火', subject: 'chemistry', must: /可燃物|氧气|着火点|灭火/ },
    { topic: '水循环', subject: 'geography', must: /蒸发|降水|径流|太阳辐射/ },
    { topic: '四季的形成', subject: 'geography', must: /公转|地轴|直射|回归线/ },
    { topic: '辛亥革命', subject: 'history', must: /1911|武昌|帝制|民国|共和/ },
    { topic: '中和反应', subject: 'chemistry', must: /酸|碱|盐|水|H⁺|H\+|OH|中和/ },
    { topic: '金属活动性顺序', subject: 'chemistry', must: /活动性|置换|氢前|失电子|前强后弱/ },
    { topic: '等高线', subject: 'geography', must: /等高|坡度|山顶|等高距|密集|稀疏/ },
    { topic: '影响气候的因素', subject: 'geography', must: /纬度|海陆|地形|降水|气温/ },
    { topic: '鸦片战争', subject: 'history', must: /1840|南京条约|香港|半殖民地|侵略/ },
    { topic: '五四运动', subject: 'history', must: /1919|巴黎和会|反帝|新民主主义|主权/ },
    { topic: '工业革命', subject: 'history', must: /英国|18 世纪 60 年代|珍妮机|瓦特|蒸汽|工厂|铁路|生产力/ },
    { topic: '凸透镜成像', subject: 'physics', must: /焦点|实像|虚像|2F|特征光线/ },
    { topic: '滑轮', subject: 'physics', must: /定滑轮|动滑轮|省力|方向|F/ },
    { topic: '并联电路', subject: 'physics', must: /支路|干路|分流|电压相等|I1/ }
  ];
  for (const c of cases) {
    const { storyboard, knowledge, quality } = await buildKnowledgeStoryboard({
      topic: c.topic,
      grade: 'grade8',
      subject: c.subject,
      chapter: c.topic
    }, {}, { strict: true });
    assert.equal(storyboard.segments.length, 7, c.topic);
    assert.equal(knowledge.source, 'knowledge_pack', c.topic);
    assert.ok(quality.ok, `${c.topic}: ${quality.errors?.join(';')}`);
    const joined = storyboard.segments.map((s) => `${s.narration} ${(s.points || []).join(' ')}`).join('\n');
    assert.match(joined, c.must, c.topic);
    assert.ok(findKnowledgePack(c.topic), c.topic);
  }
});
