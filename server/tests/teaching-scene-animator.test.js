import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKnowledgeStoryboard, fillTeachingIndexHtml } from '../services/storyboardBuilder.js';
import { enhanceTeachingAnimations, animationFamilyFor, assembleByVisualKeywords } from '../services/teachingSceneAnimator.js';
import {
  assembleSeriesCircuit,
  assembleParallelCircuit,
  assembleLeverScene,
  mechanicsFixedPulley,
  mechanicsMovablePulley,
  assemblePulleyCompareScene,
  opticsPrismDispersion,
  opticsLensImaging,
  opticsLensImagingRules,
  bioProcessChain,
  chemNeutralization,
  chemMetalActivitySeries,
  geoContourMap,
  geoClimateFactors,
  historyOpiumWarTimeline,
  historyMayFourthTimeline
} from '../services/svgParts.js';

function scaffoldLikeHtml(topic = '主题') {
  return `<!doctype html><html><body>
  <div id="s1" class="scene"><div id="s1-icon" style="height:190px"><svg></svg></div><div id="s1-title" class="t-hero">${topic}</div></div>
  ${[2,3,4,5,6].map((n) => `
  <div id="s${n}" class="scene">
    <div class="diagram-zone" id="s${n}-diagram"><svg viewBox="0 0 900 700"></svg></div>
    <div class="card-zone"><div class="info-card" id="s${n}-card"><div class="card-body"><p>TODO 要点一</p><p>TODO 要点二</p></div></div></div>
  </div>`).join('\n')}
  <div id="s7" class="scene"><div id="s7-number"><span id="s7-number-inner">TODO 大数字/公式</span></div></div>
  <script>
    function scene1(t) {
      tl.fromTo("#s1-title", { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#s1-icon", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.8)" }, t + 0.4);
    }
    function scene2(t) { tl.fromTo("#s2-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 3.0); }
    function scene3(t) { tl.fromTo("#s3-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 3.0); }
    function scene4(t) { tl.fromTo("#s4-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 3.0); }
    function scene5(t) { tl.fromTo("#s5-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 3.0); }
    function scene6(t) { tl.fromTo("#s6-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 3.0); }
    function scene7(t) { tl.fromTo("#s7-number", { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: "back.out(1.6)" }, t + 0.3); }
  </script></body></html>`;
}

async function buildEnhanced(topic, extra = {}) {
  const input = { topic, grade: 'grade8', subject: 'physics', chapter: '测试章节', ...extra };
  const { storyboard } = await buildKnowledgeStoryboard(input, {}, { strict: false });
  let html = scaffoldLikeHtml(topic);
  html = fillTeachingIndexHtml(html, storyboard, input);
  html = enhanceTeachingAnimations(html, storyboard, input);
  return { input, storyboard, html, family: animationFamilyFor(storyboard, input) };
}

test('svg parts assemble reusable circuits/levers/optics/bio chains', () => {
  assert.match(assembleSeriesCircuit({ closed: true }), /part-loop|part-bulb|part-current/);
  assert.match(assembleParallelCircuit({ closed: true }), /part-parallel-circuit|part-parallel-current|支路/);
  assert.match(assembleLeverScene(), /part-lever|part-beam/);
  assert.match(mechanicsFixedPulley(), /定滑轮|part-pulley|F = G/);
  assert.match(mechanicsMovablePulley(), /动滑轮|part-movable-pulley|G \/ 2/);
  assert.match(assemblePulleyCompareScene(), /part-pulley-compare|定滑轮|动滑轮/);
  assert.match(opticsPrismDispersion(), /part-prism|part-spectrum/);
  assert.match(opticsLensImaging({ imagingCase: 'beyond2f' }), /part-lens-imaging|ray-parallel|2F|缩小/);
  assert.match(opticsLensImaging({ imagingCase: 'between_f_2f' }), /放大、倒立、实像|data-imaging-case="between_f_2f"/);
  assert.match(opticsLensImagingRules(), /物距|实像|虚像/);
  assert.match(bioProcessChain(['阳光', '叶绿体', '有机物', '氧气']), /bio-node-1|bio-node-4/);
});

test('energy family still injects specialized continuous motion', async () => {
  const { family, html } = await buildEnhanced('能量守恒定律', { subject: 'physics', chapter: '机械能与能量' });
  assert.equal(family, 'energy');
  assert.match(html, /data-animation-enhanced="energy"/);
  assert.match(html, /s2-cycle|s3-ball|s5-bob|s5-blades/);
  assert.match(html, /yoyo:\s*true/);
});

