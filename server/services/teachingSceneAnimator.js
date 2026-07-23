// server/services/teachingSceneAnimator.js
// 对照 linyuebanzi / ai-teaching-media：
// 1) 可组装 svgParts 零件库
// 2) 学科动画包：energy / sound / math / light / force / electric / biology / generic

import {
  svgRoot,
  assembleSeriesCircuit,
  assembleParallelCircuit,
  assembleSoundSource,
  assembleLeverScene,
  mechanicsBlockFriction,
  mechanicsPulley,
  mechanicsFixedPulley,
  mechanicsMovablePulley,
  assemblePulleyCompareScene,
  opticsPrismDispersion,
  opticsMirrorReflection,
  opticsConvexLens,
  opticsRefractionInterface,
  opticsLensImaging,
  opticsLensImagingRules,
  chemMoleculeWater,
  chemReactionArrow,
  chemCombustionTriangle,
  chemMassBalance,
  chemNeutralization,
  chemMetalActivitySeries,
  geoWaterCycle,
  geoEarthOrbitSeasons,
  geoLatitudeBands,
  geoContourMap,
  geoClimateFactors,
  historyTimeline,
  historyCauseEffect,
  historyOpiumWarTimeline,
  historyMayFourthTimeline,
  bioProcessChain,
  bioLeafCross,
  methodSteps,
  comparePanels,
  label,
  escapeXml
} from './svgParts.js';

function clamp(text, max = 18) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function segmentPoints(seg = {}, fallback = []) {
  const pts = Array.isArray(seg.points) ? seg.points.filter(Boolean) : [];
  while (pts.length < 2 && fallback.length) pts.push(fallback[pts.length]);
  while (pts.length < 2) pts.push('关键要点');
  return pts.map((p) => clamp(p, 16));
}


function segmentVisualCorpus(seg = {}, storyboard = {}, input = {}) {
  return [
    seg.title,
    seg.visual,
    seg.narration,
    ...(seg.points || []),
    seg.formula,
    storyboard.topic,
    input.topic,
    input.chapter
  ].filter(Boolean).join(' ');
}

/**
 * 按 visual / 旁白关键词自动装配零件（优先于纯 family 默认）。
 * 返回 svg 字符串或 null（null 表示继续走 family 模板）。
 */
