// server/services/svgParts.js
// 对照 ai-teaching-media/references/svg-parts.md 的可组装 SVG 零件库。
// 约定: diagram-zone viewBox 默认 0 0 900 700；颜色用 CSS 变量。

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function svgRoot(inner, { viewBox = '0 0 900 700', style = 'width:100%;height:100%;overflow:visible;' } = {}) {
  return `<svg viewBox="${viewBox}" style="${style}">\n${inner}\n</svg>`;
}

export function label(x, y, text, {
  size = 28, weight = 800, fill = 'var(--ink)', anchor = 'start', id = ''
} = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  return `<text${idAttr} x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

export function arrow(x1, y1, x2, y2, {
  id = '', stroke = 'var(--accent)', width = 7, head = 14
} = {}) {
  const idAttr = id ? ` id="${id}"` : '';
  // simple end polygon approximate for horizontal/vertical-ish lines
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const px = -uy;
  const py = ux;
  const p1x = bx + px * (head * 0.45);
  const p1y = by + py * (head * 0.45);
  const p2x = bx - px * (head * 0.45);
  const p2y = by - py * (head * 0.45);
  return `<g${idAttr} stroke="${stroke}" stroke-width="${width}" fill="${stroke}" stroke-linecap="round">
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>
    <polygon points="${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}"/>
  </g>`;
}

/* ---------------- 电学 ---------------- */

export function electricBattery({ x = 420, y = 480 } = {}) {
  return `<g class="part-battery">
    <line x1="${x}" y1="${y - 28}" x2="${x}" y2="${y + 28}" stroke="var(--primary)" stroke-width="7"/>
    <line x1="${x + 60}" y1="${y - 14}" x2="${x + 60}" y2="${y + 14}" stroke="var(--primary)" stroke-width="7"/>
  </g>`;
}

export function electricResistor({ x = 340, y = 180, w = 120, h = 40 } = {}) {
  return `<rect class="part-resistor" x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="var(--primary)" stroke-width="7"/>`;
}

export function electricMeter({ cx = 280, cy = 220, letter = 'A' } = {}) {
  return `<g class="part-meter">
    <circle cx="${cx}" cy="${cy}" r="42" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    <text x="${cx - 18}" y="${cy + 18}" font-size="46" font-weight="800" fill="var(--primary)">${escapeXml(letter)}</text>
  </g>`;
}

export function electricBulb({ cx = 300, cy = 105, r = 27 } = {}) {
  return `<g class="part-bulb" id="part-bulb">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="color-mix(in srgb, var(--highlight, #ffe08a) 55%, transparent)" stroke="var(--primary)" stroke-width="6"/>
    <path d="M ${cx - 19} ${cy - 19} L ${cx + 19} ${cy + 19} M ${cx + 19} ${cy - 19} L ${cx - 19} ${cy + 19}" stroke="var(--primary)" stroke-width="5"/>
  </g>`;
}

export function electricSwitch({ open = true } = {}) {
  if (open) {
    return `<g class="part-switch" id="part-switch">
      <circle cx="500" cy="480" r="7" fill="var(--primary)"/>
      <line x1="500" y1="480" x2="560" y2="440" stroke="var(--primary)" stroke-width="7" stroke-linecap="round"/>
      <circle cx="580" cy="480" r="7" fill="var(--primary)"/>
    </g>`;
  }
  return `<g class="part-switch" id="part-switch">
    <circle cx="500" cy="480" r="7" fill="var(--primary)"/>
    <line x1="500" y1="480" x2="580" y2="480" stroke="var(--primary)" stroke-width="7" stroke-linecap="round"/>
    <circle cx="580" cy="480" r="7" fill="var(--primary)"/>
  </g>`;
}

export function electricLoopSkeleton() {
  return `<path class="part-loop" d="M 150 480 V 200 H 340 M 460 200 H 730 V 480 H 480 M 420 480 H 150"
    stroke="var(--primary)" stroke-width="7" fill="none" stroke-linecap="round"/>`;
}

export function electricCurrentArrows() {
  return `<g class="part-current" id="part-current" fill="var(--accent)">
    <polygon class="amp" points="230,190 256,200 230,210"/>
    <polygon class="amp" points="520,190 546,200 520,210"/>
    <polygon class="amp" points="700,260 710,286 690,286"/>
    <polygon class="amp" points="700,420 710,446 690,446"/>
    <polygon class="amp" points="560,480 534,470 534,490"/>
    <polygon class="amp" points="260,480 234,470 234,490"/>
  </g>`;
}

export function assembleSeriesCircuit({ closed = false } = {}) {
  return [
    electricLoopSkeleton(),
    electricResistor({ x: 340, y: 180 }),
    electricBulb({ cx: 600, cy: 105 }),
    electricBattery({ x: 420, y: 480 }),
    electricSwitch({ open: !closed }),
    electricCurrentArrows(),
    label(360, 160, '电阻 R', { size: 24, fill: 'var(--neutral)' }),
    label(560, 70, '灯泡', { size: 24, fill: 'var(--neutral)' }),
    label(430, 560, closed ? '开关闭合 · 电流形成' : '开关断开 · 无电流', { size: 26, fill: 'var(--primary)', anchor: 'middle' })
  ].join('\n');
}

/** 并联电路：电源 + 干路开关 + 两条支路灯泡 */
export function assembleParallelCircuit({ closed = true } = {}) {
  const switchOpen = !closed;
  return `<g id="part-parallel-circuit">
    <!-- outer rails -->
    <path id="part-parallel-loop" class="part-loop" d="M 160 470 V 180 H 740 V 470 H 160 Z"
      fill="none" stroke="var(--primary)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- branch bridge -->
    <line x1="300" y1="180" x2="300" y2="470" stroke="var(--primary)" stroke-width="7"/>
    <line x1="560" y1="180" x2="560" y2="470" stroke="var(--primary)" stroke-width="7"/>
    <!-- top branch bulb -->
    ${electricBulb({ cx: 430, cy: 150, r: 26 })}
    <text x="430" y="105" text-anchor="middle" font-size="24" font-weight="700" fill="var(--neutral)">支路1</text>
    <!-- bottom branch bulb -->
    <g id="part-bulb-2" class="part-bulb">
      <circle cx="430" cy="500" r="26" fill="color-mix(in srgb, var(--highlight, #ffe08a) 55%, transparent)" stroke="var(--primary)" stroke-width="6"/>
      <path d="M 411 481 L 449 519 M 449 481 L 411 519" stroke="var(--primary)" stroke-width="5"/>
    </g>
    <text x="430" y="560" text-anchor="middle" font-size="24" font-weight="700" fill="var(--neutral)">支路2</text>
    <!-- battery on left -->
    ${electricBattery({ x: 200, y: 325 })}
    <text x="185" y="390" text-anchor="middle" font-size="22" fill="var(--neutral)">电源</text>
    <!-- main switch on right rail -->
    <g id="part-switch" class="part-switch">
      <circle cx="740" cy="300" r="8" fill="var(--primary)"/>
      <circle cx="740" cy="360" r="8" fill="var(--primary)"/>
      ${switchOpen
        ? '<line x1="740" y1="300" x2="700" y2="330" stroke="var(--primary)" stroke-width="7" stroke-linecap="round"/>'
        : '<line x1="740" y1="300" x2="740" y2="360" stroke="var(--primary)" stroke-width="7" stroke-linecap="round"/>'}
    </g>
    <text x="790" y="335" font-size="22" fill="var(--neutral)">干路开关</text>
    <!-- branch current arrows -->
    <g id="part-parallel-current" class="part-current" fill="var(--accent)">
      <polygon class="amp branch1" points="360,180 386,190 360,200"/>
      <polygon class="amp branch2" points="360,470 386,480 360,490"/>
      <polygon class="amp trunk" points="250,180 276,190 250,200"/>
      <polygon class="amp trunk" points="650,180 676,190 650,200"/>
      <polygon class="amp trunk" points="720,240 730,266 710,266"/>
      <polygon class="amp trunk" points="250,470 224,460 224,480"/>
    </g>
    ${label(450, 620, closed ? '并联：电流多路径 · 支路相对独立' : '干路断开 · 两条支路都无电流', { size: 28, fill: 'var(--primary)', anchor: 'middle' })}
  </g>`;
}

/* ---------------- 声学 ---------------- */

export function soundTuningFork() {
  return `<g id="part-fork" stroke="var(--ink)" stroke-width="12" fill="none" stroke-linecap="round">
    <line x1="260" y1="120" x2="260" y2="360"/>
    <line x1="340" y1="120" x2="340" y2="360"/>
    <path d="M 260 360 A 40 40 0 0 0 340 360"/>
    <line x1="300" y1="398" x2="300" y2="520"/>
  </g>
  <rect id="part-fork-base" x="240" y="520" width="120" height="28" rx="8" fill="var(--line)" opacity="0.65"/>`;
}

export function soundVibrationArrows() {
  return `<g id="part-vib-arrows" stroke="var(--primary)" stroke-width="7" fill="var(--primary)" stroke-linecap="round">
    <line x1="235" y1="160" x2="185" y2="160"/><polygon points="185,160 202,151 202,169"/>
    <line x1="365" y1="160" x2="415" y2="160"/><polygon points="415,160 398,151 398,169"/>
  </g>`;
}

export function soundWaveArcs() {
  return `<g id="part-wave-arcs" stroke="var(--accent)" fill="none" stroke-linecap="round">
    <path class="wave-arc" d="M 480 190 A 62 62 0 0 1 480 314" stroke-width="6" opacity="0.9"/>
    <path class="wave-arc" d="M 512 156 A 104 104 0 0 1 512 348" stroke-width="5" opacity="0.6"/>
    <path class="wave-arc" d="M 544 122 A 148 148 0 0 1 544 382" stroke-width="5" opacity="0.4"/>
    <path class="wave-arc" d="M 576 88 A 192 192 0 0 1 576 416" stroke-width="4" opacity="0.25"/>
  </g>`;
}

export function assembleSoundSource() {
  return [soundTuningFork(), soundVibrationArrows(), soundWaveArcs(), label(560, 540, '振动发声', { size: 28, fill: 'var(--neutral)' })].join('\n');
}

/* ---------------- 力学 ---------------- */

export function mechanicsLever() {
  return `<g id="part-lever">
    <polygon points="450,430 410,500 490,500" fill="color-mix(in srgb, var(--primary) 25%, #fff)" stroke="var(--primary)" stroke-width="5"/>
    <line id="part-beam" x1="150" y1="440" x2="750" y2="415" stroke="var(--ink)" stroke-width="9" stroke-linecap="round"/>
    <rect id="part-load" x="170" y="360" width="70" height="70" fill="color-mix(in srgb, var(--accent) 70%, #fff)" stroke="var(--ink)" stroke-width="5"/>
    <g id="part-effort" stroke="var(--accent)" stroke-width="7" fill="var(--accent)" stroke-linecap="round">
      <line x1="700" y1="410" x2="700" y2="300"/>
      <polygon points="700,290 686,316 714,316"/>
    </g>
    ${label(430, 560, '支点', { size: 24, fill: 'var(--neutral)', anchor: 'middle' })}
    ${label(170, 340, '阻力', { size: 24, fill: 'var(--primary)' })}
    ${label(680, 270, '动力', { size: 24, fill: 'var(--accent)' })}
  </g>`;
}

export function mechanicsBlockFriction() {
  return `<g id="part-friction">
    <line x1="100" y1="500" x2="800" y2="500" stroke="var(--ink)" stroke-width="6"/>
    <rect id="part-block" x="330" y="400" width="140" height="100" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    <g id="part-pull" stroke="var(--accent)" stroke-width="7" fill="var(--accent)" stroke-linecap="round">
      <line x1="470" y1="450" x2="590" y2="450"/>
      <polygon points="600,450 574,436 574,464"/>
    </g>
    <g id="part-friction-arrow" stroke="var(--neutral)" stroke-width="7" fill="var(--neutral)" stroke-linecap="round">
      <line x1="330" y1="450" x2="230" y2="450"/>
      <polygon points="220,450 246,436 246,464"/>
    </g>
    ${label(500, 390, '拉力', { size: 24, fill: 'var(--accent)' })}
    ${label(180, 430, '摩擦力', { size: 24, fill: 'var(--neutral)' })}
  </g>`;
}

export function mechanicsPulley() {
  // 兼容旧调用：默认定滑轮
  return mechanicsFixedPulley();
}

/** 定滑轮：只改变力的方向，不省力 (F = G) */
export function mechanicsFixedPulley() {
  return `<g id="part-pulley" class="part-fixed-pulley">
    <line x1="450" y1="90" x2="450" y2="150" stroke="var(--ink)" stroke-width="7"/>
    <rect x="420" y="70" width="60" height="24" rx="6" fill="var(--line)"/>
    <circle id="part-wheel" cx="450" cy="210" r="56" fill="#fff" stroke="var(--primary)" stroke-width="7"/>
    <circle cx="450" cy="210" r="10" fill="var(--primary)"/>
    <line id="part-rope-left" x1="394" y1="210" x2="394" y2="430" stroke="var(--ink)" stroke-width="6"/>
    <line id="part-rope-right" x1="506" y1="210" x2="506" y2="360" stroke="var(--ink)" stroke-width="6"/>
    <rect id="part-load" x="356" y="430" width="76" height="58" rx="8" fill="var(--accent)" opacity="0.9"/>
    <text x="394" y="468" text-anchor="middle" font-size="24" font-weight="800" fill="#fff">G</text>
    <g id="part-effort" stroke="var(--accent)" stroke-width="7" fill="var(--accent)" stroke-linecap="round">
      <line x1="506" y1="360" x2="506" y2="470"/>
      <polygon points="506,485 492,458 520,458"/>
    </g>
    <text x="560" y="430" font-size="28" font-weight="800" fill="var(--accent)">F</text>
    ${label(450, 560, '定滑轮：改变方向 · 不省力  F = G', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
    ${label(450, 610, '自由端拉力方向可改，大小仍约等于物重', { size: 24, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/** 动滑轮：省力费距离 (理想 F = G/2) */
export function mechanicsMovablePulley() {
  return `<g id="part-movable-pulley" class="part-movable-pulley">
    <line x1="300" y1="100" x2="620" y2="100" stroke="var(--ink)" stroke-width="8"/>
    <circle cx="320" cy="100" r="10" fill="var(--primary)"/>
    <circle id="part-wheel" cx="450" cy="250" r="52" fill="#fff" stroke="var(--primary)" stroke-width="7"/>
    <circle cx="450" cy="250" r="10" fill="var(--primary)"/>
    <path id="part-rope" d="M 320 100 V 250 H 450 M 450 250 H 580 V 120" fill="none" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>
    <g id="part-effort" stroke="var(--accent)" stroke-width="7" fill="var(--accent)" stroke-linecap="round">
      <line x1="580" y1="120" x2="580" y2="200"/>
      <polygon points="580,215 566,188 594,188"/>
    </g>
    <text x="620" y="170" font-size="28" font-weight="800" fill="var(--accent)">F</text>
    <rect id="part-load" x="410" y="330" width="80" height="60" rx="8" fill="var(--accent)" opacity="0.9"/>
    <text x="450" y="370" text-anchor="middle" font-size="24" font-weight="800" fill="#fff">G</text>
    <text x="450" y="450" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">F ≈ G / 2</text>
    ${label(450, 520, '动滑轮：省力 · 费距离', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
    ${label(450, 570, '承担物重的绳子段数 n=2，理想拉力减半', { size: 24, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/** 定滑轮 vs 动滑轮对照（纠正“定滑轮省力”误解） */
export function assemblePulleyCompareScene() {
  return `<g id="part-pulley-compare">
    <g id="cmp-left" transform="translate(-80,20) scale(0.78)">
      ${mechanicsFixedPulley()}
    </g>
    <g id="cmp-right" transform="translate(320,10) scale(0.78)">
      ${mechanicsMovablePulley()}
    </g>
    ${label(220, 40, '定滑轮', { size: 30, weight: 900, fill: 'var(--primary)', anchor: 'middle' })}
    ${label(680, 40, '动滑轮', { size: 30, weight: 900, fill: 'var(--accent)', anchor: 'middle' })}
    ${label(450, 640, '省力靠动滑轮/滑轮组，不是定滑轮', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

export function assembleLeverScene() {
  return mechanicsLever();
}

/* ---------------- 光学 ---------------- */

export function opticsPrismDispersion() {
  return `<g id="part-prism">
    <polygon points="450,180 330,430 570,430" fill="color-mix(in srgb, var(--primary) 8%, #fff)" stroke="var(--primary)" stroke-width="6"/>
    <line id="part-incident" x1="150" y1="330" x2="395" y2="320" stroke="var(--ink)" stroke-width="5"/>
    <g id="part-spectrum" stroke-width="5">
      <line x1="510" y1="320" x2="790" y2="260" stroke="#E63946"/>
      <line x1="510" y1="325" x2="790" y2="310" stroke="#F4A300"/>
      <line x1="510" y1="330" x2="790" y2="360" stroke="#06A77D"/>
      <line x1="510" y1="335" x2="790" y2="410" stroke="#118AB2"/>
    </g>
    ${label(150, 300, '白光', { size: 26, fill: 'var(--ink)' })}
    ${label(650, 230, '色散', { size: 26, fill: 'var(--primary)' })}
  </g>`;
}

export function opticsMirrorReflection() {
  return `<g id="part-mirror">
    <line x1="250" y1="500" x2="650" y2="500" stroke="var(--ink)" stroke-width="8"/>
    <line id="part-normal" x1="450" y1="500" x2="450" y2="180" stroke="var(--neutral)" stroke-width="4" stroke-dasharray="12 10"/>
    <g id="part-rays" stroke="var(--primary)" stroke-width="6" fill="var(--primary)" stroke-linecap="round">
      <line x1="220" y1="240" x2="450" y2="500"/>
      <line x1="450" y1="500" x2="680" y2="240"/>
      <polygon points="668,226 690,232 676,252"/>
    </g>
    ${label(450, 160, '法线', { size: 24, fill: 'var(--neutral)', anchor: 'middle' })}
    ${label(250, 220, '入射', { size: 24, fill: 'var(--primary)' })}
    ${label(650, 220, '反射', { size: 24, fill: 'var(--primary)' })}
  </g>`;
}

export function opticsConvexLens() {
  return `<g id="part-lens">
    <path d="M 450 180 C 490 300, 490 400, 450 520 C 410 400, 410 300, 450 180 Z"
      fill="color-mix(in srgb, var(--primary) 10%, #fff)" stroke="var(--primary)" stroke-width="6"/>
    <line id="part-axis" x1="120" y1="350" x2="780" y2="350" stroke="var(--neutral)" stroke-width="4" stroke-dasharray="14 12"/>
    <g id="part-lens-rays" stroke="var(--accent)" stroke-width="5" fill="none">
      <line x1="140" y1="250" x2="450" y2="250"/>
      <line x1="450" y1="250" x2="760" y2="430"/>
      <line x1="140" y1="350" x2="760" y2="350"/>
      <line x1="140" y1="450" x2="450" y2="450"/>
      <line x1="450" y1="450" x2="760" y2="270"/>
    </g>
    ${label(450, 150, '凸透镜', { size: 28, fill: 'var(--primary)', anchor: 'middle' })}
  </g>`;
}

/* ---------------- 生物/流程链 ---------------- */

export function bioProcessChain(nodes = []) {
  const list = (nodes.length ? nodes : ['阳光', '叶绿体', '有机物', '氧气']).slice(0, 4);
  const gap = 200;
  const startX = 140;
  const y = 320;
  return `<g id="part-bio-chain">
    ${list.map((name, i) => {
      const x = startX + i * gap;
      const icon = ['☀', '🌿', '🍬', 'O₂'][i] || '•';
      return `<g class="bio-node" id="bio-node-${i + 1}">
        <circle cx="${x}" cy="${y}" r="58" fill="color-mix(in srgb, var(--primary) 10%, #fff)" stroke="var(--primary)" stroke-width="5"/>
        <text x="${x}" y="${y + 14}" text-anchor="middle" font-size="34" fill="var(--primary)">${icon}</text>
        <text x="${x}" y="${y + 100}" text-anchor="middle" font-size="28" font-weight="800" fill="var(--ink)">${escapeXml(name)}</text>
        ${i < list.length - 1 ? `<g stroke="var(--accent)" stroke-width="6" fill="var(--accent)" stroke-linecap="round">
          <line x1="${x + 70}" y1="${y}" x2="${x + gap - 70}" y2="${y}"/>
          <polygon points="${x + gap - 58},${y} ${x + gap - 82},${y - 12} ${x + gap - 82},${y + 12}"/>
        </g>` : ''}
      </g>`;
    }).join('\n')}
  </g>`;
}

export function bioLeafCross() {
  return `<g id="part-leaf">
    <ellipse cx="450" cy="320" rx="260" ry="150" fill="color-mix(in srgb, var(--primary) 18%, #fff)" stroke="var(--primary)" stroke-width="7"/>
    <path d="M 220 320 C 360 220, 540 220, 680 320 C 540 420, 360 420, 220 320" fill="none" stroke="var(--accent)" stroke-width="6"/>
    <circle cx="360" cy="280" r="18" fill="var(--accent)" opacity="0.8"/>
    <circle cx="500" cy="300" r="14" fill="var(--accent)" opacity="0.7"/>
    <circle cx="430" cy="360" r="16" fill="var(--accent)" opacity="0.75"/>
    ${label(450, 520, '叶绿体吸收光能', { size: 30, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/* ---------------- 坐标/通用 ---------------- */


/* ---------------- 光学：折射界面（比色散更贴近“光的折射”定义） ---------------- */

export function opticsRefractionInterface() {
  return `<g id="part-refract-interface">
    <line id="part-boundary" x1="80" y1="350" x2="820" y2="350" stroke="var(--ink)" stroke-width="6"/>
    <text x="120" y="250" font-size="28" font-weight="800" fill="var(--primary)">空气</text>
    <text x="120" y="470" font-size="28" font-weight="800" fill="var(--primary)">水</text>
    <line id="part-normal" x1="450" y1="120" x2="450" y2="580" stroke="var(--neutral)" stroke-width="4" stroke-dasharray="12 10"/>
    <g id="part-incident" stroke="var(--accent)" stroke-width="7" fill="var(--accent)" stroke-linecap="round">
      <line x1="180" y1="140" x2="450" y2="350"/>
      <polygon points="450,350 422,332 428,360"/>
    </g>
    <g id="part-refracted" stroke="var(--primary)" stroke-width="7" fill="var(--primary)" stroke-linecap="round">
      <line x1="450" y1="350" x2="620" y2="560"/>
      <polygon points="620,560 592,545 608,530"/>
    </g>
    ${label(250, 180, '入射光线', { size: 26, fill: 'var(--accent)' })}
    ${label(560, 500, '折射光线', { size: 26, fill: 'var(--primary)' })}
    ${label(470, 150, '法线', { size: 24, fill: 'var(--neutral)' })}
    ${label(450, 640, '折射：进入另一介质后方向改变', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/**
 * 凸透镜成像专用图：光心/焦点/2F + 三条特征光线 + 倒立实像
 * case:
 *  - beyond2f: 物在 2F 外 → 缩小倒立实像 (默认示教)
 *  - at2f: 物在 2F → 等大倒立实像
 *  - between_f_2f: 物在 F~2F → 放大倒立实像
 */
export function opticsLensImaging({ imagingCase = 'beyond2f' } = {}) {
  const cases = {
    beyond2f: {
      objX: 150, objH: 110, imgX: 720, imgH: 55, note: 'u>2f：缩小、倒立、实像', title: '物在二倍焦距以外'
    },
    at2f: {
      objX: 220, objH: 90, imgX: 680, imgH: 90, note: 'u=2f：等大、倒立、实像', title: '物在二倍焦距处'
    },
    between_f_2f: {
      objX: 300, objH: 70, imgX: 760, imgH: 120, note: 'f<u<2f：放大、倒立、实像', title: '物在 f 与 2f 之间'
    }
  };
  const c = cases[imagingCase] || cases.beyond2f;
  const axisY = 350;
  const lensX = 450;
  const f = 110;
  const objTop = axisY - c.objH;
  const imgTop = axisY; // inverted image hangs below for simplicity of arrows; draw inverted down
  const imgBottom = axisY + c.imgH;
  return `<g id="part-lens-imaging" data-imaging-case="${imagingCase}">
    <!-- optical axis -->
    <line id="part-axis" x1="60" y1="${axisY}" x2="840" y2="${axisY}" stroke="var(--neutral)" stroke-width="4" stroke-dasharray="14 10"/>
    <!-- lens -->
    <path id="part-lens" d="M ${lensX} 170 C 500 300, 500 400, ${lensX} 530 C 400 400, 400 300, ${lensX} 170 Z"
      fill="color-mix(in srgb, var(--primary) 12%, #fff)" stroke="var(--primary)" stroke-width="6"/>
    <text x="${lensX}" y="150" text-anchor="middle" font-size="28" font-weight="900" fill="var(--primary)">凸透镜</text>
    <!-- focus markers -->
    <g id="part-foci" fill="var(--accent)">
      <circle id="focus-f1" cx="${lensX - f}" cy="${axisY}" r="7"/>
      <circle id="focus-2f1" cx="${lensX - 2 * f}" cy="${axisY}" r="6"/>
      <circle id="focus-f2" cx="${lensX + f}" cy="${axisY}" r="7"/>
      <circle id="focus-2f2" cx="${lensX + 2 * f}" cy="${axisY}" r="6"/>
      <text x="${lensX - f}" y="${axisY + 36}" text-anchor="middle" font-size="22" fill="var(--accent)">F</text>
      <text x="${lensX - 2 * f}" y="${axisY + 36}" text-anchor="middle" font-size="22" fill="var(--accent)">2F</text>
      <text x="${lensX + f}" y="${axisY + 36}" text-anchor="middle" font-size="22" fill="var(--accent)">F</text>
      <text x="${lensX + 2 * f}" y="${axisY + 36}" text-anchor="middle" font-size="22" fill="var(--accent)">2F</text>
    </g>
    <!-- object (upright arrow) -->
    <g id="part-object" stroke="var(--accent)" fill="var(--accent)" stroke-width="6" stroke-linecap="round">
      <line x1="${c.objX}" y1="${axisY}" x2="${c.objX}" y2="${objTop}"/>
      <polygon points="${c.objX},${objTop - 14} ${c.objX - 12},${objTop + 12} ${c.objX + 12},${objTop + 12}"/>
      <text x="${c.objX}" y="${axisY + 50}" text-anchor="middle" font-size="24" font-weight="800">物</text>
    </g>
    <!-- image (inverted arrow) -->
    <g id="part-image" stroke="var(--primary)" fill="var(--primary)" stroke-width="6" stroke-linecap="round">
      <line x1="${c.imgX}" y1="${axisY}" x2="${c.imgX}" y2="${imgBottom}"/>
      <polygon points="${c.imgX},${imgBottom + 14} ${c.imgX - 12},${imgBottom - 12} ${c.imgX + 12},${imgBottom - 12}"/>
      <text x="${c.imgX}" y="${imgBottom + 46}" text-anchor="middle" font-size="24" font-weight="800">像</text>
    </g>
    <!-- three characteristic rays -->
    <g id="part-rays" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round">
      <!-- parallel to axis then through far focus -->
      <path id="ray-parallel" d="M ${c.objX} ${objTop} L ${lensX} ${objTop} L ${c.imgX} ${imgBottom}"/>
      <!-- through optical center -->
      <path id="ray-center" d="M ${c.objX} ${objTop} L ${c.imgX} ${imgBottom}"/>
      <!-- through near focus then parallel -->
      <path id="ray-focus" d="M ${c.objX} ${objTop} L ${lensX - f} ${axisY} L ${lensX} ${axisY + Math.max(24, Math.round(c.imgH * 0.35))} L ${c.imgX} ${imgBottom}"/>
    </g>
    ${label(450, 600, c.title, { size: 28, weight: 800, fill: 'var(--primary)', anchor: 'middle' })}
    ${label(450, 645, c.note, { size: 26, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

export function opticsLensImagingRules() {
  return comparePanels(
    '物距 u 与焦距 f',
    '像的性质',
    ['u>2f 缩小倒立实像', 'u=2f 等大倒立实像', 'f<u<2f 放大倒立实像', 'u<f 正立放大虚像'],
    ['实像可承接到光屏', '虚像与物同侧', '先找 F/2F 再作图', '倒正看箭头方向']
  );
}

/* ---------------- 化学 ---------------- */

export function chemMoleculeWater() {
  return `<g id="part-chem-water">
    <circle id="atom-o" cx="450" cy="300" r="54" fill="color-mix(in srgb, var(--primary) 25%, #fff)" stroke="var(--primary)" stroke-width="7"/>
    <text x="450" y="312" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">O</text>
    <circle id="atom-h1" cx="320" cy="390" r="36" fill="#fff" stroke="var(--accent)" stroke-width="6"/>
    <text x="320" y="400" text-anchor="middle" font-size="28" font-weight="800" fill="var(--accent)">H</text>
    <circle id="atom-h2" cx="580" cy="390" r="36" fill="#fff" stroke="var(--accent)" stroke-width="6"/>
    <text x="580" y="400" text-anchor="middle" font-size="28" font-weight="800" fill="var(--accent)">H</text>
    <line x1="400" y1="340" x2="350" y2="365" stroke="var(--ink)" stroke-width="7" stroke-linecap="round"/>
    <line x1="500" y1="340" x2="550" y2="365" stroke="var(--ink)" stroke-width="7" stroke-linecap="round"/>
    ${label(450, 520, '水分子 H₂O：原子重新组合，种类与质量不变', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

export function chemReactionArrow({ left = '反应物', right = '生成物', note = '质量守恒' } = {}) {
  return `<g id="part-chem-reaction">
    <rect x="80" y="220" width="260" height="160" rx="24" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    <text x="210" y="310" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">${escapeXml(left)}</text>
    <g id="part-chem-arrow" stroke="var(--accent)" stroke-width="10" fill="var(--accent)" stroke-linecap="round">
      <line x1="370" y1="300" x2="530" y2="300"/>
      <polygon points="540,300 510,285 510,315"/>
    </g>
    <rect x="560" y="220" width="260" height="160" rx="24" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    <text x="690" y="310" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">${escapeXml(right)}</text>
    ${label(450, 470, note, { size: 30, weight: 800, fill: 'var(--accent)', anchor: 'middle' })}
  </g>`;
}

export function chemCombustionTriangle() {
  const nodes = [
    { x: 450, y: 160, t: '可燃物' },
    { x: 250, y: 460, t: '氧气' },
    { x: 650, y: 460, t: '着火点' }
  ];
  return `<g id="part-chem-combustion">
    <polygon points="450,200 270,440 630,440" fill="color-mix(in srgb, var(--accent) 10%, #fff)" stroke="var(--accent)" stroke-width="6"/>
    ${nodes.map((n, i) => `<g class="chem-node" id="chem-node-${i}">
      <circle cx="${n.x}" cy="${n.y}" r="52" fill="#fff" stroke="var(--primary)" stroke-width="7"/>
      <text x="${n.x}" y="${n.y + 10}" text-anchor="middle" font-size="28" font-weight="800" fill="var(--primary)">${escapeXml(n.t)}</text>
    </g>`).join('')}
    ${label(450, 580, '燃烧三要素：缺一不可', { size: 30, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

export function chemMassBalance() {
  return `<g id="part-chem-balance">
    <line x1="450" y1="180" x2="450" y2="240" stroke="var(--ink)" stroke-width="8"/>
    <line id="part-balance-beam" x1="200" y1="250" x2="700" y2="250" stroke="var(--ink)" stroke-width="10" stroke-linecap="round"/>
    <rect id="part-pan-left" x="170" y="260" width="120" height="70" rx="12" fill="color-mix(in srgb, var(--primary) 15%, #fff)" stroke="var(--primary)" stroke-width="5"/>
    <rect id="part-pan-right" x="610" y="260" width="120" height="70" rx="12" fill="color-mix(in srgb, var(--accent) 18%, #fff)" stroke="var(--accent)" stroke-width="5"/>
    <text x="230" y="305" text-anchor="middle" font-size="26" font-weight="800" fill="var(--primary)">反应前</text>
    <text x="670" y="305" text-anchor="middle" font-size="26" font-weight="800" fill="var(--accent)">反应后</text>
    <text x="450" y="420" text-anchor="middle" font-size="40" font-weight="900" fill="var(--primary)">m前 = m后</text>
    ${label(450, 500, '质量守恒定律：原子重新组合，总质量不变', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/* ---------------- 地理 ---------------- */

export function geoWaterCycle() {
  const nodes = [
    { x: 180, y: 420, t: '蒸发' },
    { x: 450, y: 160, t: '凝结' },
    { x: 720, y: 300, t: '降水' },
    { x: 520, y: 500, t: '径流' }
  ];
  return `<g id="part-geo-cycle">
    <ellipse cx="450" cy="360" rx="280" ry="180" fill="color-mix(in srgb, var(--primary) 8%, #fff)" stroke="var(--line)" stroke-width="4"/>
    <path id="part-geo-arrows" d="M 230 390 C 260 220, 380 140, 450 150 C 560 160, 680 240, 700 300 C 720 380, 620 500, 520 510 C 360 520, 220 470, 200 420" fill="none" stroke="var(--accent)" stroke-width="8"/>
    ${nodes.map((n, i) => `<g class="geo-node" id="geo-node-${i}">
      <circle cx="${n.x}" cy="${n.y}" r="48" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
      <text x="${n.x}" y="${n.y + 10}" text-anchor="middle" font-size="28" font-weight="800" fill="var(--primary)">${escapeXml(n.t)}</text>
    </g>`).join('')}
    ${label(450, 640, '水循环：蒸发—凝结—降水—径流', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

export function geoEarthOrbitSeasons() {
  return `<g id="part-geo-orbit">
    <circle id="part-sun" cx="450" cy="320" r="42" fill="color-mix(in srgb, var(--accent) 70%, #fff)" stroke="var(--accent)" stroke-width="6"/>
    <text x="450" y="328" text-anchor="middle" font-size="26" font-weight="900" fill="var(--ink)">日</text>
    <ellipse id="part-orbit" cx="450" cy="320" rx="280" ry="160" fill="none" stroke="var(--line)" stroke-width="5" stroke-dasharray="14 10"/>
    <g id="earth-spring" class="earth-pos"><circle cx="730" cy="320" r="28" fill="var(--primary)"/><text x="730" y="380" text-anchor="middle" font-size="24" fill="var(--primary)">春</text></g>
    <g id="earth-summer" class="earth-pos"><circle cx="450" cy="160" r="28" fill="var(--primary)"/><text x="450" y="130" text-anchor="middle" font-size="24" fill="var(--primary)">夏</text></g>
    <g id="earth-autumn" class="earth-pos"><circle cx="170" cy="320" r="28" fill="var(--primary)"/><text x="170" y="380" text-anchor="middle" font-size="24" fill="var(--primary)">秋</text></g>
    <g id="earth-winter" class="earth-pos"><circle cx="450" cy="480" r="28" fill="var(--primary)"/><text x="450" y="540" text-anchor="middle" font-size="24" fill="var(--primary)">冬</text></g>
    ${label(450, 620, '公转 + 地轴倾斜 → 四季更替', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

export function geoLatitudeBands() {
  return `<g id="part-geo-lat">
    <ellipse cx="450" cy="320" rx="180" ry="220" fill="color-mix(in srgb, var(--primary) 10%, #fff)" stroke="var(--primary)" stroke-width="7"/>
    <line x1="280" y1="320" x2="620" y2="320" stroke="var(--accent)" stroke-width="5"/>
    <line x1="300" y1="230" x2="600" y2="230" stroke="var(--neutral)" stroke-width="4" stroke-dasharray="10 8"/>
    <line x1="300" y1="410" x2="600" y2="410" stroke="var(--neutral)" stroke-width="4" stroke-dasharray="10 8"/>
    ${label(660, 235, '北回归线', { size: 24, fill: 'var(--neutral)' })}
    ${label(680, 325, '赤道', { size: 26, fill: 'var(--accent)' })}
    ${label(660, 415, '南回归线', { size: 24, fill: 'var(--neutral)' })}
    ${label(450, 600, '纬度带影响太阳高度与气候', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/* ---------------- 历史 ---------------- */

export function historyTimeline(events = []) {
  const items = (events.length ? events : ['背景', '爆发', '发展', '结果']).slice(0, 4);
  const gap = 180;
  const startX = 140;
  return `<g id="part-history-timeline">
    <line id="part-timeline" x1="100" y1="320" x2="800" y2="320" stroke="var(--primary)" stroke-width="8" stroke-linecap="round"/>
    ${items.map((t, i) => {
      const x = startX + i * gap;
      return `<g class="hist-node" id="hist-node-${i}">
        <circle cx="${x}" cy="320" r="18" fill="#fff" stroke="var(--accent)" stroke-width="7"/>
        <rect x="${x - 70}" y="${i % 2 === 0 ? 180 : 380}" width="140" height="80" rx="16" fill="#fff" stroke="var(--primary)" stroke-width="5"/>
        <text x="${x}" y="${i % 2 === 0 ? 228 : 428}" text-anchor="middle" font-size="26" font-weight="800" fill="var(--primary)">${escapeXml(String(t).slice(0, 6))}</text>
      </g>`;
    }).join('')}
    ${label(450, 560, '时间轴：按顺序抓住因果', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

export function historyCauseEffect(leftLines = [], rightLines = []) {
  return comparePanels(
    '原因 / 背景',
    '影响 / 结果',
    leftLines.length ? leftLines : ['民族危机加深', '清政府腐败', '革命思潮传播'],
    rightLines.length ? rightLines : ['推翻帝制', '建立共和', '思想解放']
  );
}

export function axes() {
  return `<g class="part-axes">
    <line x1="140" y1="580" x2="820" y2="580" stroke="var(--ink)" stroke-width="5"/>
    <line x1="140" y1="580" x2="140" y2="120" stroke="var(--ink)" stroke-width="5"/>
    <polygon points="820,580 798,571 798,589" fill="var(--ink)"/>
    <polygon points="140,120 131,142 149,142" fill="var(--ink)"/>
  </g>`;
}

export function methodSteps(steps = []) {
  const list = (steps.length ? steps : ['步骤一', '步骤二', '步骤三', '步骤四']).slice(0, 4);
  while (list.length < 4) list.push(`步骤${list.length + 1}`);
  return `<g id="part-method-steps">
    ${list.map((step, i) => {
      const y = 90 + i * 140;
      const color = i % 2 === 0 ? 'var(--primary)' : 'var(--accent)';
      return `<g id="step-${i + 1}" class="method-step">
        <circle cx="140" cy="${y + 40}" r="46" fill="#fff" stroke="${color}" stroke-width="8"/>
        <text x="140" y="${y + 52}" text-anchor="middle" font-size="36" font-weight="900" fill="${color}">${i + 1}</text>
        <rect x="220" y="${y}" width="560" height="90" rx="22" fill="#fff" stroke="${color}" stroke-width="6"/>
        <text x="250" y="${y + 55}" font-size="32" font-weight="800" fill="var(--ink)">${escapeXml(String(step).slice(0, 18))}</text>
        ${i < 3 ? `<path d="M 140 ${y + 90} V ${y + 130}" stroke="var(--line)" stroke-width="6"/>` : ''}
      </g>`;
    }).join('\n')}
  </g>`;
}

export function comparePanels(leftTitle, rightTitle, leftLines = [], rightLines = []) {
  const L = leftLines.slice(0, 4);
  const R = rightLines.slice(0, 4);
  while (L.length < 3) L.push('•');
  while (R.length < 3) R.push('•');
  return `<g id="part-compare">
    <rect id="cmp-left" x="50" y="90" width="380" height="500" rx="28" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    <rect id="cmp-right" x="470" y="90" width="380" height="500" rx="28" fill="#fff" stroke="var(--accent)" stroke-width="6"/>
    ${label(240, 160, leftTitle, { size: 32, weight: 900, fill: 'var(--primary)', anchor: 'middle' })}
    ${label(660, 160, rightTitle, { size: 32, weight: 900, fill: 'var(--accent)', anchor: 'middle' })}
    ${L.map((t, i) => label(90, 240 + i * 60, `• ${t}`, { size: 26 })).join('\n')}
    ${R.map((t, i) => label(510, 240 + i * 60, `• ${t}`, { size: 26 })).join('\n')}
  </g>`;
}


/** 中和反应：酸 + 碱 → 盐 + 水，并点出 H+ + OH- = H2O */
export function chemNeutralization() {
  return `<g id="part-chem-neutralization">
    <rect x="60" y="150" width="170" height="120" rx="22" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    <text x="145" y="220" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">酸</text>
    <text x="260" y="220" text-anchor="middle" font-size="42" font-weight="900" fill="var(--accent)">+</text>
    <rect x="300" y="150" width="170" height="120" rx="22" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
    <text x="385" y="220" text-anchor="middle" font-size="34" font-weight="900" fill="var(--primary)">碱</text>
    <g id="part-chem-arrow" stroke="var(--accent)" stroke-width="10" fill="var(--accent)" stroke-linecap="round">
      <line x1="500" y1="210" x2="600" y2="210"/>
      <polygon points="612,210 582,195 582,225"/>
    </g>
    <rect x="630" y="130" width="210" height="160" rx="22" fill="color-mix(in srgb, var(--accent) 10%, #fff)" stroke="var(--accent)" stroke-width="6"/>
    <text x="735" y="190" text-anchor="middle" font-size="32" font-weight="900" fill="var(--accent)">盐 + 水</text>
    <text x="735" y="240" text-anchor="middle" font-size="24" font-weight="700" fill="var(--neutral)">中和产物</text>
    <g id="part-ion-combine">
      <circle cx="280" cy="420" r="40" fill="#fff" stroke="var(--primary)" stroke-width="6"/>
      <text x="280" y="430" text-anchor="middle" font-size="28" font-weight="900" fill="var(--primary)">H⁺</text>
      <circle cx="450" cy="420" r="40" fill="#fff" stroke="var(--accent)" stroke-width="6"/>
      <text x="450" y="430" text-anchor="middle" font-size="26" font-weight="900" fill="var(--accent)">OH⁻</text>
      <line x1="325" y1="420" x2="405" y2="420" stroke="var(--ink)" stroke-width="7" stroke-linecap="round"/>
      <text x="620" y="430" text-anchor="middle" font-size="32" font-weight="900" fill="var(--primary)">= H₂O</text>
    </g>
    ${label(450, 540, '实质：H⁺ + OH⁻ = H₂O', { size: 30, weight: 800, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/** 金属活动性顺序阶梯 */
export function chemMetalActivitySeries() {
  const metals = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Pb', 'H', 'Cu', 'Ag', 'Au'];
  const gap = 62;
  const startX = 80;
  return `<g id="part-chem-metal-series">
    <text x="450" y="90" text-anchor="middle" font-size="32" font-weight="900" fill="var(--primary)">金属活动性顺序（前强后弱）</text>
    <line x1="60" y1="220" x2="840" y2="220" stroke="var(--line)" stroke-width="6"/>
    ${metals.map((m, i) => {
      const x = startX + i * gap;
      const isH = m === 'H';
      return `<g class="metal-node" id="metal-${m}">
        <rect x="${x - 24}" y="${isH ? 160 : 170}" width="48" height="${isH ? 70 : 55}" rx="12"
          fill="${isH ? 'color-mix(in srgb, var(--accent) 18%, #fff)' : '#fff'}"
          stroke="${isH ? 'var(--accent)' : 'var(--primary)'}" stroke-width="5"/>
        <text x="${x}" y="${isH ? 205 : 205}" text-anchor="middle" font-size="24" font-weight="900"
          fill="${isH ? 'var(--accent)' : 'var(--primary)'}">${m}</text>
      </g>`;
    }).join('\n')}
    <polygon points="70,300 120,280 120,320" fill="var(--accent)"/>
    <line x1="120" y1="300" x2="820" y2="300" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"/>
    <polygon points="830,300 780,280 780,320" fill="var(--accent)"/>
    ${label(220, 360, '活动性更强', { size: 26, fill: 'var(--primary)', anchor: 'middle' })}
    ${label(700, 360, '活动性更弱', { size: 26, fill: 'var(--neutral)', anchor: 'middle' })}
    <g id="part-chem-displace">
      <rect x="120" y="420" width="300" height="120" rx="20" fill="#fff" stroke="var(--primary)" stroke-width="5"/>
      <text x="270" y="470" text-anchor="middle" font-size="26" font-weight="800" fill="var(--primary)">氢前：可产 H₂</text>
      <text x="270" y="510" text-anchor="middle" font-size="22" fill="var(--neutral)">Zn / Fe + 稀酸</text>
      <rect x="480" y="420" width="300" height="120" rx="20" fill="#fff" stroke="var(--accent)" stroke-width="5"/>
      <text x="630" y="470" text-anchor="middle" font-size="26" font-weight="800" fill="var(--accent)">前换后：可置换</text>
      <text x="630" y="510" text-anchor="middle" font-size="22" fill="var(--neutral)">Zn + CuSO₄ → Cu</text>
    </g>
    ${label(450, 600, '先看前后位置，再判断反应能否发生', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/** 等高线示意：山顶/疏密/等高距 */
export function geoContourMap() {
  return `<g id="part-geo-contour">
    <ellipse cx="320" cy="320" rx="220" ry="180" fill="none" stroke="var(--primary)" stroke-width="6"/>
    <ellipse cx="320" cy="320" rx="160" ry="130" fill="none" stroke="var(--primary)" stroke-width="6"/>
    <ellipse cx="320" cy="320" rx="100" ry="80" fill="none" stroke="var(--primary)" stroke-width="6"/>
    <ellipse cx="320" cy="320" rx="45" ry="35" fill="color-mix(in srgb, var(--accent) 20%, #fff)" stroke="var(--accent)" stroke-width="6"/>
    <text x="320" y="328" text-anchor="middle" font-size="24" font-weight="900" fill="var(--accent)">山顶</text>
    <text x="180" y="230" font-size="22" fill="var(--neutral)">300</text>
    <text x="200" y="270" font-size="22" fill="var(--neutral)">200</text>
    <text x="220" y="310" font-size="22" fill="var(--neutral)">100</text>
    <g id="part-slope-compare">
      <text x="680" y="160" text-anchor="middle" font-size="28" font-weight="900" fill="var(--primary)">坡度判读</text>
      <line x1="600" y1="220" x2="760" y2="220" stroke="var(--accent)" stroke-width="8"/>
      <line x1="600" y1="245" x2="760" y2="245" stroke="var(--accent)" stroke-width="8"/>
      <line x1="600" y1="270" x2="760" y2="270" stroke="var(--accent)" stroke-width="8"/>
      <text x="680" y="310" text-anchor="middle" font-size="24" fill="var(--accent)">密集 = 陡</text>
      <line x1="600" y1="380" x2="760" y2="380" stroke="var(--primary)" stroke-width="6"/>
      <line x1="600" y1="430" x2="760" y2="430" stroke="var(--primary)" stroke-width="6"/>
      <line x1="600" y1="480" x2="760" y2="480" stroke="var(--primary)" stroke-width="6"/>
      <text x="680" y="530" text-anchor="middle" font-size="24" fill="var(--primary)">稀疏 = 缓</text>
    </g>
    ${label(450, 600, '等高距：相邻等高线高度差', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/** 气候因素叠加：纬度 / 海陆 / 地形 */
export function geoClimateFactors() {
  const nodes = [
    { x: 170, y: 220, t: '纬度', d: '热量基础' },
    { x: 450, y: 220, t: '海陆', d: '温湿差异' },
    { x: 730, y: 220, t: '地形', d: '局地修正' }
  ];
  return `<g id="part-geo-climate">
    ${nodes.map((n, i) => `<g class="climate-node" id="climate-node-${i}">
      <circle cx="${n.x}" cy="${n.y}" r="70" fill="#fff" stroke="var(--primary)" stroke-width="7"/>
      <text x="${n.x}" y="${n.y - 5}" text-anchor="middle" font-size="30" font-weight="900" fill="var(--primary)">${n.t}</text>
      <text x="${n.x}" y="${n.y + 28}" text-anchor="middle" font-size="22" fill="var(--neutral)">${n.d}</text>
    </g>`).join('\n')}
    <path id="part-climate-arrows" d="M 245 220 H 375 M 525 220 H 655" stroke="var(--accent)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <polygon points="375,220 350,208 350,232" fill="var(--accent)"/>
    <polygon points="655,220 630,208 630,232" fill="var(--accent)"/>
    <rect x="200" y="380" width="500" height="120" rx="24" fill="color-mix(in srgb, var(--accent) 12%, #fff)" stroke="var(--accent)" stroke-width="6"/>
    <text x="450" y="430" text-anchor="middle" font-size="32" font-weight="900" fill="var(--accent)">气候特征</text>
    <text x="450" y="470" text-anchor="middle" font-size="24" fill="var(--neutral)">气温 · 降水 · 类型</text>
    ${label(450, 560, '先抓主导因素，再叠加修正因素', { size: 28, fill: 'var(--neutral)', anchor: 'middle' })}
  </g>`;
}

/** 鸦片战争时间轴 */
export function historyOpiumWarTimeline() {
  return historyTimeline(['禁烟', '1840开战', '战败', '南京条约']);
}

/** 五四运动时间轴 */
export function historyMayFourthTimeline() {
  return historyTimeline(['巴黎和会', '5.4游行', '三罢', '新开端']);
}

export default {
  escapeXml,
  svgRoot,
  label,
  arrow,
  electricBattery,
  electricResistor,
  electricMeter,
  electricBulb,
  electricSwitch,
  electricLoopSkeleton,
  electricCurrentArrows,
  assembleSeriesCircuit,
  assembleParallelCircuit,
  soundTuningFork,
  soundVibrationArrows,
  soundWaveArcs,
  assembleSoundSource,
  mechanicsLever,
  mechanicsBlockFriction,
  mechanicsPulley,
  mechanicsFixedPulley,
  mechanicsMovablePulley,
  assemblePulleyCompareScene,
  assembleLeverScene,
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
  axes,
  methodSteps,
  comparePanels
};