test('light/force/electric/biology families route and inject part-based diagrams', async () => {
  const cases = [
    { topic: '光的折射', subject: 'physics', family: 'light', marker: /part-refract-interface|part-prism|part-mirror|part-lens/ },
    { topic: '杠杆', subject: 'physics', family: 'force', marker: /part-lever|part-friction|part-pulley/ },
    { topic: '欧姆定律', subject: 'physics', family: 'electric', marker: /part-loop|part-current|part-bulb/ },
    { topic: '光合作用', subject: 'biology', family: 'biology', marker: /part-leaf|bio-node|part-bio-chain/ },
    { topic: '质量守恒定律', subject: 'chemistry', family: 'chemistry', marker: /part-chem-balance|part-chem-water|part-chem-reaction|part-chem-combustion/ },
    { topic: '水循环', subject: 'geography', family: 'geography', marker: /part-geo-cycle|part-geo-orbit|part-geo-lat/ },
    { topic: '辛亥革命', subject: 'history', family: 'history', marker: /part-history-timeline|part-compare|hist-node/ }
  ];
  for (const c of cases) {
    const { family, html } = await buildEnhanced(c.topic, { subject: c.subject });
    assert.equal(family, c.family, `${c.topic} family`);
    assert.match(html, new RegExp(`data-animation-enhanced="${c.family}"`));
    assert.match(html, c.marker, `${c.topic} marker`);
    assert.ok(html.includes('<path') || html.includes('<circle') || html.includes('<polygon'), `${c.topic} shapes`);
    assert.match(html, /fromTo|yoyo/);
  }
});


test('visual keywords auto-assemble circuit/lever/prism parts', () => {
  const circuit = assembleByVisualKeywords({ title: '串联电路', visual: '闭合串联回路 + 电流箭头 + 灯泡', points: ['通路', '电流单路径'] }, { topic: '欧姆定律' }, { topic: '欧姆定律' }, 3);
  assert.match(circuit, /part-loop|part-current|part-bulb/);

  const lever = assembleByVisualKeywords({ title: '杠杆要素', visual: '支点三角 + 横梁 + 动力阻力箭头', points: ['支点', '动力', '阻力'] }, { topic: '杠杆' }, { topic: '杠杆' }, 2);
  assert.match(lever, /part-lever|part-beam/);

  const prism = assembleByVisualKeywords({ title: '色散', visual: '三棱镜 + 白光入射 + 色散光谱', points: ['白光', '色散'] }, { topic: '光的折射' }, { topic: '光的折射' }, 2);
  assert.match(prism, /part-prism|part-spectrum/);

  const refract = assembleByVisualKeywords({ title: '折射定义', visual: '空气到水界面 + 法线 + 入射折射光线', points: ['入射角', '折射角'] }, { topic: '光的折射' }, { topic: '光的折射' }, 2);
  assert.match(refract, /part-refract-interface|part-refracted/);

  const bio = assembleByVisualKeywords({ title: '物质变化', visual: '原料到产物流程链：阳光叶绿体有机物氧气', points: ['阳光', '叶绿体', '有机物', '氧气'] }, { topic: '光合作用' }, { topic: '光合作用' }, 3);
  assert.match(bio, /bio-node|part-bio-chain/);

  const chem = assembleByVisualKeywords({ title: '质量守恒', visual: '反应前反应后天平 + m前=m后', points: ['原子重组'] }, { topic: '质量守恒定律' }, { topic: '质量守恒定律' }, 2);
  assert.match(chem, /part-chem-balance|m前/);

  const geo = assembleByVisualKeywords({ title: '水循环', visual: '蒸发凝结降水径流大环', points: ['蒸发', '降水'] }, { topic: '水循环' }, { topic: '水循环' }, 2);
  assert.match(geo, /part-geo-cycle|geo-node/);

  const hist = assembleByVisualKeywords({ title: '过程节点', visual: '时间轴：背景起义发展结果', points: ['背景', '起义', '结果'] }, { topic: '辛亥革命' }, { topic: '辛亥革命', subject: 'history' }, 2);
  assert.match(hist, /part-history-timeline|hist-node/);
});