export function assembleByVisualKeywords(seg = {}, storyboard = {}, input = {}, sceneNo = 2) {
  const corpus = segmentVisualCorpus(seg, storyboard, input);
  const c = corpus.toLowerCase();

  // method/summary-ish scenes often better as steps
  if (sceneNo === 6 || /做题|步骤|方法|清单|四步/.test(corpus)) {
    return methodDiagram(seg);
  }


  // optics: prefer real refraction interface over prism for “折射”
  if (/折射|入射角|折射角|界面|介质/.test(corpus) && !/色散|棱镜/.test(corpus)) {
    return svgRoot(opticsRefractionInterface());
  }

  // chemistry
  if (/中和反应|酸与碱|H⁺|H\+|OH⁻|OH-|酚酞|盐和水/.test(corpus)) return svgRoot(chemNeutralization());
  if (/金属活动性|活动性顺序|置换反应|氢前金属|前换后|K Ca Na|失电子能力/.test(corpus)) return svgRoot(chemMetalActivitySeries());
  if (/质量守恒|m前|反应前后|化学变化.*质量|原子重新组合/.test(corpus)) return svgRoot(chemMassBalance());
  if (/燃烧|可燃物|着火点|灭火/.test(corpus)) return svgRoot(chemCombustionTriangle());
  if (/反应物|生成物|化学方程式|化合|分解/.test(corpus)) {
    return svgRoot(chemReactionArrow({ left: '反应物', right: '生成物', note: '原子重新组合' }));
  }
  if (/分子|原子|H₂O|水分子|微粒/.test(corpus)) return svgRoot(chemMoleculeWater());

  // geography
  if (/等高线|等高距|山顶|山脊|山谷|坡度陡|密陡疏缓/.test(corpus)) return svgRoot(geoContourMap());
  if (/影响气候|气候的因素|纬度位置|海陆位置|迎风坡|背风坡/.test(corpus)) return svgRoot(geoClimateFactors());
  if (/水循环|蒸发|凝结|降水|径流/.test(corpus)) return svgRoot(geoWaterCycle());
  if (/四季|公转|地轴|回归线|二分二至/.test(corpus)) return svgRoot(geoEarthOrbitSeasons());
  if (/纬度|气候带|赤道|五带/.test(corpus)) return svgRoot(geoLatitudeBands());

  // history
  if (/鸦片战争|南京条约|虎门销烟|1840|1842/.test(corpus)) return svgRoot(historyOpiumWarTimeline());
  if (/五四运动|1919|巴黎和会|外争主权|内除国贼|新民主主义/.test(corpus)) return svgRoot(historyMayFourthTimeline());
  if (/时间轴|年表|阶段|进程|经过|辛亥革命|起义/.test(corpus)) {
    const pts = Array.isArray(seg.points) && seg.points.length ? seg.points : ['背景', '爆发', '发展', '结果'];
    return svgRoot(historyTimeline(pts));
  }
  if (/原因|影响|结果|因果|背景|意义/.test(corpus) && /历史|辛亥|战争|革命|事件/.test(`${corpus} ${storyboard.topic || ''} ${input.topic || ''}`)) {
    return svgRoot(historyCauseEffect(seg.points?.slice(0, 3) || [], seg.points?.slice(3, 6) || []));
  }


  // electric keywords
  if (/串联|回路|电路|开关|电流|电阻|灯泡|欧姆|并联/.test(corpus)) {
    const closed = /闭合|通路|形成电流|串联电路|并联/.test(corpus) || sceneNo >= 3;
    // 专用并联装配优先于文字对比卡
    if (/并联电路|两条支路|支路|干路/.test(corpus) || (/并联/.test(corpus) && !/串并联|对比/.test(corpus))) {
      return svgRoot(assembleParallelCircuit({ closed: true }));
    }
    if (/串并联|对比/.test(corpus) && /并联|串联/.test(corpus)) {
      return svgRoot(comparePanels(
        '串联', '并联',
        ['电流单路径', '总电阻变大', '一处断开全断'],
        ['电流多路径', '总电阻变小', '支路相对独立']
      ));
    }
    if (/并联/.test(corpus)) {
      return svgRoot(assembleParallelCircuit({ closed: true }));
    }
    return svgRoot(assembleSeriesCircuit({ closed }) + (/U\s*=\s*I|I\s*=\s*U|欧姆|公式/.test(corpus)
      ? label(450, 640, 'I = U / R', { size: 40, weight: 900, fill: 'var(--primary)', anchor: 'middle', id: 'ohm-formula' })
      : ''));
  }

  // optics keywords
  if (/棱镜|色散|白光/.test(corpus)) return svgRoot(opticsPrismDispersion());
  if (/平面镜|反射|法线|入射角|反射角/.test(corpus) && !/折射/.test(corpus)) return svgRoot(opticsMirrorReflection());
  // 先匹配“作图/光线/焦点”等示教图，再匹配规律对照卡
  if (/凸透镜成像|会聚成实像|光屏|特征光线|三条光线|作图|焦点|2F|二倍焦距|倒立实像|缩小倒立|放大倒立/.test(corpus)
    || (/凸透镜/.test(corpus) && /成像|物距|像距/.test(corpus) && !/成像规律|像的性质对照|规律表/.test(corpus))) {
    let imagingCase = 'beyond2f';
    if (/u\s*=\s*2f|二倍焦距处|等大/.test(corpus)) imagingCase = 'at2f';
    else if (/f\s*<\s*u\s*<\s*2f|一倍.*二倍|放大.*倒立|放大倒立/.test(corpus)) imagingCase = 'between_f_2f';
    else if (/二倍焦距以外|缩小|u\s*>\s*2f/.test(corpus)) imagingCase = 'beyond2f';
    return svgRoot(opticsLensImaging({ imagingCase }));
  }
  if (/成像规律|像的性质|规律对照|物距与像/.test(corpus) && /透镜|凸透镜|成像|实像|虚像/.test(corpus)) {
    return svgRoot(opticsLensImagingRules());
  }
  if (/透镜|凸透镜|会聚/.test(corpus)) return svgRoot(opticsConvexLens());
  if (/折射/.test(corpus) && sceneNo === 2) return svgRoot(opticsRefractionInterface());

  // force / mechanics keywords
  if (/杠杆|支点|动力臂|阻力臂|撬/.test(corpus)) return svgRoot(assembleLeverScene());
  if (/摩擦|拉力|物块|支持面/.test(corpus)) return svgRoot(mechanicsBlockFriction());
  if (/定滑轮.*动滑轮|动滑轮.*定滑轮|滑轮对比|省力靠/.test(corpus)) {
    return svgRoot(assemblePulleyCompareScene());
  }
  if (/动滑轮|省力费距离|F\s*≈\s*G\s*\/\s*2|F\s*=\s*G\s*\/\s*2/.test(corpus)) {
    return svgRoot(mechanicsMovablePulley());
  }
  if (/定滑轮|改变力的方向|不省力/.test(corpus)) {
    return svgRoot(mechanicsFixedPulley());
  }
  if (/滑轮/.test(corpus)) return svgRoot(mechanicsFixedPulley());

  // sound keywords
  if (/音叉|振动发声|声波弧|发声/.test(corpus)) return svgRoot(assembleSoundSource());
  if (/音调|频率|高频|低频/.test(corpus)) {
    return svgRoot(`
      <g id="kw-pitch">
        <text x="220" y="80" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">高频 · 高音调</text>
        <polyline points="60,180 100,120 140,180 180,120 220,180 260,120 300,180 340,120 380,180" fill="none" stroke="var(--accent)" stroke-width="8"/>
        <text x="660" y="80" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">低频 · 低音调</text>
        <polyline points="500,180 580,120 660,180 740,120 820,180" fill="none" stroke="var(--neutral)" stroke-width="8"/>
      </g>`);
  }
  if (/响度|振幅/.test(corpus)) {
    return svgRoot(`
      <g id="kw-loudness">
        <text x="220" y="90" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">大振幅 · 更响</text>
        <polyline points="60,220 120,80 180,220 240,80 300,220 360,80 420,220" fill="none" stroke="var(--accent)" stroke-width="8"/>
        <text x="680" y="90" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">小振幅 · 更轻</text>
        <polyline points="500,220 560,180 620,220 680,180 740,220 800,180 860,220" fill="none" stroke="var(--neutral)" stroke-width="8"/>
      </g>`);
  }

  // biology keywords (process chain before leaf, so “叶绿体+流程” still gets chain)
  if (/呼吸作用/.test(corpus) && /光合|呼吸/.test(corpus) || (/对比/.test(corpus) && /光合/.test(corpus) && /呼吸/.test(corpus))) {
    return svgRoot(comparePanels(
      '光合作用', '呼吸作用',
      ['吸收 CO₂ + 水', '释放 O₂', '储存能量'],
      ['消耗有机物 + O₂', '释放 CO₂ + 水', '释放能量']
    ));
  }
  if (/流程|原料|产物|阳光|有机物|二氧化碳|氧气/.test(corpus) || (/光合/.test(corpus) && /链|步骤|过程/.test(corpus))) {
    const pts = Array.isArray(seg.points) && seg.points.length ? seg.points : ['阳光', '叶绿体', '有机物', '氧气'];
    return svgRoot(bioProcessChain(pts));
  }
  if (/叶绿|叶片|光能吸收/.test(corpus)) return svgRoot(bioLeafCross());

  // energy keywords
  if (/能量循环|动能|势能|内能|电能/.test(corpus) && /守恒|转化|转移/.test(corpus)) {
    if (/转化|转移/.test(corpus) && sceneNo !== 2) return energyConvertTransferDiagram(seg);
    if (/对比|机械能/.test(corpus)) return energyCompareDiagram();
    if (/滚摆|发电|水轮机|单摆/.test(corpus)) return energyExamplesDiagram();
    return energyCycleDiagram(seg);
  }

  // math
  if (/勾股|直角三角形|a²|斜边/.test(corpus)) return mathTriangleDiagram();

  // compare generic
  if (/对比|对照|vs|versus|不是|易错/.test(corpus) && sceneNo >= 4) {
    const pts = segmentPoints(seg, ['要点A', '要点B']);
    return svgRoot(comparePanels(pts[0] || 'A', pts[1] || 'B', [pts[0] || '条件1', '关键关系'], [pts[1] || '条件2', '常见误区']));
  }

  return null;
}


export function detectFamily(storyboard = {}, input = {}) {
  const forced = String(input.animationPack || input.animation_pack || storyboard.animationPack || '').trim().toLowerCase();
  const known = new Set(['energy','sound','math','light','force','electric','biology','chemistry','geography','history','generic']);
  if (forced && known.has(forced)) return forced;

  const topic = `${storyboard.topic || ''} ${input.topic || ''}`;
  const palette = String(storyboard.palette || '').toLowerCase();
  const subject = String(input.subject || storyboard.knowledge?.subjectHint || '').toLowerCase();
  const titles = (storyboard.segments || []).map((s) => s.title || '').join(' ');
  const corpus = `${topic} ${palette} ${subject} ${titles}`.toLowerCase();

  // Specific families first. Avoid letting generic words like “能量” hijack biology.
  if (/声|sound|振动|声波|音调|响度|音色/.test(corpus) || palette === 'sound') return 'sound';
  if (/勾股|直角三角形|a²|勾股定理/.test(corpus) || (palette === 'math' && /三角|勾股/.test(corpus))) return 'math';
  if (/质量守恒|燃烧|分子|原子|化学变化|化学方程式|chemistry|可燃物|着火点|中和|金属活动|置换反应|酚酞/.test(corpus) || palette === 'chemistry' || subject === 'chemistry') return 'chemistry';
  if (/水循环|四季|公转|纬度|气候|地理|降水|蒸发|地轴|等高线|等高距|海陆|迎风坡|geography/.test(corpus) || palette === 'geography' || subject === 'geography') return 'geography';
  if (/历史|辛亥|革命|战争|时间轴|年表|history|事件因果|五四|鸦片战争|南京条约|1919|1840/.test(corpus) || palette === 'history' || subject === 'history') return 'history';
  if (/光合|呼吸作用|叶绿|细胞呼吸|biology|植物|消化|生态/.test(corpus) || palette === 'biology' || subject === 'biology') return 'biology';
  if (/透镜|反射|折射|色散|棱镜|平面镜|optics|(^|\s)光的|光现象/.test(corpus) || palette === 'light') return 'light';
  if (/杠杆|滑轮|摩擦|力臂|动力臂|阻力臂|牛顿第一定律|force|lever|pulley/.test(corpus)) return 'force';
  if (/电|欧姆|电路|电流|电压|电阻|串联|并联|电功|电热|electric/.test(corpus) || palette === 'electricity') return 'electric';
  if (/能量守恒|机械能|势能|动能|能量转化|能量转移/.test(corpus) || (palette === 'mechanics' && /能量|守恒/.test(corpus))) return 'energy';
  if (palette === 'mechanics') return 'force';
  if (palette === 'math' || subject === 'math') return 'math';
  return 'generic';
}

/* ---------------- icons ---------------- */

function iconEnergy() {
  return svgRoot(`
    <g id="s1-icon-g" fill="none" stroke="var(--primary)" stroke-width="10" stroke-linecap="round">
      <circle cx="210" cy="105" r="70" fill="color-mix(in srgb, var(--primary) 10%, #fff)"/>
      <path d="M 185 80 L 205 80 L 190 115 L 225 115 L 200 150" stroke="var(--accent)" stroke-width="12"/>
    </g>`, { viewBox: '0 0 420 210' });
}
function iconSound() {
  return svgRoot(`
    <g stroke="var(--primary)" fill="none" stroke-width="10" stroke-linecap="round">
      <line x1="150" y1="40" x2="150" y2="120"/><line x1="200" y1="40" x2="200" y2="120"/>
      <path d="M 150 120 A 25 25 0 0 0 200 120"/><line x1="175" y1="145" x2="175" y2="175"/>
      <path d="M 250 70 A 35 35 0 0 1 250 130" stroke="var(--accent)"/>
    </g>`, { viewBox: '0 0 420 210' });
}
function iconMath() {
  return svgRoot(`
    <g stroke="var(--primary)" fill="none" stroke-width="10" stroke-linejoin="round">
      <path d="M 80 160 L 160 40 L 300 160 Z"/>
      <text x="180" y="120" font-size="34" font-weight="900" fill="var(--primary)">a²+b²=c²</text>
    </g>`, { viewBox: '0 0 420 210' });
}
function iconLight() {
  return svgRoot(`
    <g>
      <polygon points="210,40 150,150 270,150" fill="color-mix(in srgb, var(--primary) 12%, #fff)" stroke="var(--primary)" stroke-width="8"/>
      <line x1="40" y1="110" x2="160" y2="110" stroke="var(--ink)" stroke-width="6"/>
      <line x1="250" y1="100" x2="380" y2="70" stroke="#E63946" stroke-width="5"/>
      <line x1="250" y1="110" x2="380" y2="110" stroke="#06A77D" stroke-width="5"/>
      <line x1="250" y1="120" x2="380" y2="150" stroke="#118AB2" stroke-width="5"/>
    </g>`, { viewBox: '0 0 420 210' });
}
function iconForce() {
  return svgRoot(`
    <g>
      <polygon points="210,140 180,180 240,180" fill="color-mix(in srgb, var(--primary) 25%, #fff)" stroke="var(--primary)" stroke-width="6"/>
      <line x1="60" y1="145" x2="360" y2="135" stroke="var(--ink)" stroke-width="8"/>
      <line x1="320" y1="130" x2="320" y2="60" stroke="var(--accent)" stroke-width="7"/>
      <polygon points="320,50 308,72 332,72" fill="var(--accent)"/>
    </g>`, { viewBox: '0 0 420 210' });
}
function iconElectric() {
  return svgRoot(`
    <g stroke="var(--primary)" fill="none" stroke-width="8" stroke-linecap="round">
      <rect x="60" y="40" width="300" height="140" rx="16"/>
      <circle cx="140" cy="110" r="24" fill="color-mix(in srgb, var(--highlight,#ffe08a) 55%, transparent)"/>
      <rect x="200" y="90" width="70" height="30" fill="#fff"/>
      <path d="M 300 70 L 320 110 L 290 110 L 320 160" stroke="var(--accent)" stroke-width="10"/>
    </g>`, { viewBox: '0 0 420 210' });
}
function iconBiology() {
  return svgRoot(`
    <g>
      <ellipse cx="210" cy="105" rx="120" ry="70" fill="color-mix(in srgb, var(--primary) 16%, #fff)" stroke="var(--primary)" stroke-width="8"/>
      <path d="M 110 105 C 170 50, 250 50, 310 105" fill="none" stroke="var(--accent)" stroke-width="6"/>
      <circle cx="180" cy="90" r="10" fill="var(--accent)"/><circle cx="240" cy="110" r="8" fill="var(--accent)"/>
    </g>`, { viewBox: '0 0 420 210' });
}

function pickIcon(family) {
  return ({
    energy: iconEnergy,
    sound: iconSound,
    math: iconMath,
    light: iconLight,
    force: iconForce,
    electric: iconElectric,
    biology: iconBiology,
    chemistry: iconChemistry,
    geography: iconGeography,
    history: iconHistory,
    generic: iconEnergy
  }[family] || iconEnergy)();
}

function iconChemistry() {
  return svgRoot(`
    <g>
      <circle cx="180" cy="110" r="42" fill="color-mix(in srgb, var(--primary) 18%, #fff)" stroke="var(--primary)" stroke-width="8"/>
      <circle cx="260" cy="150" r="28" fill="#fff" stroke="var(--accent)" stroke-width="7"/>
      <circle cx="250" cy="70" r="24" fill="#fff" stroke="var(--accent)" stroke-width="7"/>
      <line x1="210" y1="125" x2="240" y2="140" stroke="var(--ink)" stroke-width="7"/>
      <line x1="205" y1="90" x2="235" y2="80" stroke="var(--ink)" stroke-width="7"/>
    </g>`, { viewBox: '0 0 420 210' });
}

function iconGeography() {
  return svgRoot(`
    <g>
      <circle cx="210" cy="105" r="70" fill="color-mix(in srgb, var(--primary) 14%, #fff)" stroke="var(--primary)" stroke-width="8"/>
      <ellipse cx="210" cy="105" rx="28" ry="70" fill="none" stroke="var(--accent)" stroke-width="6"/>
      <line x1="140" y1="105" x2="280" y2="105" stroke="var(--accent)" stroke-width="6"/>
    </g>`, { viewBox: '0 0 420 210' });
}