test('specialized assemblies: lens imaging / fixed-movable pulley / parallel circuit', () => {
  const lens = assembleByVisualKeywords(
    { title: '凸透镜成像', visual: '物在二倍焦距以外 + 三条特征光线 + 缩小倒立实像', points: ['u>2f', '倒立实像', 'F/2F'] },
    { topic: '凸透镜成像' },
    { topic: '凸透镜成像', subject: 'physics' },
    4
  );
  assert.match(lens, /part-lens-imaging|ray-parallel|ray-center|focus-f1/);

  const lensRule = assembleByVisualKeywords(
    { title: '成像规律', visual: '物距与像的性质对照：实像虚像', points: ['u与f', '实像', '虚像'] },
    { topic: '凸透镜成像' },
    { topic: '凸透镜成像' },
    5
  );
  assert.match(lensRule, /物距|实像|虚像|part-compare/);

  const fixed = assembleByVisualKeywords(
    { title: '定滑轮', visual: '定滑轮改变力的方向但不省力 F=G', points: ['改变方向', '不省力'] },
    { topic: '滑轮' },
    { topic: '滑轮' },
    4
  );
  assert.match(fixed, /part-pulley|定滑轮|F = G/);

  const movable = assembleByVisualKeywords(
    { title: '动滑轮省力', visual: '动滑轮省力费距离 F≈G/2', points: ['省力', '费距离'] },
    { topic: '滑轮' },
    { topic: '滑轮' },
    4
  );
  assert.match(movable, /part-movable-pulley|动滑轮|G \/ 2/);

  const compare = assembleByVisualKeywords(
    { title: '定滑轮与动滑轮对比', visual: '定滑轮不省力 / 动滑轮省力对照', points: ['方向', '省力'] },
    { topic: '滑轮' },
    { topic: '滑轮' },
    5
  );
  assert.match(compare, /part-pulley-compare|定滑轮|动滑轮/);

  const parallel = assembleByVisualKeywords(
    { title: '并联电路', visual: '干路开关 + 两条支路灯泡 + 多路径电流', points: ['支路1', '支路2', '干路'] },
    { topic: '欧姆定律' },
    { topic: '并联电路' },
    4
  );
  assert.match(parallel, /part-parallel-circuit|part-parallel-current|支路/);
});

test('chem/geo/history specialized packs and assemblies', () => {
  assert.match(chemNeutralization(), /part-chem-neutralization|H⁺|OH|盐 \+ 水/);
  assert.match(chemMetalActivitySeries(), /part-chem-metal-series|前强后弱|氢前|Zn/);
  assert.match(geoContourMap(), /part-geo-contour|山顶|密集|等高距/);
  assert.match(geoClimateFactors(), /part-geo-climate|纬度|海陆|地形/);
  assert.match(historyOpiumWarTimeline(), /1840|南京条约|禁烟/);
  assert.match(historyMayFourthTimeline(), /巴黎和会|5\.4|新开端/);

  const neut = assembleByVisualKeywords(
    { title: '中和反应', visual: '酸 + 碱 → 盐 + 水，实质 H⁺ + OH⁻ = H₂O', points: ['酸', '碱', '盐和水'] },
    { topic: '中和反应' },
    { topic: '中和反应', subject: 'chemistry' },
    2
  );
  assert.match(neut, /part-chem-neutralization|H⁺|OH/);

  const metal = assembleByVisualKeywords(
    { title: '金属活动性顺序', visual: '前强后弱 + 氢前产氢 + 前换后', points: ['活动性', '置换', '氢前'] },
    { topic: '金属活动性顺序' },
    { topic: '金属活动性顺序', subject: 'chemistry' },
    3
  );
  assert.match(metal, /part-chem-metal-series|前强后弱|氢前/);

  const contour = assembleByVisualKeywords(
    { title: '等高线', visual: '等高线密集表示陡坡，稀疏表示缓坡，闭合高值为山顶', points: ['密陡疏缓', '山顶', '等高距'] },
    { topic: '等高线' },
    { topic: '等高线', subject: 'geography' },
    2
  );
  assert.match(contour, /part-geo-contour|山顶|密集/);

  const climate = assembleByVisualKeywords(
    { title: '影响气候的因素', visual: '纬度、海陆位置与地形共同影响气候', points: ['纬度', '海陆', '地形'] },
    { topic: '影响气候的因素' },
    { topic: '影响气候的因素', subject: 'geography' },
    3
  );
  assert.match(climate, /part-geo-climate|纬度|海陆|地形/);

  const opium = assembleByVisualKeywords(
    { title: '过程节点', visual: '1840开战到南京条约时间轴', points: ['1840', '南京条约'] },
    { topic: '鸦片战争' },
    { topic: '鸦片战争', subject: 'history' },
    3
  );
  assert.match(opium, /1840|南京条约|part-history-timeline|hist-node/);

  const may4 = assembleByVisualKeywords(
    { title: '五四运动', visual: '1919巴黎和会与学生游行时间轴', points: ['1919', '巴黎和会', '新民主主义'] },
    { topic: '五四运动' },
    { topic: '五四运动', subject: 'history' },
    2
  );
  assert.match(may4, /巴黎和会|5\.4|新开端|part-history-timeline|hist-node/);
});