function iconHistory() {
  return svgRoot(`
    <g>
      <line x1="70" y1="110" x2="350" y2="110" stroke="var(--primary)" stroke-width="10" stroke-linecap="round"/>
      <circle cx="120" cy="110" r="14" fill="#fff" stroke="var(--accent)" stroke-width="7"/>
      <circle cx="210" cy="110" r="14" fill="#fff" stroke="var(--accent)" stroke-width="7"/>
      <circle cx="300" cy="110" r="14" fill="#fff" stroke="var(--accent)" stroke-width="7"/>
      <rect x="170" y="40" width="80" height="40" rx="10" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    </g>`, { viewBox: '0 0 420 210' });
}

/* ---------------- energy diagrams (kept specialized) ---------------- */

function energyCycleDiagram(seg) {
  const labels = ['动能', '势能', '内能', '电能'];
  const pts = segmentPoints(seg, labels);
  const nodes = [
    { x: 450, y: 120, label: labels[0] },
    { x: 700, y: 320, label: labels[1] },
    { x: 450, y: 540, label: labels[2] },
    { x: 200, y: 320, label: labels[3] }
  ];
  return svgRoot(`
    <g id="s2-cycle">
      <circle cx="450" cy="330" r="160" fill="color-mix(in srgb, var(--primary) 8%, #fff)" stroke="var(--line)" stroke-width="4"/>
      <text x="450" y="320" text-anchor="middle" font-size="36" font-weight="900" fill="var(--primary)">E总</text>
      <text x="450" y="365" text-anchor="middle" font-size="28" font-weight="700" fill="var(--neutral)">守恒</text>
      ${nodes.map((n, i) => `<g id="s2-node-${i}" class="energy-node">
        <circle cx="${n.x}" cy="${n.y}" r="58" fill="#fff" stroke="var(--primary)" stroke-width="7"/>
        <text x="${n.x}" y="${n.y + 10}" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">${escapeXml(n.label)}</text>
      </g>`).join('')}
      <g id="s2-arrows" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round">
        <path d="M 510 150 A 210 210 0 0 1 680 270"/>
        <path d="M 700 380 A 210 210 0 0 1 520 520"/>
        <path d="M 390 540 A 210 210 0 0 1 220 390"/>
        <path d="M 200 260 A 210 210 0 0 1 390 150"/>
      </g>
      <g id="s2-arrowheads" fill="var(--accent)">
        <polygon points="680,270 655,250 652,285"/>
        <polygon points="520,520 545,500 510,495"/>
        <polygon points="220,390 245,410 248,375"/>
        <polygon points="390,150 365,170 400,175"/>
      </g>
      <text x="450" y="670" text-anchor="middle" font-size="26" font-weight="700" fill="var(--neutral)">${escapeXml(pts[0])} · ${escapeXml(pts[1])}</text>
    </g>`);
}

function energyConvertTransferDiagram(seg) {
  const pts = segmentPoints(seg, ['转化：形式变', '转移：物体间']);
  return svgRoot(`
    <g id="s3-panels">
      <g id="s3-left">
        <rect x="60" y="80" width="360" height="520" rx="28" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
        <text x="240" y="140" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">转化</text>
        <text x="240" y="185" text-anchor="middle" font-size="24" fill="var(--neutral)">${escapeXml(pts[0])}</text>
        <circle id="s3-ball" cx="180" cy="250" r="34" fill="var(--accent)"/>
        <line x1="180" y1="290" x2="180" y2="480" stroke="var(--line)" stroke-width="6" stroke-dasharray="12 10"/>
        <rect x="130" y="500" width="100" height="24" rx="8" fill="var(--line)"/>
        <text x="300" y="320" font-size="26" font-weight="700" fill="var(--primary)">势能</text>
        <path d="M 300 340 L 300 420" stroke="var(--accent)" stroke-width="8"/>
        <polygon points="300,440 288,415 312,415" fill="var(--accent)"/>
        <text x="300" y="480" font-size="26" font-weight="700" fill="var(--primary)">动能</text>
      </g>
      <g id="s3-right">
        <rect x="480" y="80" width="360" height="520" rx="28" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
        <text x="660" y="140" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">转移</text>
        <text x="660" y="185" text-anchor="middle" font-size="24" fill="var(--neutral)">${escapeXml(pts[1])}</text>
        <rect id="s3-hot" x="530" y="260" width="120" height="160" rx="18" fill="color-mix(in srgb, var(--accent) 55%, #fff)" stroke="var(--accent)" stroke-width="6"/>
        <text x="590" y="350" text-anchor="middle" font-size="28" font-weight="800" fill="var(--ink)">热水</text>
        <rect id="s3-cold" x="680" y="260" width="120" height="160" rx="18" fill="color-mix(in srgb, var(--primary) 18%, #fff)" stroke="var(--primary)" stroke-width="6"/>
        <text x="740" y="350" text-anchor="middle" font-size="28" font-weight="800" fill="var(--ink)">冷水</text>
        <g id="s3-heat-arrows" stroke="var(--accent)" stroke-width="8" fill="var(--accent)" stroke-linecap="round">
          <line x1="655" y1="300" x2="700" y2="300"/><polygon points="700,300 682,291 682,309"/>
          <line x1="655" y1="340" x2="700" y2="340"/><polygon points="700,340 682,331 682,349"/>
          <line x1="655" y1="380" x2="700" y2="380"/><polygon points="700,380 682,371 682,389"/>
        </g>
      </g>
    </g>`);
}

function energyCompareDiagram() {
  return svgRoot(comparePanels(
    '机械能守恒', '能量守恒',
    ['动能 + 势能', '近似无摩擦', '条件更严'],
    ['计及所有形式', '可有摩擦生热', '总量始终不变']
  ).replace('part-compare', 's4-compare').replace('cmp-left', 's4-left').replace('cmp-right', 's4-right') + `
    <g id="s4-warn">
      <rect x="150" y="560" width="600" height="60" rx="16" fill="color-mix(in srgb, var(--accent) 16%, #fff)" stroke="var(--accent)" stroke-width="4"/>
      <text x="450" y="600" text-anchor="middle" font-size="26" font-weight="800" fill="var(--accent)">易错：摩擦时机械能减少，总能量仍守恒</text>
    </g>`);
}

function energyExamplesDiagram() {
  return svgRoot(`
    <g id="s5-examples">
      <g id="s5-pendulum">
        <rect x="50" y="80" width="380" height="520" rx="28" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
        <text x="240" y="145" text-anchor="middle" font-size="32" font-weight="900" fill="var(--primary)">滚摆 / 单摆</text>
        <line id="s5-string" x1="240" y1="190" x2="240" y2="390" stroke="var(--ink)" stroke-width="8" stroke-linecap="round"/>
        <circle id="s5-bob" cx="240" cy="430" r="40" fill="var(--accent)"/>
        <path d="M 140 430 A 100 40 0 0 0 340 430" stroke="var(--line)" stroke-width="5" fill="none" stroke-dasharray="10 10"/>
        <text x="120" y="520" font-size="24" fill="var(--neutral)">势能 ↔ 动能</text>
      </g>
      <g id="s5-hydro">
        <rect x="470" y="80" width="380" height="520" rx="28" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
        <text x="660" y="145" text-anchor="middle" font-size="32" font-weight="900" fill="var(--primary)">水力发电</text>
        <path id="s5-water" d="M 560 210 H 760 V 300 H 560 Z" fill="color-mix(in srgb, var(--primary) 25%, #fff)" stroke="var(--primary)" stroke-width="5"/>
        <path d="M 660 300 V 390" stroke="var(--accent)" stroke-width="10"/>
        <circle id="s5-turbine" cx="660" cy="450" r="55" fill="#fff" stroke="var(--accent)" stroke-width="8"/>
        <g id="s5-blades" stroke="var(--accent)" stroke-width="8" stroke-linecap="round">
          <line x1="660" y1="405" x2="660" y2="495"/>
          <line x1="615" y1="450" x2="705" y2="450"/>
        </g>
        <text x="560" y="560" font-size="24" fill="var(--neutral)">机械能 → 电能 (+内能)</text>
      </g>
    </g>`);
}

/* ---------------- math ---------------- */

function mathTriangleDiagram() {
  return svgRoot(`
    <g id="s2-tri">
      <path id="s2-triangle" d="M 180 520 L 180 180 L 700 520 Z" fill="color-mix(in srgb, var(--primary) 8%, #fff)" stroke="var(--primary)" stroke-width="10" stroke-linejoin="round"/>
      <path d="M 180 470 L 230 470 L 230 520" fill="none" stroke="var(--accent)" stroke-width="8"/>
      <text x="120" y="360" font-size="40" font-weight="900" fill="var(--primary)">a</text>
      <text x="420" y="580" font-size="40" font-weight="900" fill="var(--primary)">b</text>
      <text x="470" y="320" font-size="40" font-weight="900" fill="var(--accent)">c</text>
      <text x="450" y="120" text-anchor="middle" font-size="36" font-weight="900" fill="var(--primary)">a² + b² = c²</text>
    </g>`);
}

/* ---------------- generic helpers ---------------- */

function genericConceptDiagram(seg, sceneNo) {
  const pts = segmentPoints(seg, ['定义', '条件', '例子']);
  const title = clamp(seg.title || `要点${sceneNo - 1}`, 10);
  return svgRoot(`
    <g id="s${sceneNo}-generic">
      <circle id="s${sceneNo}-core" cx="300" cy="320" r="110" fill="color-mix(in srgb, var(--primary) 12%, #fff)" stroke="var(--primary)" stroke-width="8"/>
      <text x="300" y="330" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">${escapeXml(title)}</text>
      ${pts.slice(0, 3).map((p, i) => {
        const y = 160 + i * 140;
        return `<g id="s${sceneNo}-pt-${i + 1}">
          <line x1="410" y1="320" x2="520" y2="${y}" stroke="var(--accent)" stroke-width="6"/>
          <rect x="520" y="${y - 40}" width="300" height="80" rx="18" fill="#fff" stroke="var(--primary)" stroke-width="5"/>
          <text x="540" y="${y + 10}" font-size="28" font-weight="800" fill="var(--ink)">${escapeXml(p)}</text>
        </g>`;
      }).join('')}
    </g>`);
}

function genericProcessDiagram(seg, sceneNo) {
  const pts = segmentPoints(seg, ['起点', '过程', '结果']);
  while (pts.length < 3) pts.push(`步骤${pts.length + 1}`);
  return svgRoot(`
    <g id="s${sceneNo}-flow">
      ${pts.slice(0, 3).map((p, i) => {
        const x = 90 + i * 280;
        return `<g id="s${sceneNo}-flow-${i + 1}">
          <rect x="${x}" y="240" width="220" height="160" rx="24" fill="#fff" stroke="var(--primary)" stroke-width="7"/>
          <circle cx="${x + 40}" cy="280" r="24" fill="var(--accent)"/>
          <text x="${x + 40}" y="290" text-anchor="middle" font-size="26" font-weight="900" fill="#fff">${i + 1}</text>
          <text x="${x + 110}" y="330" text-anchor="middle" font-size="28" font-weight="800" fill="var(--ink)">${escapeXml(p)}</text>
          ${i < 2 ? `<path d="M ${x + 230} 320 L ${x + 270} 320" stroke="var(--accent)" stroke-width="8"/><polygon points="${x + 280},320 ${x + 260},308 ${x + 260},332" fill="var(--accent)"/>` : ''}
        </g>`;
      }).join('')}
    </g>`);
}

function methodDiagram(seg) {
  return svgRoot(methodSteps(seg.points || segmentPoints(seg, ['审条件', '列关系', '计算', '检验'])));
}

/* ---------------- family pickers ---------------- */

function pickDiagram(family, sceneNo, seg, storyboard = {}, input = {}) {
  // 关键词零件优先：更接近“手写示教”的针对性装配
  const kw = assembleByVisualKeywords(seg, storyboard, input, sceneNo);
  if (kw) return kw;

  if (family === 'energy') {
    if (sceneNo === 2) return energyCycleDiagram(seg);
    if (sceneNo === 3) return energyConvertTransferDiagram(seg);
    if (sceneNo === 4) return energyCompareDiagram();
    if (sceneNo === 5) return energyExamplesDiagram();
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'sound') {
    if (sceneNo === 2 || sceneNo === 3) return svgRoot(assembleSoundSource());
    if (sceneNo === 4) {
      return svgRoot(`
        <g id="s4-waves">
          <text x="220" y="80" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">高频 · 高音调</text>
          <polyline id="s4-hi" points="60,180 100,120 140,180 180,120 220,180 260,120 300,180 340,120 380,180" fill="none" stroke="var(--accent)" stroke-width="8"/>
          <text x="660" y="80" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">低频 · 低音调</text>
          <polyline id="s4-lo" points="500,180 580,120 660,180 740,120 820,180" fill="none" stroke="var(--neutral)" stroke-width="8"/>
        </g>`);
    }
    if (sceneNo === 5) {
      return svgRoot(`
        <g id="s5-amp">
          <text x="220" y="90" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">大振幅 · 更响</text>
          <polyline points="60,220 120,80 180,220 240,80 300,220 360,80 420,220" fill="none" stroke="var(--accent)" stroke-width="8"/>
          <text x="680" y="90" text-anchor="middle" font-size="30" font-weight="800" fill="var(--primary)">小振幅 · 更轻</text>
          <polyline points="500,220 560,180 620,220 680,180 740,220 800,180 860,220" fill="none" stroke="var(--neutral)" stroke-width="8"/>
        </g>`);
    }
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'math') {
    if (sceneNo === 2) return mathTriangleDiagram();
    if (sceneNo === 6) return methodDiagram(seg);
    return sceneNo % 2 === 0 ? genericConceptDiagram(seg, sceneNo) : genericProcessDiagram(seg, sceneNo);
  }

  if (family === 'light') {
    if (sceneNo === 2) return svgRoot(opticsRefractionInterface());
    if (sceneNo === 3) return svgRoot(opticsMirrorReflection());
    if (sceneNo === 4) return svgRoot(opticsLensImaging({ imagingCase: 'beyond2f' }));
    if (sceneNo === 5) return svgRoot(opticsLensImagingRules());
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'force') {
    if (sceneNo === 2) return svgRoot(assembleLeverScene());
    if (sceneNo === 3) return svgRoot(mechanicsBlockFriction());
    if (sceneNo === 4) return svgRoot(assemblePulleyCompareScene());
    if (sceneNo === 5) {
      return svgRoot(comparePanels(
        '省力杠杆', '费力杠杆',
        ['动力臂 > 阻力臂', '省力费距离'],
        ['动力臂 < 阻力臂', '费力省距离']
      ));
    }
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'electric') {
    if (sceneNo === 2 || sceneNo === 3) return svgRoot(assembleSeriesCircuit({ closed: true }) + label(450, 640, 'I = U / R', { size: 40, weight: 900, fill: 'var(--primary)', anchor: 'middle', id: 'ohm-formula' }));
    if (sceneNo === 4) return svgRoot(assembleParallelCircuit({ closed: true }));
    if (sceneNo === 5) {
      return svgRoot(comparePanels(
        '串联', '并联',
        ['电流单路径', '总电阻变大', '一处断开全断'],
        ['电流多路径', '总电阻变小', '支路相对独立']
      ));
    }
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'biology') {
    if (sceneNo === 2) return svgRoot(bioLeafCross());
    if (sceneNo === 3) return svgRoot(bioProcessChain(seg.points?.length ? seg.points : ['阳光', '叶绿体', '有机物', '氧气']));
    if (sceneNo === 4) {
      return svgRoot(comparePanels(
        '光合作用', '呼吸作用',
        ['吸收 CO₂ + 水', '释放 O₂', '储存能量'],
        ['消耗有机物 + O₂', '释放 CO₂ + 水', '释放能量']
      ));
    }
    if (sceneNo === 5) return svgRoot(bioProcessChain(['原料', '条件', '场所', '产物']));
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'chemistry') {
    if (sceneNo === 2) return svgRoot(chemMassBalance());
    if (sceneNo === 3) return svgRoot(chemMoleculeWater());
    if (sceneNo === 4) return svgRoot(chemReactionArrow({ left: '反应物', right: '生成物', note: '原子重新组合' }));
    if (sceneNo === 5) return svgRoot(chemCombustionTriangle());
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'geography') {
    if (sceneNo === 2) return svgRoot(geoWaterCycle());
    if (sceneNo === 3) return svgRoot(geoEarthOrbitSeasons());
    if (sceneNo === 4) return svgRoot(geoLatitudeBands());
    if (sceneNo === 5) {
      return svgRoot(comparePanels(
        '内因 / 条件', '外在表现',
        ['太阳辐射', '海陆位置', '地形'],
        ['气温', '降水', '气候类型']
      ));
    }
    if (sceneNo === 6) return methodDiagram(seg);
  }

  if (family === 'history') {
    if (sceneNo === 2) return svgRoot(historyTimeline(seg.points?.length ? seg.points : ['背景', '爆发', '发展', '结果']));
    if (sceneNo === 3 || sceneNo === 4) {
      return svgRoot(historyCauseEffect(
        seg.points?.slice(0, 3) || ['背景矛盾', '导火索', '力量对比'],
        seg.points?.slice(0, 3) || ['直接结果', '制度变化', '长期影响']
      ));
    }
    if (sceneNo === 5) return svgRoot(historyTimeline(['人物', '事件', '制度', '影响']));
    if (sceneNo === 6) return methodDiagram(seg);
  }

  // generic
  if (sceneNo === 6) return methodDiagram(seg);
  if (sceneNo === 3 || sceneNo === 5) return genericProcessDiagram(seg, sceneNo);
  return genericConceptDiagram(seg, sceneNo);
}

/* ---------------- choreography ---------------- */

function sceneChoreography(family, sceneNo) {
  if (family === 'energy') {
    if (sceneNo === 2) {
      return `
      tl.fromTo("#s2-cycle circle, #s2-cycle text", { opacity: 0, scale: 0.85, transformOrigin: "50% 50%" },
        { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.6)" }, t + 0.25);
      tl.fromTo(".energy-node", { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: "power3.out", stagger: 0.12 }, t + 0.7);
      if (typeof drawIn === "function") drawIn("#s2-arrows path", t + 1.2, 0.9, "power2.inOut");
      tl.fromTo("#s2-arrowheads", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "sine.out" }, t + 2.0);
      tl.fromTo("#s2-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.6);
      tl.to("#s2-arrows path, #s2-arrowheads", { opacity: 0.35, yoyo: true, repeat: 10, duration: 0.55, ease: "sine.inOut", stagger: 0.08 }, t + 2.2);
      `;
    }
    if (sceneNo === 3) {
      return `
      tl.fromTo("#s3-left", { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#s3-right", { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 0.45);
      tl.fromTo("#s3-ball", { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.8)" }, t + 1.0);
      tl.to("#s3-ball", { y: 180, yoyo: true, repeat: 7, duration: 0.9, ease: "power1.inOut" }, t + 1.5);
      tl.fromTo("#s3-heat-arrows", { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.5, ease: "sine.out" }, t + 1.3);
      tl.to("#s3-heat-arrows line, #s3-heat-arrows polygon", { opacity: 0.35, yoyo: true, repeat: 9, duration: 0.45, ease: "sine.inOut" }, t + 1.8);
      tl.fromTo("#s3-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.8);
      `;
    }
    if (sceneNo === 4) {
      return `
      tl.fromTo("#s4-left, #cmp-left", { x: -70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#s4-right, #cmp-right", { x: 70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, t + 0.45);
      tl.fromTo("#s4-warn", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "back.out(1.5)" }, t + 1.3);
      tl.to("#s4-warn", { scale: 1.02, transformOrigin: "50% 50%", yoyo: true, repeat: 5, duration: 0.7, ease: "sine.inOut" }, t + 2.0);
      tl.fromTo("#s4-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
    if (sceneNo === 5) {
      return `
      tl.fromTo("#s5-pendulum", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#s5-hydro", { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, t + 0.45);
      tl.to("#s5-string, #s5-bob", { rotation: 18, transformOrigin: "240px 190px", yoyo: true, repeat: 9, duration: 0.7, ease: "sine.inOut" }, t + 1.2);
      tl.to("#s5-blades", { rotation: 360, transformOrigin: "660px 450px", repeat: 6, duration: 1.2, ease: "none" }, t + 1.4);
      tl.fromTo("#s5-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.6);
      `;
    }
  }

  if (family === 'sound' && (sceneNo === 2 || sceneNo === 3)) {
    return `
      if (typeof drawIn === "function") drawIn("#part-fork line, #part-fork path", t + 0.3, 0.7, "power2.inOut");
      tl.fromTo("#part-fork-base", { opacity: 0 }, { opacity: 0.65, duration: 0.4, ease: "sine.out" }, t + 0.9);
      tl.fromTo("#part-vib-arrows", { opacity: 0, scale: 0.7, transformOrigin: "50% 50%" },
        { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, t + 1.2);
      if (typeof drawIn === "function") drawIn(".wave-arc", t + 1.5, 0.9, "power1.out");
      tl.to("#part-vib-arrows line, #part-vib-arrows polygon", { opacity: 0.45, yoyo: true, repeat: 11, duration: 0.4, ease: "sine.inOut" }, t + 2.0);
      tl.fromTo("#s${sceneNo}-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.8);
    `;
  }

  if (family === 'light') {
    if (sceneNo === 2) {
      return `
      tl.fromTo("#part-prism", { opacity: 0, scale: 0.9, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.5)" }, t + 0.2);
      if (typeof drawIn === "function") drawIn("#part-incident", t + 0.8, 0.6, "power2.inOut");
      tl.fromTo("#part-spectrum line", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out", stagger: 0.08 }, t + 1.4);
      tl.to("#part-spectrum line", { opacity: 0.55, yoyo: true, repeat: 6, duration: 0.5, ease: "sine.inOut", stagger: 0.05 }, t + 2.0);
      tl.fromTo("#s2-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
    if (sceneNo === 3) {
      return `
      tl.fromTo("#part-mirror", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.65, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#part-normal", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.out" }, t + 0.9);
      if (typeof drawIn === "function") drawIn("#part-rays line", t + 1.2, 0.8, "power2.inOut");
      tl.fromTo("#s3-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.4);
      `;
    }
    if (sceneNo === 4) {
      return `
      tl.fromTo("#part-lens", { opacity: 0, scale: 0.88, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.4)" }, t + 0.2);
      if (typeof drawIn === "function") drawIn("#part-lens-rays line", t + 0.9, 0.9, "power2.inOut");
      tl.to("#part-lens-rays line", { opacity: 0.5, yoyo: true, repeat: 6, duration: 0.55, ease: "sine.inOut" }, t + 1.8);
      tl.fromTo("#s4-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
  }

  if (family === 'force') {
    if (sceneNo === 2) {
      return `
      tl.fromTo("#part-lever", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#part-load", { y: -20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.7)" }, t + 0.9);
      tl.fromTo("#part-effort", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, t + 1.2);
      tl.to("#part-beam, #part-load, #part-effort", { rotation: -4, transformOrigin: "450px 440px", yoyo: true, repeat: 7, duration: 0.7, ease: "sine.inOut" }, t + 1.6);
      tl.fromTo("#s2-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
    if (sceneNo === 3) {
      return `
      tl.fromTo("#part-friction", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, t + 0.2);
      tl.to("#part-block", { x: 40, yoyo: true, repeat: 6, duration: 0.8, ease: "power1.inOut" }, t + 1.1);
      tl.to("#part-pull, #part-friction-arrow", { opacity: 0.4, yoyo: true, repeat: 8, duration: 0.45, ease: "sine.inOut" }, t + 1.2);
      tl.fromTo("#s3-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
    if (sceneNo === 4) {
      return `
      tl.fromTo("#part-pulley", { opacity: 0, scale: 0.9, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.4)" }, t + 0.2);
      tl.to("#part-wheel", { rotation: 360, transformOrigin: "450px 220px", repeat: 5, duration: 1.2, ease: "none" }, t + 1.0);
      tl.fromTo("#s4-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.3);
      `;
    }
  }

  if (family === 'electric') {
    if (sceneNo === 2 || sceneNo === 3 || sceneNo === 5) {
      return `
      if (typeof drawIn === "function") drawIn(".part-loop", t + 0.3, 0.9, "power2.inOut");
      tl.fromTo(".part-resistor, #part-bulb, .part-battery, #part-switch", { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.1 }, t + 0.9);
      tl.fromTo("#part-current .amp", { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "sine.out", stagger: 0.12 }, t + 1.6);
      tl.to("#part-current .amp", { opacity: 0.25, yoyo: true, repeat: 10, duration: 0.35, ease: "sine.inOut", stagger: 0.08 }, t + 2.0);
      tl.to("#part-bulb circle", { opacity: 0.45, yoyo: true, repeat: 8, duration: 0.4, ease: "sine.inOut" }, t + 2.0);
      tl.fromTo("#s${sceneNo}-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.6);
      `;
    }
  }

  if (family === 'biology') {
    if (sceneNo === 2) {
      return `
      tl.fromTo("#part-leaf", { opacity: 0, scale: 0.9, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.4)" }, t + 0.2);
      tl.to("#part-leaf circle", { opacity: 0.4, yoyo: true, repeat: 8, duration: 0.5, ease: "sine.inOut", stagger: 0.1 }, t + 1.1);
      tl.fromTo("#s2-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.3);
      `;
    }
    if (sceneNo === 3 || sceneNo === 5) {
      return `
      tl.fromTo(".bio-node", { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: 0.18 }, t + 0.25);
      tl.to(".bio-node circle", { scale: 1.06, transformOrigin: "50% 50%", yoyo: true, repeat: 5, duration: 0.5, ease: "sine.inOut", stagger: 0.1 }, t + 1.5);
      tl.fromTo("#s${sceneNo}-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
  }


  if (family === 'chemistry') {
    if (sceneNo === 2) {
      return `
      tl.fromTo("#part-chem-balance, #part-chem-neutralization, #part-chem-metal-series", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#part-pan-left, #part-pan-right, #part-ion-combine, .metal-node", { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.6)", stagger: 0.08 }, t + 0.9);
      tl.to("#part-balance-beam, #part-chem-arrow, .metal-node rect", { rotate: 2, transformOrigin: "50% 50%", yoyo: true, repeat: 7, duration: 0.55, ease: "sine.inOut" }, t + 1.4);
      tl.fromTo("#s2-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.3);
      `;
    }
    if (sceneNo === 3) {
      return `
      tl.fromTo("#atom-o, #atom-h1, #atom-h2", { scale: 0.6, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.8)", stagger: 0.12 }, t + 0.25);
      tl.to("#atom-h1, #atom-h2", { y: -8, yoyo: true, repeat: 8, duration: 0.5, ease: "sine.inOut", stagger: 0.08 }, t + 1.2);
      tl.fromTo("#s3-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.2);
      `;
    }
    if (sceneNo === 4) {
      return `
      tl.fromTo("#part-chem-reaction rect", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.12 }, t + 0.2);
      tl.fromTo("#part-chem-arrow", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, t + 1.0);
      tl.to("#part-chem-arrow", { opacity: 0.45, yoyo: true, repeat: 8, duration: 0.4, ease: "sine.inOut" }, t + 1.5);
      tl.fromTo("#s4-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.2);
      `;
    }
    if (sceneNo === 5) {
      return `
      tl.fromTo(".chem-node", { scale: 0.7, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)", stagger: 0.15 }, t + 0.25);
      tl.to(".chem-node circle", { scale: 1.07, transformOrigin: "50% 50%", yoyo: true, repeat: 6, duration: 0.5, ease: "sine.inOut", stagger: 0.08 }, t + 1.4);
      tl.fromTo("#s5-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.3);
      `;
    }
  }

  if (family === 'geography') {
    if (sceneNo === 2) {
      return `
      tl.fromTo("#part-geo-cycle, #part-geo-contour, #part-geo-climate", { opacity: 0, scale: 0.92, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.5)" }, t + 0.2);
      tl.fromTo(".geo-node, .climate-node, #part-slope-compare", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: 0.12 }, t + 0.8);
      if (typeof drawIn === "function") drawIn("#part-geo-arrows, #part-climate-arrows, #part-geo-contour ellipse", t + 1.4, 1.1, "power2.inOut");
      tl.to("#part-geo-arrows, #part-climate-arrows", { opacity: 0.4, yoyo: true, repeat: 8, duration: 0.5, ease: "sine.inOut" }, t + 2.2);
      tl.fromTo("#s2-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.6);
      `;
    }
    if (sceneNo === 3) {
      return `
      tl.fromTo("#part-sun", { scale: 0.6, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.8)" }, t + 0.2);
      tl.fromTo("#part-orbit", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.out" }, t + 0.7);
      tl.fromTo(".earth-pos", { scale: 0.5, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(1.6)", stagger: 0.12 }, t + 1.1);
      tl.to(".earth-pos circle", { scale: 1.1, transformOrigin: "50% 50%", yoyo: true, repeat: 6, duration: 0.5, ease: "sine.inOut", stagger: 0.08 }, t + 1.9);
      tl.fromTo("#s3-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
    if (sceneNo === 4 || sceneNo === 5) {
      return `
      tl.fromTo("#s${sceneNo}-diagram svg", { opacity: 0, scale: 0.92, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.5)" }, t + 0.2);
      tl.fromTo("#cmp-left", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, t + 0.5);
      tl.fromTo("#cmp-right", { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, t + 0.7);
      tl.fromTo("#s${sceneNo}-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 1.6);
      `;
    }
  }

  if (family === 'history') {
    if (sceneNo === 2 || sceneNo === 5) {
      return `
      if (typeof drawIn === "function") drawIn("#part-timeline", t + 0.3, 0.9, "power2.inOut");
      tl.fromTo(".hist-node", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out", stagger: 0.16 }, t + 1.0);
      tl.to(".hist-node circle", { scale: 1.15, transformOrigin: "50% 50%", yoyo: true, repeat: 5, duration: 0.45, ease: "sine.inOut", stagger: 0.08 }, t + 2.0);
      tl.fromTo("#s${sceneNo}-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.5);
      `;
    }
    if (sceneNo === 3 || sceneNo === 4) {
      return `
      tl.fromTo("#cmp-left", { x: -70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, t + 0.2);
      tl.fromTo("#cmp-right", { x: 70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.65, ease: "power3.out" }, t + 0.45);
      tl.fromTo("#s${sceneNo}-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 1.4);
      `;
    }
  }


  if (sceneNo === 6 || /method-step|part-method-steps/.test('method')) {
    // method steps shared
  }

  // method step scenes & compare panels & generic fallback
  return `
      tl.fromTo("#s${sceneNo}-diagram svg", { opacity: 0, scale: 0.92, transformOrigin: "50% 50%" },
        { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.5)" }, t + 0.2);
      tl.fromTo("#s${sceneNo}-diagram svg g, #s${sceneNo}-diagram svg rect, #s${sceneNo}-diagram svg circle, #s${sceneNo}-diagram svg path, #s${sceneNo}-diagram svg text, #s${sceneNo}-diagram svg line, #s${sceneNo}-diagram svg polygon",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.03 }, t + 0.5);
      if (typeof drawIn === "function") drawIn("#s${sceneNo}-diagram path, #s${sceneNo}-diagram line", t + 0.8, 0.8, "power2.inOut");
      tl.fromTo(".method-step", { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power2.out", stagger: 0.14 }, t + 0.7);
      tl.fromTo("#cmp-left", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, t + 0.3);
      tl.fromTo("#cmp-right", { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, t + 0.5);
      tl.fromTo("#s${sceneNo}-card", { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "power3.out" }, t + 2.3);
      tl.to("#s${sceneNo}-diagram svg circle, #s${sceneNo}-diagram svg rect",
        { opacity: 0.7, yoyo: true, repeat: 5, duration: 0.55, ease: "sine.inOut", stagger: 0.06 }, t + 1.6);
  `;
}

function replaceSceneFunction(html, sceneNo, body) {
  const re = new RegExp(`function scene${sceneNo}\\(t\\) \\{[\\s\\S]*?\\n    \\}`, 'm');
  if (!re.test(html)) return html;
  const normalized = body.replace(/^\n/, '').replace(/\n\s*$/, '\n');
  return html.replace(re, `function scene${sceneNo}(t) {\n${normalized}    }`);
}

function injectDiagramIntoScene(html, sceneNo, svgMarkup) {
  const re = new RegExp(
    `(<div class="diagram-zone" id="s${sceneNo}-diagram">)[\\s\\S]*?(</div>\\s*<div class="card-zone">)`,
    'm'
  );
  if (re.test(html)) return html.replace(re, `$1\n          ${svgMarkup}\n        $2`);
  const re2 = new RegExp(
    `(<div id="s${sceneNo}" class="scene">[\\s\\S]*?<div class="diagram-zone"[^>]*>)[\\s\\S]*?(</div>\\s*<div class="card-zone">)`,
    'm'
  );
  if (re2.test(html)) return html.replace(re2, `$1\n          ${svgMarkup}\n        $2`);
  return html;
}

function injectScene1Icon(html, iconSvg) {
  const re = /(<div id="s1-icon"[^>]*>)[\s\S]*?(<\/div>)/m;
  if (!re.test(html)) return html;
  return html.replace(re, `$1\n          ${iconSvg}\n        $2`);
}

export function enhanceTeachingAnimations(html, storyboard = {}, input = {}) {
  if (!html) return html;
  const family = detectFamily(storyboard, input);
  let out = html;
  out = injectScene1Icon(out, pickIcon(family));

  for (let sceneNo = 2; sceneNo <= 6; sceneNo += 1) {
    const seg = (storyboard.segments || [])[sceneNo - 1] || {};
    out = injectDiagramIntoScene(out, sceneNo, pickDiagram(family, sceneNo, seg, storyboard, input));
    out = replaceSceneFunction(out, sceneNo, sceneChoreography(family, sceneNo));
  }

  // mild continuous pulse on icon
  out = out.replace(
    /function scene1\(t\) \{([\s\S]*?)\n    \}/m,
    (full, body) => {
      if (body.includes('yoyo: true') && body.includes('#s1-icon')) return full;
      const extra = `\n      tl.to("#s1-icon", { scale: 1.05, transformOrigin: "50% 50%", yoyo: true, repeat: 5, duration: 0.8, ease: "sine.inOut" }, t + 1.6);`;
      return `function scene1(t) {${body}${extra}\n    }`;
    }
  );

  if (!out.includes('data-animation-enhanced')) {
    out = out.replace('<body>', `<body data-animation-enhanced="${family}">`);
    if (!out.includes('data-animation-enhanced')) out = out.replace('<html', `<html data-animation-enhanced="${family}"`);
  } else {
    out = out.replace(/data-animation-enhanced="[^"]*"/, `data-animation-enhanced="${family}"`);
  }
  return out;
}

export function animationFamilyFor(storyboard, input) {
  return detectFamily(storyboard, input);
}

export {
  pickDiagram,
  pickIcon,
  sceneChoreography
};

export default {
  enhanceTeachingAnimations,
  animationFamilyFor,
  detectFamily,
  pickDiagram,
  pickIcon,
  sceneChoreography,
  assembleByVisualKeywords
};
