// server/services/storyboardBuilder.js
// 知识驱动分镜：结构化拆解 → storyboard.json（可选 LLM，失败回退本地知识包）

const PALETTE_BY_SUBJECT = {
  physics: 'electricity',
  math: 'math',
  biology: 'biology',
  chemistry: 'chemistry',
  geography: 'geography',
  history: 'history',
  chinese: 'math',
  english: 'math'
};

const GENERIC_BAD_PATTERNS = [
  /把复杂现象讲清楚/,
  /拆成可观察的步骤/,
  /注意条件、变量和结论/,
  /放回生活或实验场景/,
  /按固定步骤走：审题/,
  /关键不是死记硬背/
];

const HISTORY_GENERIC_BAD_PATTERNS = [
  /适用条件/,
  /变量与不变量/,
  /量与量之间怎么对应/,
  /谁决定谁、怎么变化/,
  /条件[-—→]关系[-—→]回代/,
  /回代检验/
];

const KNOWLEDGE_PACKS = {
  能量守恒定律: {
    subjectHint: 'physics',
    palette: 'mechanics',
    definition: '能量既不会凭空产生，也不会凭空消失，它只能从一种形式转化为另一种形式，或者从一个物体转移到另一个物体，在转化和转移过程中总量保持不变。',
    formula: 'E总 守恒',
    formulaNote: '转化与转移中总量不变',
    keyNumbers: ['总量不变', '可转化', '可转移'],
    misconceptions: [
      '机械能守恒不等于能量守恒：有摩擦时机械能减少，但总能量仍守恒。',
      '“消失”的只是某种形式的能量，不是能量本身。'
    ],
    examples: [
      '滚摆下降时重力势能变动能，上升时动能再变回势能。',
      '水力发电：水的机械能最终转化为电能，过程中还有少量内能。'
    ],
    conditions: '封闭系统、计及所有能量形式时，总能量守恒；机械能守恒还需近似无摩擦、无非保守力做功。',
    subconcepts: [
      {
        title: '定义总述',
        narration: '同学们记住：能量不会无中生有，也不会凭空消失。它只会转化形式，或在物体间转移，总量始终不变。',
        visual: '左侧能量循环示意：动能/势能/内能/电能互相箭头；右侧 info_card：不生不灭/只转化转移/总量不变',
        points: ['不生不灭', '只转化或转移', '总量保持不变'],
        formula: 'E总 守恒',
        callout: '核心定义'
      },
      {
        title: '转化与转移',
        narration: '转化是形式变了，比如势能变动能；转移是物体变了，比如热从热水传到冷水。两条路都能发生，总量仍不变。',
        visual: '左：滚摆势能↔动能；右：热传递箭头；中部分标签“转化 / 转移”',
        points: ['转化：形式变化', '转移：物体间传递', '两条路径都守恒'],
        formula: '',
        callout: '两条路径'
      },
      {
        title: '机械能对比',
        narration: '机械能守恒是能量守恒的特例。只有动能和势能互相变、摩擦可忽略时才近似成立；有摩擦时机械能减少，但总能量仍守恒。',
        visual: '对比表：机械能守恒条件 vs 能量守恒条件；底部易错提醒“摩擦生热”',
        points: ['机械能=动能+势能', '无摩擦才近似守恒', '有摩擦总能量仍守恒'],
        formula: 'Ek + Ep',
        callout: '易错对比'
      },
      {
        title: '生活例子',
        narration: '滚摆来回摆、瀑布冲下推动水轮机发电，都是能量在不同形式间转化。看起来“少了”的部分，往往变成了内能或电能。',
        visual: '双场景：滚摆轨迹 + 水力发电简图；标注势能→动能→电能/内能',
        points: ['滚摆：势能↔动能', '发电：机械能→电能', '损耗常成内能'],
        formula: '',
        callout: '生活锚点'
      },
      {
        title: '做题步骤',
        narration: '遇到守恒题，先看系统选多大，再列初末能量，最后检查有没有摩擦或外界做功。漏掉一种形式，结论就容易错。',
        visual: '四步清单卡片：选系统 / 列初末 / 查摩擦做功 / 回代检验',
        points: ['明确系统边界', '列出所有形式', '检查非保守力', '回代检验'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: [
      '能量不生不灭，只转化或转移',
      '机械能守恒是有条件的特例',
      '做题先定系统，再列初末能量'
    ],
    badges: ['守恒', '转化', '转移', '特例']
  },
  声现象: {
    subjectHint: 'physics',
    palette: 'sound',
    definition: '声音由物体振动产生，需要介质传播；音调由频率决定，响度由振幅决定，音色由波形和发声体结构决定。',
    formula: '340 m/s',
    formulaNote: '15°C 空气中的声速',
    keyNumbers: ['340 m/s', '振动', '频率', '振幅'],
    misconceptions: ['真空不能传声', '振幅大不等于音调高'],
    examples: ['音叉振动发声', '弦乐器按弦改变频率'],
    conditions: '传播需要介质；不同介质声速不同。',
    subconcepts: [
      {
        title: '振动发声',
        narration: '同学们看，敲响的音叉在快速振动，声音就是这样产生的。振动停止，发声也停止。一切正在发声的物体，都在振动。',
        visual: '左侧大音叉 + 振动箭头；右侧 info_card：振动产生/停振停声',
        points: ['振动产生声音', '停振则停声', '发声体都在振动'],
        formula: '',
        callout: '产生'
      },
      {
        title: '声波传播',
        narration: '声音要靠介质把振动一层层传出去。空气、水和固体都能传声，但真空里没有介质，声音就传不过去。',
        visual: '波前扩散图 + “真空×”标注',
        points: ['需要介质', '固体液体气体可传', '真空不能传声'],
        formula: '',
        callout: '传播'
      },
      {
        title: '音调',
        narration: '同样用力拨弦，按弦位置不同，音调就不同。振动越快，频率越高，听起来音调越高。',
        visual: '高频密波 vs 低频疏波对比',
        points: ['音调←频率', '频率高音调高', '按弦改变频率'],
        formula: 'f',
        callout: '音调'
      },
      {
        title: '响度',
        narration: '用力越大，振幅越大，听起来越响。响度跟振动幅度有关，别和音调搞混。',
        visual: '大振幅 vs 小振幅波形对比',
        points: ['响度←振幅', '振幅大更响', '与音调不同'],
        formula: 'A',
        callout: '响度'
      },
      {
        title: '音色',
        narration: '同样的音调和响度，为什么一听就知道是笛子还是小提琴？材料和结构不同，波形就不同，这就是音色。',
        visual: '简单正弦波 vs 复杂波形对比',
        points: ['音色←波形', '材料结构决定', '可分辨乐器'],
        formula: '',
        callout: '音色'
      }
    ],
    summaryPoints: [
      '声音由振动产生，通过介质传播',
      '音调←频率，响度←振幅，音色←波形',
      '空气中约每秒三百四十米'
    ],
    badges: ['振动', '声波', '频率', '振幅']
  },
  勾股定理: {
    subjectHint: 'math',
    palette: 'math',
    definition: '在直角三角形中，两条直角边的平方和等于斜边的平方。',
    formula: 'a² + b² = c²',
    formulaNote: '直角三角形，c 为斜边',
    keyNumbers: ['直角', 'a²+b²=c²'],
    misconceptions: ['非直角三角形不能直接用勾股定理', 'c 必须是斜边'],
    examples: ['3-4-5 三角形', '测量旗杆高度的直角模型'],
    conditions: '必须是直角三角形；直角所对的边是斜边 c。',
    subconcepts: [
      {
        title: '定理内容',
        narration: '直角三角形里，两条直角边各自平方再相加，正好等于斜边的平方。这就是勾股定理。',
        visual: '直角三角形 + 三边上的正方形面积示意',
        points: ['直角三角形', '直角边 a、b', '斜边 c'],
        formula: 'a² + b² = c²',
        callout: '定理'
      },
      {
        title: '几何意义',
        narration: '你可以把它想成面积关系：以直角边为边的两个正方形面积之和，等于以斜边为边的正方形面积。',
        visual: '三正方形拼补示意',
        points: ['面积解释', '两小方面积和=大方面积', '帮助记忆'],
        formula: '',
        callout: '面积'
      },
      {
        title: '判定与条件',
        narration: '反过来，如果三边满足这个关系，这个三角形就是直角三角形。用之前先确认谁是斜边。',
        visual: '正定理 / 逆定理对照卡',
        points: ['先找最长边当 c', '满足则有直角', '不满足不是直角'],
        formula: 'a²+b²=c² ⇒ 直角',
        callout: '逆定理'
      },
      {
        title: '典型数据',
        narration: '最常见的整数边是三、四、五。记住这一组，很多填空和选择都能快速判断。',
        visual: '3-4-5 三角形高亮',
        points: ['3-4-5', '6-8-10 同类放大', '先检验再计算'],
        formula: '3²+4²=5²',
        callout: '数据'
      },
      {
        title: '解题步骤',
        narration: '做题时先标直角，写下已知边，再代入公式求未知边，最后看单位和是否合理。',
        visual: '四步清单：标直角/列式/求解/检验',
        points: ['标出直角与斜边', '代入 a²+b²=c²', '开方求边', '检验数量级'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: [
      '直角三角形：a² + b² = c²',
      'c 是斜边，不能随便指定',
      '3-4-5 是常用整数解'
    ],
    badges: ['直角', '公式', '逆定理', '3-4-5']
  }
  ,
  光的折射: {
    subjectHint: 'physics',
    palette: 'light',
    definition: '光从一种介质斜射入另一种介质时，传播方向通常会发生变化，这种现象叫光的折射。',
    formula: '入射角 / 折射角',
    formulaNote: '方向改变，进入另一介质',
    keyNumbers: ['折射', '法线', '介质'],
    misconceptions: ['折射不是反射', '垂直入射时方向不变'],
    examples: ['插入水中的筷子看起来弯折', '凸透镜成像'],
    conditions: '光从一种介质进入另一种介质，且通常不是垂直入射。',
    subconcepts: [
      { title: '折射现象', narration: '光斜着从空气进入水里时，传播方向会拐一下，这就是折射。', visual: '界面 + 入射/折射光线 + 法线', points: ['进入另一介质', '方向改变', '常见于水与空气'], formula: '', callout: '现象' },
      { title: '三线关系', narration: '画图时先作法线，再画入射光线和折射光线。三线共面，角都相对法线来量。', visual: '法线虚线 + 入射角折射角标注', points: ['先作法线', '三线共面', '角对法线量'], formula: '', callout: '作图' },
      { title: '介质影响', narration: '从空气进水，折射角通常小于入射角；反过来则相反。介质不同，偏折程度不同。', visual: '空气→水 与 水→空气 对比', points: ['介质决定偏折', '空气到水更靠拢法线', '反之远离法线'], formula: '', callout: '规律' },
      { title: '生活例子', narration: '筷子在水里像折断了，其实是折射让你的眼睛产生了错觉。', visual: '杯中筷子弯折双场景：空气段直 / 水中段折', points: ['筷子弯折', '池水看起来变浅', '透镜也靠折射'], formula: '', callout: '例子' },
      { title: '做题步骤', narration: '遇折射题：标介质、作法线、画光线、比较角。顺序固定就不容易乱。', visual: '四步清单卡片：审题 / 定位概念 / 推理 / 回代检验', points: ['标介质', '作法线', '画光线', '比角'], formula: '', callout: '方法' }
    ],
    summaryPoints: ['折射是跨介质方向改变', '先作法线再量角', '生活中筷子弯折就是折射'],
    badges: ['折射', '法线', '介质', '成像']
  },
  杠杆: {
    subjectHint: 'physics',
    palette: 'mechanics',
    definition: '杠杆是在力的作用下能绕固定点转动的硬棒。固定点叫支点，使杠杆转动的力叫动力，阻碍转动的力叫阻力。',
    formula: 'F1 L1 = F2 L2',
    formulaNote: '动力×动力臂=阻力×阻力臂',
    keyNumbers: ['支点', '力臂', '平衡'],
    misconceptions: ['力臂不是力的作用点到支点的距离本身，而是垂线距离', '动力臂长不一定总省力，要看阻力臂'],
    examples: ['撬棍撬石头', '剪刀、天平、镊子'],
    conditions: '硬棒可绕固定支点转动；讨论平衡时满足杠杆平衡条件。',
    subconcepts: [
      { title: '杠杆要素', narration: '杠杆有三个关键点：支点、动力和阻力。先找到支点，后面的分析才站得住。', visual: '杠杆 + 支点三角 + 动力阻力箭头', points: ['支点', '动力', '阻力'], formula: '', callout: '要素' },
      { title: '力臂含义', narration: '力臂是支点到力的作用线的垂直距离，不是随便连一条线。', visual: '支点到力作用线的垂线力臂标注图', points: ['垂距才是力臂', '作用线要延长', '别量到作用点就算'], formula: 'L', callout: '力臂' },
      { title: '平衡条件', narration: '杠杆平衡时，动力乘动力臂等于阻力乘阻力臂。哪边力臂更长，哪边更省力。', visual: 'F1L1=F2L2 高亮', points: ['F1L1=F2L2', '力臂长更省力', '条件要平衡时才用'], formula: 'F1 L1 = F2 L2', callout: '条件' },
      { title: '分类例子', narration: '撬棒常是省力杠杆，镊子常是费力杠杆。省力往往费距离，费力往往省距离。', visual: '省力杠杆 vs 费力杠杆 对比卡 + 生活例子', points: ['省力杠杆', '费力杠杆', '等臂杠杆'], formula: '', callout: '分类' },
      { title: '做题步骤', narration: '做杠杆题：找支点、画力、作力臂、代入平衡式。四步走完再下结论。', visual: '四步清单卡片：审题 / 定位概念 / 推理 / 回代检验', points: ['找支点', '画出力', '作力臂', '列平衡式'], formula: '', callout: '方法' }
    ],
    summaryPoints: ['杠杆绕支点转动', '平衡条件 F1L1=F2L2', '力臂是垂线距离'],
    badges: ['支点', '力臂', '平衡', '省力']
  },
  欧姆定律: {
    subjectHint: 'physics',
    palette: 'electricity',
    definition: '导体中的电流，跟导体两端的电压成正比，跟导体的电阻成反比。',
    formula: 'I = U / R',
    formulaNote: '同一导体、温度不变等条件下',
    keyNumbers: ['I', 'U', 'R'],
    misconceptions: ['不能说电阻与电压成正比', '公式变形时对象必须是同一段导体'],
    examples: ['串联电路分压', '调节滑动变阻器改变电流'],
    conditions: '对金属导体等，在温度不变、讨论同一段导体时适用。',
    subconcepts: [
      { title: '定律内容', narration: '电流等于电压除以电阻。电压越大电流越大，电阻越大电流越小。', visual: 'I=U/R 大公式 + 电路简图', points: ['I 与 U 正比', 'I 与 R 反比', '同一段导体'], formula: 'I = U / R', callout: '定律' },
      { title: '电路角色', narration: '电源提供电压，电阻阻碍电流，电流表要串联，电压表要并联。', visual: '串联回路骨架 + 表计位置', points: ['电源给电压', '电阻限电流', '表计接法'], formula: '', callout: '电路' },
      { title: '串并联', narration: '串联时电流一条路径，并联时多条路径。分析欧姆定律前先分清电路结构。', visual: '串联单路径 vs 并联多路径 对比示意图', points: ['串联单路径', '并联多路径', '先认结构'], formula: '', callout: '结构' },
      { title: '生活例子', narration: '滑动变阻器调光灯：电阻变大，电流变小，灯就变暗。', visual: '滑动变阻器调节电路 + 灯泡明暗变化', points: ['调电阻', '改电流', '灯变暗亮'], formula: '', callout: '例子' },
      { title: '做题步骤', narration: '先画电路、标已知，再选同一导体套用 I=U/R 或其变形，最后检查单位。', visual: '四步清单卡片：审题 / 定位概念 / 推理 / 回代检验', points: ['画电路', '定对象', '套公式', '查单位'], formula: 'I=U/R', callout: '方法' }
    ],
    summaryPoints: ['I=U/R', '先认清同一段导体', '串并联结构决定分析路径'],
    badges: ['电流', '电压', '电阻', '电路']
  },
  光合作用: {
    subjectHint: 'biology',
    palette: 'biology',
    definition: '绿色植物通过叶绿体，利用光能，把二氧化碳和水转化成储存能量的有机物，并释放氧气的过程。',
    formula: 'CO₂ + H₂O → 有机物 + O₂',
    formulaNote: '光能 + 叶绿体',
    keyNumbers: ['光能', '叶绿体', '氧气'],
    misconceptions: ['植物夜间也进行呼吸作用', '光合作用不是呼吸作用的简单相反口号，要分清条件与产物'],
    examples: ['绿叶在光下制造淀粉', '大棚补光促进生长'],
    conditions: '需要光、叶绿体、二氧化碳和水等条件。',
    subconcepts: [
      { title: '场所条件', narration: '光合作用主要在叶绿体中进行，还需要光能、二氧化碳和水。', visual: '叶片横切 + 叶绿体高亮', points: ['叶绿体', '需要光', 'CO₂ 和 H₂O'], formula: '', callout: '条件' },
      { title: '物质变化', narration: '原料是二氧化碳和水，产物是有机物和氧气。先记清进出，再谈能量。', visual: '原料到产物流程链：CO₂/水 → 有机物/氧气', points: ['进：CO₂ 和水', '出：有机物和 O₂', '流程记忆'], formula: 'CO₂+H₂O→有机物+O₂', callout: '物质' },
      { title: '能量变化', narration: '光能被转化并储存在有机物中。所以阳光充足时，植物制造有机物的能力更强。', visual: '阳光→叶绿体→有机物能量', points: ['光能输入', '化学能储存', '有机物载体'], formula: '', callout: '能量' },
      { title: '与呼吸对比', narration: '光合作用储存能量并释放氧气，呼吸作用消耗有机物释放能量。两者既有联系又有区别。', visual: '光合作用 vs 呼吸作用 条件产物对比卡', points: ['光合释放 O₂', '呼吸消耗 O₂', '条件不同'], formula: '', callout: '对比' },
      { title: '做题步骤', narration: '题里先抓条件：有没有光、是否绿色部分，再判断产物和气体变化。', visual: '四步清单卡片：审题 / 定位概念 / 推理 / 回代检验', points: ['看光照', '看叶绿体', '判产物', '比呼吸'], formula: '', callout: '方法' }
    ],
    summaryPoints: ['叶绿体利用光能', 'CO₂+水→有机物+O₂', '与呼吸作用条件产物不同'],
    badges: ['光能', '叶绿体', '有机物', '氧气']
  },

  质量守恒定律: {
    subjectHint: 'chemistry',
    palette: 'chemistry',
    definition: '参加化学反应的各物质的质量总和，等于反应后生成的各物质的质量总和。化学反应中原子种类、数目不变，只是重新组合。',
    formula: 'm前 = m后',
    formulaNote: '原子重新组合，总质量不变',
    keyNumbers: ['m前=m后', '原子守恒', '种类不变'],
    misconceptions: [
      '气体参加或生成时不能忽略气体质量',
      '质量守恒不是“体积守恒”，也不是“分子个数一定不变”'
    ],
    examples: [
      '镁条燃烧后氧化镁质量大于镁，因为吸收了氧气。',
      '密闭容器中白磷燃烧，反应前后总质量不变。'
    ],
    conditions: '指化学反应；测量时要计入所有反应物和生成物（含气体）。',
    subconcepts: [
      {
        title: '定义总述',
        narration: '同学们记住：化学反应前后，物质总质量相等。看起来“变少”的部分，往往变成了气体跑掉了。',
        visual: '天平两端：反应前 / 反应后 保持水平 + m前=m后 高亮',
        points: ['反应前后总质量相等', '要计入气体', '不是凭空消失'],
        formula: 'm前 = m后',
        callout: '核心定义'
      },
      {
        title: '微观解释',
        narration: '从微观看，原子的种类和数目都没有变，只是重新组合成新分子。所以宏观质量守恒。',
        visual: '水分子 H₂O 示意：O 与 H 重新组合，原子不增不减',
        points: ['原子种类不变', '原子数目不变', '只是重新组合'],
        formula: '',
        callout: '微观本质'
      },
      {
        title: '反应示意',
        narration: '写化学变化时，左边是反应物，右边是生成物。箭头表示变化方向，质量关系始终守恒。',
        visual: '反应物 → 生成物 箭头动画 + 原子重新组合标注',
        points: ['反应物在左', '生成物在右', '总质量不变'],
        formula: '',
        callout: '表示方法'
      },
      {
        title: '生活例子',
        narration: '镁条燃烧后固体变重，是因为氧气参与了反应。如果把氧气质量也算进去，总质量仍然守恒。',
        visual: '燃烧对比卡：只称固体会偏小 / 计入气体则守恒',
        points: ['镁+氧气→氧化镁', '固体变重因吸氧', '计入气体才守恒'],
        formula: '',
        callout: '例子'
      },
      {
        title: '做题步骤',
        narration: '做质量守恒题：先写清反应，再找已知质量，最后按原子守恒列式。别漏气体，也别把体积当质量。',
        visual: '四步清单卡片：写反应 / 找质量 / 列守恒 / 回代检验',
        points: ['写清反应式', '找已知质量', '列守恒关系', '回代检验'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['反应前后总质量相等', '本质是原子重新组合', '气体质量不能漏算'],
    badges: ['守恒', '原子', '反应', '气体']
  },
  燃烧与灭火: {
    subjectHint: 'chemistry',
    palette: 'chemistry',
    definition: '燃烧是可燃物与氧气发生的发光、放热的剧烈氧化反应。燃烧需要可燃物、氧气和温度达到着火点三个条件同时具备。',
    formula: '三要素',
    formulaNote: '可燃物 + 氧气 + 着火点',
    keyNumbers: ['可燃物', '氧气', '着火点'],
    misconceptions: [
      '灭火不是一定要降温，隔离空气或移除可燃物也能灭火',
      '着火点是物质的固有属性，通常不能靠“提高着火点”灭火'
    ],
    examples: [
      '烛火用杯子罩住后熄灭：隔绝氧气。',
      '森林防火道：移除可燃物，切断蔓延。'
    ],
    conditions: '燃烧三要素缺一不可；灭火就是破坏其中至少一个条件。',
    subconcepts: [
      {
        title: '燃烧定义',
        narration: '燃烧不是随便“着火”，它是可燃物与氧气发生的剧烈氧化反应，同时发光放热。',
        visual: '燃烧反应物到生成物箭头 + 发光放热标注',
        points: ['剧烈氧化反应', '发光放热', '需要氧气'],
        formula: '',
        callout: '定义'
      },
      {
        title: '三要素',
        narration: '记住燃烧三要素：可燃物、氧气、温度达到着火点。三个条件同时满足才会燃烧。',
        visual: '燃烧三角形：可燃物 / 氧气 / 着火点',
        points: ['可燃物', '氧气', '达到着火点'],
        formula: '三要素',
        callout: '条件'
      },
      {
        title: '灭火原理',
        narration: '灭火就是破坏三要素：清除可燃物、隔绝氧气，或降温到着火点以下。',
        visual: '对比卡：清除可燃物 / 隔绝氧气 / 降温',
        points: ['清除可燃物', '隔绝氧气', '降温'],
        formula: '',
        callout: '灭火'
      },
      {
        title: '生活例子',
        narration: '杯子罩住蜡烛，氧气不足就熄灭；泼水灭火主要是降温并隔绝部分空气。',
        visual: '蜡烛+罩杯 / 泼水灭火 双场景',
        points: ['隔氧熄灭', '降温灭火', '对应三要素'],
        formula: '',
        callout: '例子'
      },
      {
        title: '做题步骤',
        narration: '题里先判断破坏了哪个条件，再对应灭火方法，最后检查是否说成“提高着火点”。',
        visual: '四步清单卡片：审条件 / 对要素 / 选方法 / 避误区',
        points: ['找被破坏条件', '对应灭火方法', '避开误区', '回代场景'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['燃烧是剧烈氧化反应', '三要素缺一不可', '灭火=破坏条件'],
    badges: ['燃烧', '氧气', '着火点', '灭火']
  },
  水循环: {
    subjectHint: 'geography',
    palette: 'geography',
    definition: '水循环是自然界的水在太阳辐射和重力作用下，通过蒸发、水汽输送、凝结降水、下渗和径流等环节，在海陆之间和陆地内部不断运动的过程。',
    formula: '蒸发→凝结→降水→径流',
    formulaNote: '主要环节',
    keyNumbers: ['蒸发', '降水', '径流', '水汽输送'],
    misconceptions: [
      '水循环不只发生在海上，陆地内部也有内循环',
      '降水不等于水资源一定增加，还要看下渗、蒸发和利用'
    ],
    examples: [
      '海洋水蒸发后被输送到陆地形成降水，再经河流回到海洋。',
      '晴天地面水蒸发，空气中水汽增多，降温后可能成云致雨。'
    ],
    conditions: '能量来自太阳辐射；重力驱动降水与径流。',
    subconcepts: [
      {
        title: '定义总述',
        narration: '水循环就是水在地球上不停“搬家”：从海洋到天空，再到陆地，又流回海洋或地下。',
        visual: '水循环大环：蒸发—凝结—降水—径流',
        points: ['连续运动', '海陆之间', '陆地内部也有'],
        formula: '蒸发→降水→径流',
        callout: '核心'
      },
      {
        title: '主要环节',
        narration: '关键环节要记牢：蒸发、水汽输送、凝结、降水、下渗和径流。缺一个，链条就不完整。',
        visual: '四节点流程：蒸发 / 凝结 / 降水 / 径流',
        points: ['蒸发', '凝结降水', '径流下渗'],
        formula: '',
        callout: '环节'
      },
      {
        title: '能量与动力',
        narration: '太阳辐射提供蒸发能量，重力让降水下落、水流向低处。地理过程背后都有能量。',
        visual: '太阳高亮 + 重力箭头驱动径流',
        points: ['太阳辐射驱动蒸发', '重力驱动径流', '能量不可缺'],
        formula: '',
        callout: '动力'
      },
      {
        title: '意义例子',
        narration: '水循环让淡水资源更新，也塑造河流地貌。它连接大气、海洋和陆地。',
        visual: '对比卡：资源更新 / 塑造地貌 / 物质迁移',
        points: ['更新淡水', '塑造地表', '物质能量迁移'],
        formula: '',
        callout: '意义'
      },
      {
        title: '做题步骤',
        narration: '做水循环题：先判环节，再看海陆间或陆地内循环，最后联系意义或人类影响。',
        visual: '四步清单卡片：判环节 / 定类型 / 找动力 / 联意义',
        points: ['判断环节', '区分类型', '找能量动力', '联系意义'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['水在海陆空之间循环', '关键环节要会辨认', '太阳辐射与重力是动力'],
    badges: ['蒸发', '降水', '径流', '循环']
  },
  四季的形成: {
    subjectHint: 'geography',
    palette: 'geography',
    definition: '地球在公转过程中，由于地轴倾斜且空间指向基本不变，太阳直射点在南北回归线之间往返移动，导致各地正午太阳高度和昼夜长短变化，从而形成四季。',
    formula: '公转 + 地轴倾斜',
    formulaNote: '直射点回归运动',
    keyNumbers: ['公转', '地轴倾斜', '回归线', '直射点'],
    misconceptions: [
      '四季不是因为地球离太阳远近造成的主因',
      '北半球与南半球季节相反'
    ],
    examples: [
      '夏至太阳直射北回归线，北半球昼最长、正午太阳高度较大。',
      '冬至太阳直射南回归线，北半球昼最短。'
    ],
    conditions: '地球公转；地轴倾斜约 23.5°；地轴指向近似不变。',
    subconcepts: [
      {
        title: '定义总述',
        narration: '四季更替，核心不是地球忽远忽近，而是公转时地轴倾斜，太阳直射点来回移动。',
        visual: '日心 + 地球公转轨道四季位置',
        points: ['公转是基础', '地轴倾斜关键', '直射点移动'],
        formula: '公转 + 地轴倾斜',
        callout: '核心'
      },
      {
        title: '直射点',
        narration: '太阳直射点在南北回归线之间往返。直射哪里，哪里正午太阳高度就更大、白昼更长。',
        visual: '地球纬度带：赤道 / 南北回归线 + 直射移动示意',
        points: ['南北回归线之间', '直射点回归运动', '影响正午太阳高度'],
        formula: '',
        callout: '机制'
      },
      {
        title: '昼夜长短',
        narration: '同一天，纬度不同昼夜长短不同；同一地点，季节不同昼夜也不同。这是四季的重要表现。',
        visual: '对比卡：夏季昼长夜短 / 冬季昼短夜长',
        points: ['夏至昼最长', '冬至昼最短', '春秋接近等长'],
        formula: '',
        callout: '表现'
      },
      {
        title: '南北半球',
        narration: '南北半球季节相反：北半球夏天时，南半球正是冬天。做题先看半球再判季节。',
        visual: '南北半球季节相反对照卡',
        points: ['南北季节相反', '先判半球', '再看节气'],
        formula: '',
        callout: '易错'
      },
      {
        title: '做题步骤',
        narration: '题里先找日期或节气，再判直射点位置，最后推正午太阳高度和昼夜长短。',
        visual: '四步清单卡片：定节气 / 找直射 / 判半球 / 推现象',
        points: ['确定节气', '找直射点', '判断半球', '推出现象'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['公转+地轴倾斜形成四季', '直射点在回归线间移动', '南北半球季节相反'],
    badges: ['公转', '地轴', '直射点', '昼夜']
  },
  辛亥革命: {
    subjectHint: 'history',
    palette: 'history',
    definition: '辛亥革命是 1911 年爆发的资产阶级民主革命，推翻了清王朝统治和君主专制制度，建立了中华民国，使民主共和观念逐渐深入人心。',
    formula: '1911',
    formulaNote: '武昌起义爆发',
    keyNumbers: ['1911', '武昌起义', '中华民国', '帝制结束'],
    misconceptions: [
      '辛亥革命推翻帝制，但并未完成反帝反封建的全部任务',
      '不能把辛亥革命简单说成一次“彻底成功”的革命'
    ],
    examples: [
      '武昌起义后各省响应，清王朝统治迅速瓦解。',
      '中华民国成立后，民主共和观念广泛传播。'
    ],
    conditions: '民族危机加深、清政府腐败、革命思想传播与革命组织准备。',
    subconcepts: [
      {
        title: '背景原因',
        narration: '辛亥革命爆发前，民族危机深重，清政府腐败无能，革命思想和组织不断积蓄力量。',
        visual: '原因卡：民族危机 / 清朝腐败 / 革命思潮',
        points: ['民族危机加深', '清政府腐败', '革命思想传播'],
        formula: '',
        callout: '背景'
      },
      {
        title: '过程节点',
        narration: '抓住时间轴：1911 年武昌起义爆发，各省响应，清王朝统治土崩瓦解。',
        visual: '时间轴：背景—武昌起义—各省响应—民国建立',
        points: ['1911 武昌起义', '各省响应', '清廷瓦解'],
        formula: '1911',
        callout: '过程'
      },
      {
        title: '结果影响',
        narration: '辛亥革命推翻了君主专制，建立中华民国，使民主共和观念深入人心。',
        visual: '影响卡：结束帝制 / 建立民国 / 思想解放',
        points: ['推翻帝制', '建立中华民国', '共和观念传播'],
        formula: '',
        callout: '影响'
      },
      {
        title: '局限评价',
        narration: '它有伟大历史功绩，也有局限：没有彻底反帝反封建，革命果实后来被窃取。评价要一分两面。',
        visual: '对比卡：历史功绩 vs 局限性',
        points: ['结束帝制功绩大', '未彻底反帝反封建', '评价要全面'],
        formula: '',
        callout: '评价'
      },
      {
        title: '做题步骤',
        narration: '历史题先定时空，再串因果：背景—过程—结果—影响—局限，别只背年份。',
        visual: '四步清单卡片：定时空 / 串因果 / 抓影响 / 看局限',
        points: ['确定时间地点', '串起因果关系', '归纳影响', '补充局限'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['1911 年武昌起义', '推翻帝制建立民国', '共和观念深入人心'],
    badges: ['1911', '起义', '共和', '影响']
  },

  工业革命: {
    subjectHint: 'history',
    palette: 'history',
    definition: '工业革命是 18 世纪 60 年代首先从英国开始的技术与生产组织变革。机器生产逐步取代手工劳动，蒸汽动力推动工厂制度、交通运输和社会结构发生深刻变化。',
    formula: '18 世纪 60 年代',
    formulaNote: '英国率先开始，19 世纪中期基本完成',
    keyNumbers: ['18 世纪 60 年代', '1765 珍妮机', '1785 蒸汽动力', '1825 铁路'],
    misconceptions: [
      '瓦特不是蒸汽机的最初发明者，他的重要贡献是改良蒸汽机并推动其广泛应用',
      '工业革命不只有生产力进步，也带来工人处境、城市污染和社会分化等问题'
    ],
    examples: [
      '棉纺织业率先采用珍妮纺纱机等机器，生产效率显著提高。',
      '蒸汽机车和铁路把原料、商品与人口更快连接起来，扩大了工业市场。'
    ],
    conditions: '英国较早确立资本主义制度，并具备海外市场、资本积累、劳动力和技术经验等条件。',
    subconcepts: [
      {
        title: '英国起点',
        narration: '工业革命首先发生在英国。资本主义制度、海外市场、资本和劳动力，为机器生产准备了条件。',
        visual: '因果图：制度与市场 / 资本与劳动力 / 技术积累 → 英国率先工业化',
        points: ['资本主义制度确立', '海外市场与资本', '劳动力和技术积累'],
        formula: '',
        callout: '背景'
      },
      {
        title: '机器生产',
        narration: '18 世纪 60 年代，棉纺织业从珍妮纺纱机等发明开始，机器生产逐步取代手工劳动。',
        visual: '时间轴：手工纺织—1765 珍妮机—机器纺织—生产效率提升',
        points: ['棉纺织业率先突破', '1765 珍妮机', '机器取代手工'],
        formula: '1765',
        callout: '开端'
      },
      {
        title: '蒸汽时代',
        narration: '瓦特改良蒸汽机后，工厂不再只依赖水力。稳定强大的蒸汽动力，把人类带入蒸汽时代。',
        visual: '动力对比：水力受地点限制 vs 蒸汽动力稳定通用 + 工厂齿轮',
        points: ['瓦特改良蒸汽机', '摆脱水力地点限制', '蒸汽时代到来'],
        formula: '1785',
        callout: '动力'
      },
      {
        title: '工厂与交通',
        narration: '机器集中催生现代工厂。蒸汽机车和铁路又加快原料、商品与人口流动，工业革命向欧美扩展。',
        visual: '进程图：工厂制度—蒸汽机车—铁路时代—欧美扩展',
        points: ['现代工厂制度', '1825 铁路运输', '工业化向欧美扩展'],
        formula: '1825',
        callout: '扩展'
      },
      {
        title: '双重影响',
        narration: '工业革命极大提高生产力，推动城市化和世界市场发展，也带来劳资矛盾、恶劣工况与环境污染。',
        visual: '双面评价卡：生产力与城市化 vs 劳资矛盾与污染',
        points: ['生产力飞跃', '城市化与世界市场', '劳资矛盾和环境问题'],
        formula: '',
        callout: '影响'
      }
    ],
    summaryPoints: ['18 世纪 60 年代英国起步', '蒸汽动力推动工厂与铁路', '生产力进步伴随社会问题'],
    badges: ['机器生产', '蒸汽时代', '工厂制度', '社会变革']
  },

  凸透镜成像: {
    subjectHint: 'physics',
    palette: 'light',
    definition: '凸透镜对光线有会聚作用。物体经凸透镜成像时，像的大小、正倒、虚实随物距 u 与焦距 f 的关系变化。常用三条特征光线作图。',
    formula: 'u 与 f',
    formulaNote: '先定 F/2F，再作三条光线',
    keyNumbers: ['F', '2F', '倒立实像', '正立虚像'],
    misconceptions: [
      '不是所有物距都成倒立实像：u<f 时成正立放大虚像',
      '实像可呈现在光屏上，虚像不能'
    ],
    examples: [
      '照相机：物在 2f 外，成缩小倒立实像。',
      '投影仪：物在 f 与 2f 之间，成放大倒立实像。'
    ],
    conditions: '薄透镜近轴光线近似；作图时光线经光心、平行后过焦点、过焦点后平行。',
    subconcepts: [
      {
        title: '会聚作用',
        narration: '凸透镜中间厚、边缘薄，对光线有会聚作用。作图前先标出光心和两侧焦点 F、二倍焦距 2F。',
        visual: '凸透镜 + 主光轴 + F/2F 标记',
        points: ['会聚光线', '标 F 与 2F', '先定光轴'],
        formula: '',
        callout: '基础'
      },
      {
        title: '三条特征光线',
        narration: '记住三条特征光线：平行主光轴的光线过另一侧焦点；过光心的光线方向不变；过焦点的光线折射后平行主光轴。',
        visual: '物箭头 + 三条特征光线交于像',
        points: ['平行→过焦点', '过光心不偏折', '过焦点→平行'],
        formula: '',
        callout: '作图'
      },
      {
        title: 'u>2f 成像',
        narration: '物在二倍焦距以外时，成倒立、缩小的实像，照相机就利用这个规律。',
        visual: '物在 2F 外 + 缩小倒立实像 + 光屏可承接',
        points: ['u>2f', '倒立缩小实像', '可呈光屏'],
        formula: 'u>2f',
        callout: '规律一'
      },
      {
        title: '其他物距',
        narration: '物在 2f 处等大倒立实像；在 f 与 2f 之间放大倒立实像；小于 f 则成正立放大虚像。',
        visual: '成像规律对照卡：物距区间与像的性质',
        points: ['u=2f 等大', 'f<u<2f 放大实像', 'u<f 虚像'],
        formula: '',
        callout: '规律二'
      },
      {
        title: '做题步骤',
        narration: '做成像题：先找 f 和物距区间，再判断像的性质，需要时画三条光线验证。',
        visual: '四步清单：定 f / 判区间 / 定像性 / 作图验',
        points: ['确定焦距', '判断物距区间', '说出像的性质', '作图验证'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['先标 F/2F 再作图', '物距区间决定像的性质', '实像倒立可呈屏，虚像正立'],
    badges: ['凸透镜', 'F/2F', '实像', '虚像']
  },
  滑轮: {
    subjectHint: 'physics',
    palette: 'mechanics',
    definition: '滑轮是可以绕中心轴转动的圆盘。定滑轮固定不动，主要改变力的方向；动滑轮随物体一起移动，可以省力但费距离。',
    formula: '定滑轮 F=G；动滑轮 F≈G/2',
    formulaNote: '理想情况不计摩擦与轮重',
    keyNumbers: ['定滑轮', '动滑轮', 'F=G', 'F=G/2'],
    misconceptions: [
      '定滑轮不省力，只改变力的方向',
      '动滑轮省力但费距离，不是“又省力又省距离”'
    ],
    examples: [
      '旗杆顶部常用定滑轮，方便向下拉绳使旗帜上升。',
      '起重机常用滑轮组，结合定滑轮与动滑轮。'
    ],
    conditions: '理想模型忽略摩擦和滑轮自重；实际会更费力一些。',
    subconcepts: [
      {
        title: '定滑轮',
        narration: '定滑轮的轴固定。它能改变拉力方向，但理想情况下拉力仍约等于物重，并不省力。',
        visual: '定滑轮：F 与 G 等长箭头 + “改变方向、不省力”',
        points: ['轴固定', '改变方向', 'F≈G 不省力'],
        formula: 'F = G',
        callout: '定滑轮'
      },
      {
        title: '动滑轮',
        narration: '动滑轮的轴随物体移动。承担物重的绳子段数变多，理想情况可省一半力，但要多拉绳。',
        visual: '动滑轮：两段绳子承担 G，F≈G/2',
        points: ['轴随物体动', '省力费距离', 'F≈G/2'],
        formula: 'F ≈ G/2',
        callout: '动滑轮'
      },
      {
        title: '对比纠正',
        narration: '很多同学误以为定滑轮省力。其实省力主要靠动滑轮或滑轮组；定滑轮更常用来改变方向。',
        visual: '定滑轮 vs 动滑轮 对照：方向 / 省力 / 距离',
        points: ['定滑轮不省力', '动滑轮才省力', '省力通常费距离'],
        formula: '',
        callout: '易错'
      },
      {
        title: '生活例子',
        narration: '升旗用定滑轮，人站在地上向下拉；起重机用滑轮组，既改方向又省力。',
        visual: '旗杆定滑轮 + 滑轮组示意',
        points: ['升旗改方向', '滑轮组省力', '联系生活'],
        formula: '',
        callout: '例子'
      },
      {
        title: '做题步骤',
        narration: '先判断是定滑轮还是动滑轮，再数承担物重的绳子段数，最后写 F 与 G 的关系并检查是否忽略摩擦。',
        visual: '四步清单：判类型 / 数绳段 / 写关系 / 查理想条件',
        points: ['判断类型', '数绳子段数', '写 F 与 G', '检查条件'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['定滑轮改方向不省力', '动滑轮省力费距离', '先判类型再列关系'],
    badges: ['定滑轮', '动滑轮', '省力', '方向']
  },
  并联电路: {
    subjectHint: 'physics',
    palette: 'electricity',
    definition: '并联电路中，用电器并列连接在电路两点之间，电流有多条路径。干路电流等于各支路电流之和，各支路两端电压相等。',
    formula: 'I = I1 + I2；U = U1 = U2',
    formulaNote: '并联电流分流、电压相等',
    keyNumbers: ['多路径', '分流', '电压相等', '干路开关'],
    misconceptions: [
      '并联不是“电阻一定更小就可以乱接”，要先分清干路与支路',
      '一条支路断开，其他支路通常仍可工作，这与串联不同'
    ],
    examples: [
      '家庭电路中各用电器通常并联，互不影响。',
      '两盏灯并联时，关掉一盏，另一盏仍可亮。'
    ],
    conditions: '理想导线电阻忽略；先识别干路开关和支路元件。',
    subconcepts: [
      {
        title: '结构特征',
        narration: '并联电路有两条或更多支路。电流在分支点分开，再在汇合点汇合，所以是多路径。',
        visual: '并联电路：干路 + 两条支路灯泡 + 电流箭头分叉',
        points: ['多条路径', '有干路有支路', '先认结构'],
        formula: '',
        callout: '结构'
      },
      {
        title: '电流关系',
        narration: '干路电流等于各支路电流之和。电流会分流，支路电阻越小，分到的电流通常越大。',
        visual: '干路粗箭头分成两条支路箭头',
        points: ['I=I1+I2', '电流分流', '支路可不同'],
        formula: 'I = I1 + I2',
        callout: '电流'
      },
      {
        title: '电压关系',
        narration: '并联各支路两端电压相等，都等于电源电压。分析时别把串联的分压套过来。',
        visual: '两支路并列，U1=U2 高亮',
        points: ['U=U1=U2', '电压相等', '不同于串联分压'],
        formula: 'U = U1 = U2',
        callout: '电压'
      },
      {
        title: '开关与影响',
        narration: '干路开关控制整个电路；支路开关通常只控制本支路。一盏灯熄灭，另一支路往往仍可工作。',
        visual: '干路开关 + 两支路灯，标注互不影响',
        points: ['干路总控', '支路相对独立', '不同于串联全断'],
        formula: '',
        callout: '开关'
      },
      {
        title: '做题步骤',
        narration: '并联题先画清干路支路，再写电流分流和电压相等，最后结合欧姆定律求未知量。',
        visual: '四步清单：认结构 / 写 U 关系 / 写 I 关系 / 代入计算',
        points: ['识别干支路', '写电压关系', '写电流关系', '代入计算'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['并联多路径', '电流分流电压相等', '支路相对独立'],

    badges: ['并联', '分流', '干路', '支路']
  },

  中和反应: {
    subjectHint: 'chemistry',
    palette: 'chemistry',
    definition: '酸与碱作用生成盐和水的反应叫中和反应。中和反应属于复分解反应，常用酸碱指示剂判断反应进程。',
    formula: 'H⁺ + OH⁻ = H₂O',
    formulaNote: '实质是氢离子与氢氧根离子结合成水',
    keyNumbers: ['酸', '碱', '盐', '水'],
    misconceptions: [
      '中和反应不等于所有酸和碱的任意混合都“一定中和完全”，要看用量',
      '生成盐和水不等于溶液一定呈中性，过量酸或碱会改变酸碱性'
    ],
    examples: [
      '盐酸与氢氧化钠反应生成氯化钠和水。',
      '用熟石灰处理酸性土壤，利用中和反应降低酸性。'
    ],
    conditions: '酸提供 H⁺，碱提供 OH⁻；常在溶液中进行，可用指示剂观察。',
    subconcepts: [
      {
        title: '定义总述',
        narration: '中和反应就是酸和碱“对消”，生成盐和水。先抓产物：一定有盐，也一定有水。',
        visual: '酸 + 碱 → 盐 + 水 反应箭头图',
        points: ['酸与碱反应', '生成盐和水', '属于复分解'],
        formula: '酸+碱→盐+水',
        callout: '定义'
      },
      {
        title: '反应实质',
        narration: '从离子角度看，真正结合的是氢离子和氢氧根离子，它们结合成水。其他离子往往组成盐。',
        visual: 'H⁺ 与 OH⁻ 靠近结合成 H₂O，旁注盐离子',
        points: ['H⁺ 来自酸', 'OH⁻ 来自碱', '结合成水'],
        formula: 'H⁺ + OH⁻ = H₂O',
        callout: '实质'
      },
      {
        title: '指示剂',
        narration: '中和过程常用指示剂观察酸碱性变化。比如酚酞在碱性中变红，接近中性或酸性时颜色会改变。',
        visual: '滴加指示剂的烧杯：颜色变化示意',
        points: ['指示剂看酸碱性', '颜色变化提示终点', '帮助判断过量'],
        formula: '',
        callout: '观察'
      },
      {
        title: '生活例子',
        narration: '酸性土壤加熟石灰、蚊虫叮咬后涂碱性或弱碱性物质，都和中和思路有关：用一种性质抵消另一种。',
        visual: '生活场景卡：改土 / 止痒 / 处理废酸',
        points: ['改良酸性土壤', '处理废酸废碱', '生活中有应用'],
        formula: '',
        callout: '应用'
      },
      {
        title: '做题步骤',
        narration: '做中和题：先写反应物和产物，再看是否完全中和，最后结合指示剂或 pH 判断溶液酸碱性。',
        visual: '四步清单：写反应 / 看用量 / 判酸碱 / 回代检验',
        points: ['写清反应', '判断是否过量', '看指示剂', '回代检验'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['酸+碱→盐+水', '实质 H⁺+OH⁻=H₂O', '指示剂帮助判断'],
    badges: ['中和', '酸', '碱', '盐']
  },

  金属活动性顺序: {
    subjectHint: 'chemistry',
    palette: 'chemistry',
    definition: '金属活动性顺序反映金属原子失电子能力强弱。排在前面的金属活动性更强，通常更能把后面的金属从盐溶液中置换出来，也更能与酸反应产生氢气。',
    formula: 'K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au',
    formulaNote: '前强后弱；H 是比较基准之一',
    keyNumbers: ['前强后弱', '置换', '氢前金属'],
    misconceptions: [
      '活动性强不等于单质“更稳定”，恰恰是更易失电子、更活泼',
      '不是所有金属都能与酸反应放出氢气，氢后金属通常不行'
    ],
    examples: [
      '锌能置换硫酸铜中的铜：Zn + CuSO₄ → ZnSO₄ + Cu。',
      '铁能与稀盐酸反应产生氢气，铜通常不能。'
    ],
    conditions: '比较时看失电子能力；置换反应还要满足活动性前后位置关系与溶液条件。',
    subconcepts: [
      {
        title: '顺序含义',
        narration: '金属活动性顺序从左到右逐渐减弱。前面的金属更活泼，更容易失去电子。',
        visual: '金属活动性阶梯：K→Au，箭头标注“活动性减弱”',
        points: ['前强后弱', '失电子能力', '顺序可比较'],
        formula: '',
        callout: '顺序'
      },
      {
        title: '与酸反应',
        narration: '排在氢前面的金属，一般能与稀酸反应产生氢气；氢后面的金属通常不行。',
        visual: '氢前金属气泡示意 vs 氢后金属无气泡对照',
        points: ['氢前产氢', '氢后通常不产氢', '看位置判断'],
        formula: '金属 + 酸 → 盐 + H₂',
        callout: '酸'
      },
      {
        title: '置换反应',
        narration: '活动性强的金属可以把活动性弱的金属从它的盐溶液中置换出来。这是顺序最常见的应用。',
        visual: 'Zn 放入 CuSO₄：锌表面析出铜 + 溶液颜色变化',
        points: ['前换后', '盐溶液中进行', '生成新金属单质'],
        formula: '',
        callout: '置换'
      },
      {
        title: '易错提醒',
        narration: '不要死记“铁一定比铜活泼所以任何条件下都能换”，还要看是否是盐溶液、是否符合顺序。',
        visual: '易错卡：条件不满足 / 顺序反了 / 混淆稳定性',
        points: ['先看顺序', '再看条件', '别混淆稳定性'],
        formula: '',
        callout: '易错'
      },
      {
        title: '做题步骤',
        narration: '题里先定位两种金属在顺序中的前后，再判断能否置换或能否与酸反应，最后写方程式。',
        visual: '四步清单：找位置 / 判能否 / 写反应 / 查条件',
        points: ['定位顺序', '判断能否', '写化学式', '检查条件'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['前强后弱', '氢前金属可产氢', '前金属可置换后金属'],
    badges: ['活动性', '置换', '氢前', '失电子']
  },

  等高线: {
    subjectHint: 'geography',
    palette: 'geography',
    definition: '等高线是地图上海拔高度相等的各点连成的闭合曲线。根据等高线疏密、弯曲和数值变化，可以判读地势高低、坡度陡缓和山顶、山谷、山脊、陡崖等地形。',
    formula: '等高距',
    formulaNote: '相邻等高线的高度差',
    keyNumbers: ['闭合曲线', '等高距', '疏密判坡度'],
    misconceptions: [
      '等高线密集不是“海拔一定更高”，而是坡度更陡',
      '数值相同只表示同高度，不表示一定是同一座山'
    ],
    examples: [
      '登高路线常选等高线较稀疏处，坡度较缓。',
      '等高线重合或非常密集处可能表示陡崖。'
    ],
    conditions: '同一幅图等高距固定；判读要结合数值增减方向与弯曲形态。',
    subconcepts: [
      {
        title: '定义总述',
        narration: '等高线把相同海拔的点连起来。看到一圈套一圈，就能想象地面的起伏。',
        visual: '等高线圈层示意图 + 海拔标注',
        points: ['同线同高', '闭合曲线', '表达起伏'],
        formula: '',
        callout: '定义'
      },
      {
        title: '坡度判读',
        narration: '等高线密集，坡度陡；等高线稀疏，坡度缓。先看疏密，再谈难不难爬。',
        visual: '左密右疏对照：陡坡 / 缓坡',
        points: ['密集=陡', '稀疏=缓', '同图比较'],
        formula: '',
        callout: '坡度'
      },
      {
        title: '地形部位',
        narration: '山顶、山脊、山谷、鞍部、陡崖都有典型等高线形态。弯曲方向和闭合关系是关键。',
        visual: '山顶闭合高值 + 山谷/山脊弯曲示意',
        points: ['山顶闭合', '山脊山谷弯曲不同', '陡崖很密或重合'],
        formula: '',
        callout: '部位'
      },
      {
        title: '等高距',
        narration: '等高距是相邻两条等高线的高度差。知道等高距，才能算相对高度。',
        visual: '相邻等高线 100 / 200 / 300 标注等高距',
        points: ['相邻高度差', '同图通常固定', '算相对高度'],
        formula: '等高距',
        callout: '数值'
      },
      {
        title: '做题步骤',
        narration: '先读数值定高低，再看疏密判坡度，然后认部位，最后算相对高度或选路线。',
        visual: '四步清单：读数 / 看疏密 / 认部位 / 算高差',
        points: ['读海拔', '判坡度', '认地形', '算高差'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['同线同高', '密陡疏缓', '形态判地形部位'],
    badges: ['等高线', '坡度', '山顶', '等高距']
  },

  影响气候的因素: {
    subjectHint: 'geography',
    palette: 'geography',
    definition: '气候受纬度位置、海陆位置、地形、洋流和人类活动等多种因素共同影响。其中纬度位置通过太阳辐射影响气温基础，海陆与地形显著改变降水和气温分布。',
    formula: '气候 = 多因素叠加',
    formulaNote: '先抓主导因素，再看修正因素',
    keyNumbers: ['纬度', '海陆', '地形', '洋流'],
    misconceptions: [
      '不是纬度低就一定更湿润，还要看海陆和季风',
      '地形对气候的影响不只是“海拔高更冷”，还有迎风坡降水'
    ],
    examples: [
      '同纬度沿海与内陆降水差异明显。',
      '山地迎风坡多雨、背风坡少雨。'
    ],
    conditions: '分析某地气候时，先找位置条件，再叠加地形与洋流等局地因素。',
    subconcepts: [
      {
        title: '纬度因素',
        narration: '纬度决定正午太阳高度和昼夜长短的基础差异，是气温分布的第一背景。',
        visual: '低纬高纬太阳高度对照',
        points: ['低纬热量多', '高纬热量少', '气温基础差'],
        formula: '',
        callout: '纬度'
      },
      {
        title: '海陆因素',
        narration: '海洋升温降温慢，陆地快。沿海更湿润、温差较小；内陆更干燥、温差较大。',
        visual: '沿海 vs 内陆对比卡：降水 / 温差',
        points: ['海陆热力差异', '沿海较湿润', '内陆温差大'],
        formula: '',
        callout: '海陆'
      },
      {
        title: '地形因素',
        narration: '海拔升高气温通常降低；山脉还会造成迎风坡多雨、背风坡少雨。',
        visual: '山脉剖面：迎风坡云雨 / 背风坡干燥',
        points: ['海拔影响气温', '迎风坡多雨', '背风坡少雨'],
        formula: '',
        callout: '地形'
      },
      {
        title: '综合判断',
        narration: '真实气候很少只由一个因素决定。做题要先找主导因素，再看有没有地形或洋流修正。',
        visual: '因素叠加图：纬度→海陆→地形→结果',
        points: ['先抓主导', '再看修正', '多因素叠加'],
        formula: '',
        callout: '综合'
      },
      {
        title: '做题步骤',
        narration: '题干先定位经纬和海陆，再看山脉走向与海拔，最后解释气温降水特征。',
        visual: '四步清单：定位置 / 判海陆 / 看地形 / 说气候',
        points: ['定位置', '判海陆', '看地形', '归纳气候'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['纬度定热量基础', '海陆改温湿', '地形改局地气候'],
    badges: ['纬度', '海陆', '地形', '气候']
  },

  鸦片战争: {
    subjectHint: 'history',
    palette: 'history',
    definition: '鸦片战争是 1840—1842 年英国对中国发动的侵略战争。战争以中国战败、签订《南京条约》结束，中国开始沦为半殖民地半封建社会。',
    formula: '1840—1842',
    formulaNote: '《南京条约》签订',
    keyNumbers: ['1840', '1842', '南京条约', '香港岛'],
    misconceptions: [
      '鸦片战争不只是“贸易冲突”，根本是英国打开中国市场的侵略战争',
      '《南京条约》不只割地赔款，还包括五口通商等特权'
    ],
    examples: [
      '虎门销烟是重要背景与导火线之一。',
      '《南京条约》割香港岛、赔款、五口通商。'
    ],
    conditions: '英美工业革命后扩张市场；清朝统治危机与闭关政策；鸦片走私与禁烟斗争。',
    subconcepts: [
      {
        title: '背景原因',
        narration: '英国为打开中国市场、扭转贸易逆差，向中国走私鸦片。禁烟与侵略野心共同把冲突推向战争。',
        visual: '原因卡：市场扩张 / 鸦片走私 / 禁烟斗争',
        points: ['打开市场', '鸦片走私', '禁烟冲突'],
        formula: '',
        callout: '背景'
      },
      {
        title: '过程节点',
        narration: '抓住时间轴：1840 年战争爆发，战事推进后清政府战败，1842 年被迫议和。',
        visual: '时间轴：禁烟—开战—战败—签约',
        points: ['1840 开战', '清军失利', '1842 议和'],
        formula: '1840—1842',
        callout: '过程'
      },
      {
        title: '主要结果',
        narration: '《南京条约》是中国近代第一个不平等条约：割香港岛、赔款、五口通商等，严重破坏中国主权。',
        visual: '结果卡：割地 / 赔款 / 五口通商',
        points: ['割香港岛', '巨额赔款', '五口通商'],
        formula: '',
        callout: '结果'
      },
      {
        title: '历史影响',
        narration: '鸦片战争后，中国社会性质开始变化，独立主权受破坏，也促使先进中国人开眼看世界。',
        visual: '影响卡：半殖民地开端 / 主权受损 / 思想震动',
        points: ['开始沦为半殖民地半封建', '主权受损', '民族觉醒萌芽'],
        formula: '',
        callout: '影响'
      },
      {
        title: '做题步骤',
        narration: '历史题按“背景—过程—条约内容—影响”作答，年份和条约要点要对应准确。',
        visual: '四步清单：定时空 / 抓条约 / 析影响 / 辨性质',
        points: ['定时间', '记条约', '析影响', '判性质'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['1840—1842 英国侵华', '《南京条约》首个不平等条约', '中国社会性质开始变化'],
    badges: ['1840', '南京条约', '侵略', '开端']
  },

  五四运动: {
    subjectHint: 'history',
    palette: 'history',
    definition: '五四运动是 1919 年爆发的以青年学生为先锋、广大群众参加的彻底反帝反封建的爱国运动，促进了马克思主义在中国的传播，是中国新民主主义革命的开端。',
    formula: '1919.5.4',
    formulaNote: '北京学生示威游行',
    keyNumbers: ['1919', '巴黎和会', '反帝反封建', '新民主主义开端'],
    misconceptions: [
      '五四不只是学生运动，后来发展成工人群众广泛参与的爱国运动',
      '它的意义不只在“游行”，更在思想启蒙与革命阶段转变'
    ],
    examples: [
      '巴黎和会上中国外交失败消息传来，成为直接导火线。',
      '罢课、罢工、罢市互相声援，迫使北洋政府作出让步。'
    ],
    conditions: '第一次世界大战后帝国主义分赃；北洋军阀统治；新文化运动思想准备。',
    subconcepts: [
      {
        title: '导火线',
        narration: '巴黎和会把德国在山东的权益转交给日本，中国外交失败，直接点燃五四怒火。',
        visual: '导火线卡：巴黎和会 / 山东问题 / 外交失败',
        points: ['巴黎和会', '山东权益', '外交失败'],
        formula: '1919',
        callout: '导火线'
      },
      {
        title: '过程发展',
        narration: '5 月 4 日北京学生游行示威，随后运动扩展到工人和市民，出现罢课罢工罢市。',
        visual: '时间轴：学生先锋—全国响应—三罢斗争',
        points: ['学生先锋', '群众参与', '三罢扩大'],
        formula: '1919.5.4',
        callout: '过程'
      },
      {
        title: '口号目标',
        narration: '外争主权、内除国贼，体现彻底的反帝反封建要求。这是运动的鲜明旗帜。',
        visual: '口号卡：外争主权 / 内除国贼',
        points: ['反帝', '反封建', '爱国旗帜'],
        formula: '',
        callout: '目标'
      },
      {
        title: '历史意义',
        narration: '五四促进了马克思主义传播，标志着中国新民主主义革命的开端，也推动了思想解放。',
        visual: '意义卡：新开端 / 思想解放 / 马克思主义传播',
        points: ['新民主主义开端', '马克思主义传播', '思想解放'],
        formula: '',
        callout: '意义'
      },
      {
        title: '做题步骤',
        narration: '答题先写时间地点，再串导火线与过程，最后落在性质和意义上，避免只背口号。',
        visual: '四步清单：定时空 / 串过程 / 抓口号 / 写意义',
        points: ['定时空', '串过程', '抓性质', '写意义'],
        formula: '',
        callout: '方法'
      }
    ],
    summaryPoints: ['1919 年爱国运动', '彻底反帝反封建', '新民主主义革命开端'],
    badges: ['1919', '爱国', '反帝', '开端']
  },

};

function mapGrade(code) {
  return {
    grade7: '初一',
    grade8: '初二',
    grade9: '初三',
    grade10: '高一',
    grade11: '高二',
    grade12: '高三'
  }[code] || code || '初中';
}

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '')
    .slice(0, 40) || 'topic';
}

function clampText(text, max = 48) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function uniqueNonEmpty(list = [], max = 5) {
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const value = String(item || '').replace(/\s+/g, ' ').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

function resolvePalette(input, knowledge = {}) {
  if (knowledge.palette) return knowledge.palette;
  return PALETTE_BY_SUBJECT[input.subject] || PALETTE_BY_SUBJECT[knowledge.subjectHint] || 'electricity';
}

function resolveVoice(input = {}, config = {}) {
  const provider = input.ttsProvider
    || input.modelSnapshot?.ttsProvider
    || config.default_tts_provider
    || process.env.DEFAULT_TTS_PROVIDER
    || 'edge';
  const edgeVoice = input.ttsVoice
    || input.modelSnapshot?.ttsVoice
    || config.default_edge_voice
    || process.env.DEFAULT_EDGE_VOICE
    || 'zh-CN-XiaoxiaoNeural';
  const seedVoice = input.ttsVoice
    || input.modelSnapshot?.ttsVoice
    || config.default_seed_voice
    || process.env.DEFAULT_SEED_VOICE
    || 'zh_female_vv_uranus_bigtts';
  const speedRaw = Number(input.ttsSpeed ?? input.modelSnapshot?.ttsSpeed ?? process.env.DEFAULT_TTS_SPEED ?? 1);
  const speed = Number.isFinite(speedRaw) ? Math.min(2, Math.max(0.5, speedRaw)) : 1;
  const voiceId = provider === 'seed' ? seedVoice : edgeVoice;
  return {
    provider,
    voice_id: voiceId,
    edge_voice_id: edgeVoice,
    minimax_voice_id: process.env.DEFAULT_MINIMAX_VOICE || 'female-chengshu',
    seed_voice_id: seedVoice,
    speed
  };
}


export function listKnowledgePacks() {
  return Object.entries(KNOWLEDGE_PACKS).map(([key, pack]) => ({
    key,
    ...pack
  }));
}

export function findKnowledgePack(topic = '') {
  const t = String(topic || '').trim();
  if (!t) return null;
  if (KNOWLEDGE_PACKS[t]) return { key: t, ...KNOWLEDGE_PACKS[t] };
  const hit = Object.keys(KNOWLEDGE_PACKS).find((key) => t.includes(key) || key.includes(t));
  if (!hit) return null;
  return { key: hit, ...KNOWLEDGE_PACKS[hit] };
}

function heuristicKnowledge(input = {}) {
  const topic = String(input.topic || '知识点').trim();
  const goals = uniqueNonEmpty(input.learningGoals || [], 4);
  const notes = String(input.styleNotes || '').trim();
  const pack = findKnowledgePack(topic);
  if (pack) {
    return {
      source: 'knowledge_pack',
      topic,
      definition: pack.definition,
      formula: pack.formula,
      formulaNote: pack.formulaNote,
      keyNumbers: pack.keyNumbers || [],
      misconceptions: pack.misconceptions || [],
      examples: pack.examples || [],
      conditions: pack.conditions || '',
      subconcepts: pack.subconcepts || [],
      summaryPoints: pack.summaryPoints || [],
      badges: pack.badges || [],
      palette: pack.palette,
      subjectHint: pack.subjectHint
    };
  }

  const definition = goals[0]
    ? `${topic}的核心定义是：${goals[0]}。学习时先抓住“是什么、在什么条件下成立”。`
    : `${topic}研究的是相关现象的本质规律。先明确定义，再看条件、关系和典型例子。`;
  const examples = notes
    ? [notes, `结合课堂实验或生活场景理解${topic}`]
    : [`把${topic}放到一个可观察的实验或生活场景中`, `用前后状态对比理解${topic}`];
  const misconceptions = goals[1]
    ? [goals[1], `不要把${topic}的条件和结论记混`]
    : [`不要忽略${topic}成立的前提条件`, `相关概念要对比记忆，避免张冠李戴`];
  const formula = goals.find((g) => /[=＝]|公式|定理|定律/.test(g)) || `${topic} 关键关系`;
  const subconcepts = [
    {
      title: '核心定义',
      narration: clampText(`同学们，先记住${topic}的定义：${definition}`, 60),
      visual: `左侧定义示意；右侧 info_card 三条定义要点`,
      points: uniqueNonEmpty([definition, ...goals], 3),
      formula,
      callout: '定义'
    },
    {
      title: '成立条件',
      narration: `这个规律不是任何时候都能直接套。先检查前提条件，条件不对，结论就不能乱推。`,
      visual: '条件清单 + 适用/不适用对照',
      points: uniqueNonEmpty([`明确${topic}的适用条件`, '分清变量与不变量', '先判条件再下结论'], 3),
      formula: '',
      callout: '条件'
    },
    {
      title: '关键关系',
      narration: `接下来看量与量之间怎么对应。谁决定谁、怎么变化，是理解${topic}的关键。`,
      visual: '关系箭头图 / 对比表',
      points: uniqueNonEmpty([...goals, '抓住因果关系', '用关键词建立联系'], 3),
      formula,
      callout: '关系'
    },
    {
      title: '典型例子',
      narration: clampText(`看一个具体例子：${examples[0]}。例子能把抽象定义变成可观察过程。`, 60),
      visual: '双场景例子：过程前 → 过程后',
      points: uniqueNonEmpty(examples, 3),
      formula: '',
      callout: '例子'
    },
    {
      title: '易错与方法',
      narration: clampText(`最容易错的是：${misconceptions[0]}。做题时按“条件-关系-回代”三步走。`, 60),
      visual: '易错提醒卡 + 三步方法清单',
      points: uniqueNonEmpty([...misconceptions, '条件→关系→回代'], 3),
      formula: '',
      callout: '避坑'
    }
  ];

  return {
    source: 'heuristic',
    topic,
    definition,
    formula,
    formulaNote: '关键关系/记忆锚点',
    keyNumbers: uniqueNonEmpty([formula, ...goals], 4),
    misconceptions,
    examples,
    conditions: `先确认${topic}的适用条件，再进行推理。`,
    subconcepts,
    summaryPoints: uniqueNonEmpty([definition, examples[0], misconceptions[0]], 3),
    badges: uniqueNonEmpty([topic.slice(0, 4), '定义', '条件', '例子'], 4)
  };
}

function extractJsonObject(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeKnowledge(raw = {}, input = {}) {
  const topic = String(input.topic || raw.topic || '知识点').trim();
  const base = heuristicKnowledge(input);
  const subconceptsIn = Array.isArray(raw.subconcepts) ? raw.subconcepts : [];
  const subconcepts = [];
  for (let i = 0; i < 5; i += 1) {
    const item = subconceptsIn[i] || base.subconcepts[i] || {};
    const points = uniqueNonEmpty(item.points || item.bullets || item.key_points || [], 3);
    const fallback = base.subconcepts[i] || {};
    subconcepts.push({
      title: clampText(item.title || fallback.title || `要点${i + 1}`, 12),
      narration: clampText(item.narration || item.script || fallback.narration || `${topic}第${i + 1}个要点。`, 60),
      visual: clampText(item.visual || fallback.visual || `${item.title || fallback.title}示意图 + info_card`, 120),
      points: points.length ? points : uniqueNonEmpty(fallback.points || [], 3),
      formula: clampText(item.formula || fallback.formula || '', 32),
      callout: clampText(item.callout || fallback.callout || '要点', 12)
    });
  }

  return {
    source: raw.source || 'llm',
    topic,
    definition: clampText(raw.definition || base.definition, 120),
    formula: clampText(raw.formula || base.formula, 40),
    formulaNote: clampText(raw.formulaNote || raw.formula_note || base.formulaNote, 40),
    keyNumbers: uniqueNonEmpty(raw.keyNumbers || raw.key_numbers || base.keyNumbers, 5),
    misconceptions: uniqueNonEmpty(raw.misconceptions || raw.pitfalls || base.misconceptions, 4),
    examples: uniqueNonEmpty(raw.examples || base.examples, 4),
    conditions: clampText(raw.conditions || base.conditions, 100),
    subconcepts,
    summaryPoints: uniqueNonEmpty(raw.summaryPoints || raw.summary_points || base.summaryPoints, 3),
    badges: uniqueNonEmpty(raw.badges || base.badges, 4),
    palette: raw.palette || base.palette,
    subjectHint: raw.subjectHint || raw.subject_hint || base.subjectHint
  };
}

function buildLlmPrompt(input = {}) {
  const goals = (input.learningGoals || []).join('、') || '掌握核心概念';
  return [
    '你是资深 K12 教研员。请把知识点拆成适合 60-90 秒教学动画的结构化 JSON。',
    '要求：',
    '1) 必须包含真实原理：definition、formula（可写文字公式）、conditions、examples、misconceptions。',
    '2) subconcepts 固定 5 项，按教材逻辑：定义→条件/过程→关系→例子→方法/易错。',
    '3) 每段 narration 30-50 字，口语化，像老师讲课；不直接念复杂符号。',
    '4) 有数字就给具体数字；没有也要给可记忆锚点。',
    '5) 不要空话套话，如“把复杂现象讲清楚”“注意条件变量结论”。',
    '6) 只输出 JSON，不要 markdown。',
    'JSON 字段：',
    '{',
    '  "definition": "...",',
    '  "formula": "...",',
    '  "formulaNote": "...",',
    '  "conditions": "...",',
    '  "keyNumbers": ["..."],',
    '  "examples": ["..."],',
    '  "misconceptions": ["..."],',
    '  "badges": ["...","...","...","..."],',
    '  "summaryPoints": ["...","...","..."],',
    '  "subconcepts": [',
    '    {"title":"","narration":"","visual":"","points":["",""],"formula":"","callout":""}',
    '  ]',
    '}',
    `主题：${input.topic}`,
    `学段：${mapGrade(input.grade)}`,
    `学科：${input.subject || '未指定'}`,
    `章节：${input.chapter || '未指定'}`,
    `学习目标：${goals}`,
    `风格备注：${input.styleNotes || '无'}`
  ].join('\n');
}

function llmConfigFromEnv() {
  const apiKey = process.env.LLM_API_KEY
    || process.env.OPENAI_API_KEY
    || process.env.STORYBOARD_LLM_API_KEY
    || '';
  const baseUrl = (process.env.LLM_BASE_URL
    || process.env.OPENAI_BASE_URL
    || process.env.STORYBOARD_LLM_BASE_URL
    || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL
    || process.env.OPENAI_MODEL
    || process.env.STORYBOARD_LLM_MODEL
    || 'gpt-4o-mini';
  const enabled = String(process.env.STORYBOARD_LLM_ENABLED || (apiKey ? 'true' : 'false')).toLowerCase() !== 'false';
  const timeoutMs = Math.max(3000, Number(process.env.STORYBOARD_LLM_TIMEOUT_MS || 25000));
  return { apiKey, baseUrl, model, enabled, timeoutMs };
}

export async function fetchKnowledgeFromLlm(input = {}, options = {}) {
  const cfg = { ...llmConfigFromEnv(), ...options };
  if (!cfg.enabled || !cfg.apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: '你输出严格 JSON，服务 K12 教学动画分镜。' },
          { role: 'user', content: buildLlmPrompt(input) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`LLM HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJsonObject(content);
    if (!parsed) throw new Error('LLM 返回无法解析为 JSON');
    return normalizeKnowledge({ ...parsed, source: 'llm' }, input);
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveKnowledge(input = {}, options = {}) {
  const preferPack = String(process.env.STORYBOARD_PREFER_KNOWLEDGE_PACK || 'true').toLowerCase() !== 'false';
  const pack = findKnowledgePack(input.topic);
  if (preferPack && pack) return normalizeKnowledge({ ...pack, source: 'knowledge_pack' }, input);

  try {
    const llm = await fetchKnowledgeFromLlm(input, options);
    if (llm) return llm;
  } catch (error) {
    if (options.throwOnLlmError) throw error;
    // fall through
  }
  return heuristicKnowledge(input);
}

export function knowledgeToStoryboard(input = {}, knowledge = {}, config = {}) {
  const topic = String(input.topic || knowledge.topic || '知识点').trim();
  const chapter = `${mapGrade(input.grade)} · ${input.chapter || '课程章节'}`;
  const voice = resolveVoice(input, config);
  const palette = resolvePalette(input, knowledge);
  const subs = (knowledge.subconcepts || []).slice(0, 5);
  while (subs.length < 5) {
    const idx = subs.length + 1;
    subs.push({
      title: `要点${idx}`,
      narration: `${topic}的第${idx}个关键点，需要结合定义和例子理解。`,
      visual: '示意图 + 要点卡片',
      points: [knowledge.definition || topic],
      formula: knowledge.formula || '',
      callout: '要点'
    });
  }

  const introHook = knowledge.examples?.[0]
    ? `先看一个现象：${clampText(knowledge.examples[0], 28)}`
    : `先从一个生活或实验问题出发`;
  const summaryNarration = knowledge.summaryPoints?.length
    ? `最后记住：${clampText(knowledge.summaryPoints.join('；'), 52)}`
    : `最后记住：${topic}要抓住定义、条件和典型例子。`;

  const segments = [
    {
      id: 1,
      title: '引入',
      narration: clampText(`同学们，今天我们学习${topic}。${introHook}${/。$/.test(introHook) ? '' : '。'}`, 58),
      visual: `主标题${topic} + 主题图标 + 子概念胶囊：${subs.map((s) => s.title).join(' / ')}`,
      transition: 'blur-crossfade',
      min_duration: 6,
      points: uniqueNonEmpty(subs.map((s) => s.title), 5),
      formula: '',
      callout: '引入'
    },
    ...subs.map((sub, index) => {
      const baseVisual = String(sub.visual || '').trim();
      const visual = baseVisual.length >= 8
        ? baseVisual
        : `${sub.title || '要点'}示意图 + 信息卡 + 关键标注`;
      return {
      id: index + 2,
      title: clampText(sub.title, 12),
      narration: clampText(sub.narration, 60),
      visual: clampText(visual, 140),
      transition: index === 3 ? 'push-up' : 'blur-crossfade',
      points: uniqueNonEmpty(sub.points || [], 3),
      formula: clampText(sub.formula || '', 40),
      callout: clampText(sub.callout || sub.title, 12)
    };
    }),
    {
      id: 7,
      title: '总结',
      narration: clampText(summaryNarration, 60),
      visual: `大数字/公式 ${knowledge.formula || topic} + 本章小结 + 徽章`,
      transition: 'push-up',
      min_duration: 8,
      points: uniqueNonEmpty(knowledge.summaryPoints || knowledge.examples || [], 3),
      formula: clampText(knowledge.formula || '', 40),
      callout: '总结'
    }
  ];

  return {
    topic,
    topic_slug: slugify(topic),
    chapter,
    palette,
    voice,
    knowledge: {
      source: knowledge.source || 'unknown',
      definition: knowledge.definition || '',
      formula: knowledge.formula || '',
      formulaNote: knowledge.formulaNote || '',
      conditions: knowledge.conditions || '',
      examples: knowledge.examples || [],
      misconceptions: knowledge.misconceptions || [],
      keyNumbers: knowledge.keyNumbers || [],
      badges: knowledge.badges || [],
      summaryPoints: knowledge.summaryPoints || []
    },
    segments
  };
}

export function validateStoryboardQuality(storyboard = {}) {
  const errors = [];
  const warnings = [];
  const segments = storyboard.segments || [];
  const knowledge = storyboard.knowledge || {};
  const allNarration = segments.map((s) => s.narration || '').join('\n');
  const allPoints = segments.flatMap((s) => s.points || []);
  const corpus = [
    knowledge.definition,
    knowledge.formula,
    knowledge.conditions,
    ...(knowledge.examples || []),
    ...(knowledge.misconceptions || []),
    allNarration,
    ...allPoints
  ].join('\n');

  if (segments.length !== 7) errors.push(`segments 数量应为 7，实际 ${segments.length}`);

  for (const [index, segment] of segments.entries()) {
    if (!segment?.title) errors.push(`第 ${index + 1} 段缺少 title`);
    if (!segment?.narration || String(segment.narration).trim().length < 12) {
      errors.push(`第 ${index + 1} 段旁白过短或为空`);
    }
    if (!segment?.visual || String(segment.visual).trim().length < 8) {
      errors.push(`第 ${index + 1} 段 visual 过短或为空`);
    }
    for (const pattern of GENERIC_BAD_PATTERNS) {
      if (pattern.test(segment?.narration || '')) {
        errors.push(`第 ${index + 1} 段旁白像空模板：命中「${pattern}」`);
      }
    }
  }

  const hasDefinition = Boolean(String(knowledge.definition || '').trim())
    || /定义|是指|是指|是指|不生不灭|产生|等于|定律|定理|守恒|振动/.test(corpus);
  const hasFormulaOrNumber = Boolean(String(knowledge.formula || '').trim())
    || /[=＝]|m\/s|²|₂|公式|守恒|定理|定律|\d/.test(corpus);
  const hasExample = (knowledge.examples || []).length > 0
    || /例如|比如|滚摆|实验|生活|音叉|发电|三角形/.test(corpus);
  const hasConditionOrMisconception = Boolean(String(knowledge.conditions || '').trim())
    || (knowledge.misconceptions || []).length > 0
    || /条件|注意|不要|易错|只有|必须|真空|摩擦/.test(corpus);

  if (!hasDefinition) errors.push('缺少定义/原理表述');
  if (!hasFormulaOrNumber) errors.push('缺少公式或关键数字/记忆锚点');
  if (!hasExample) errors.push('缺少具体例子');
  if (!hasConditionOrMisconception) warnings.push('建议补充成立条件或易错点');

  if (String(storyboard.palette || '').toLowerCase() === 'history') {
    if (knowledge.source === 'heuristic') {
      errors.push('历史主题不能使用通用 heuristic 分镜，请补充专用知识包或启用 LLM');
    }
    const historyCorpus = [
      allNarration,
      ...allPoints,
      ...segments.map((segment) => segment?.visual || '')
    ].join('\n');
    for (const pattern of HISTORY_GENERIC_BAD_PATTERNS) {
      if (pattern.test(historyCorpus)) {
        errors.push(`历史分镜像理科模板：命中「${pattern}」`);
      }
    }
  }

  // mid segments should carry concrete points for HTML cards
  for (let i = 1; i <= 5; i += 1) {
    const seg = segments[i];
    const points = seg?.points || [];
    if (!points.length) warnings.push(`第 ${i + 1} 段缺少 points，画面卡片会偏空`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      hasDefinition,
      hasFormulaOrNumber,
      hasExample,
      hasConditionOrMisconception,
      segmentCount: segments.length
    }
  };
}

export function assertStoryboardQuality(storyboard, { strict = true } = {}) {
  const result = validateStoryboardQuality(storyboard);
  if (!result.ok && strict) {
    const err = new Error(`分镜质量门禁未通过：${result.errors.join('；')}`);
    err.code = 'STORYBOARD_QUALITY_GATE';
    err.details = result;
    throw err;
  }
  return result;
}

/** 同步模板构建（兼容旧调用）；内容仍尽量走本地知识包，避免空壳。 */
export function buildStoryboard(input = {}, config = {}) {
  const knowledge = heuristicKnowledge(input);
  const storyboard = knowledgeToStoryboard(input, knowledge, config);
  // 同步路径默认不硬失败，交给异步路径做严格门禁
  return storyboard;
}

export async function buildKnowledgeStoryboard(input = {}, config = {}, options = {}) {
  const knowledge = await resolveKnowledge(input, options);
  const storyboard = knowledgeToStoryboard(input, knowledge, config);
  const quality = assertStoryboardQuality(storyboard, { strict: options.strict !== false });
  return { storyboard, knowledge, quality };
}

export function fillTeachingIndexHtml(html, storyboard = {}, input = {}) {
  if (!html) return html;
  const segments = storyboard.segments || [];
  const knowledge = storyboard.knowledge || {};
  const topic = storyboard.topic || input.topic || '知识点';
  const escape = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  let out = html;

  // Scene 1 tagline / subtitle
  out = out.replace(/——\s*TODO:\s*副标题\s*——/g, `—— ${escape(input.chapter || knowledge.formulaNote || 'K12 教学动画')} ——`);
  out = out.replace(/TODO:\s*副标题/g, escape(input.chapter || knowledge.formulaNote || 'K12 教学动画'));

  // Scene 7 hero formula / note
  const formula = knowledge.formula || segments[6]?.formula || topic;
  const formulaNote = knowledge.formulaNote || knowledge.conditions || '关键记忆锚点';
  out = out.replace(/TODO 大数字\/公式/g, escape(formula));
  out = out.replace(/TODO 注释/g, escape(clampText(formulaNote, 36)));

  // Summary card points (first occurrence group for s7)
  const summaryPoints = uniqueNonEmpty(
    knowledge.summaryPoints?.length
      ? knowledge.summaryPoints
      : [
        knowledge.definition,
        ...(knowledge.examples || []),
        ...(knowledge.misconceptions || [])
      ],
    3
  );
  while (summaryPoints.length < 3) summaryPoints.push(`${topic}：抓住定义与条件`);
  out = out.replace(
    /<div class="card-body">\s*<p>TODO 要点一<\/p>\s*<p>TODO 要点二<\/p>\s*<p>TODO 要点三<\/p>\s*<\/div>/,
    `<div class="card-body">
            <p>${escape(summaryPoints[0])}</p>
            <p>${escape(summaryPoints[1])}</p>
            <p>${escape(summaryPoints[2])}</p>
          </div>`
  );

  // Mid-scene cards: replace each remaining TODO pair sequentially with segment points
  for (let sceneId = 2; sceneId <= 6; sceneId += 1) {
    const seg = segments[sceneId - 1] || {};
    const points = uniqueNonEmpty(seg.points || [], 2);
    while (points.length < 2) points.push(clampText(seg.narration || topic, 24));
    const formulaLine = seg.formula ? `<div class="formula">${escape(seg.formula)}</div>` : '';
    out = out.replace(
      /<div class="card-body">\s*<p>TODO 要点一<\/p>\s*<p>TODO 要点二<\/p>\s*<\/div>/,
      `<div class="card-body">
              <p>${escape(points[0])}</p>
              <p>${escape(points[1])}</p>
              ${formulaLine}
            </div>`
    );
  }

  // Badges on summary bar
  const badges = uniqueNonEmpty(knowledge.badges || segments.slice(1, 5).map((s) => s.title), 4);
  while (badges.length < 4) badges.push(topic.slice(0, 4) || '要点');
  let badgeIndex = 0;
  out = out.replace(/<div class="badge"><div class="icon">\?<\/div><div class="name">TODO<\/div><\/div>/g, () => {
    const name = escape(clampText(badges[badgeIndex] || '要点', 6));
    const icon = escape(String(badges[badgeIndex] || '★').trim().slice(0, 1) || '★');
    badgeIndex += 1;
    return `<div class="badge"><div class="icon">${icon}</div><div class="name">${name}</div></div>`;
  });

  // diagram TODO comments → inject compact visual callout text for authoring/debug visibility
  out = out.replace(
    /<!-- TODO: 按上方 visual 描述画示意图[\s\S]*?-->/g,
    (match, offset) => {
      // determine nearest scene id by looking backward
      const head = out.slice(Math.max(0, offset - 400), offset);
      const m = head.match(/id="s(\d)"/g);
      const last = m?.[m.length - 1];
      const sceneNo = last ? Number(last.replace(/\D/g, '')) : 0;
      const seg = segments[sceneNo - 1] || {};
      const visual = escape(clampText(seg.visual || knowledge.definition || topic, 80));
      const callout = escape(clampText(seg.callout || seg.title || '要点', 12));
      return `<!-- visual: ${visual} -->
            <div class="callout" style="max-width: 90%; font-size: 28px; line-height: 1.4;">${callout}<br/>${visual}</div>`;
    }
  );

  // leftover TODOs
  out = out.replaceAll('TODO 要点一', escape(`${topic}：${clampText(knowledge.definition || '抓住定义', 20)}`));
  out = out.replaceAll('TODO 要点二', escape(clampText(knowledge.conditions || knowledge.examples?.[0] || '关注条件与例子', 24)));
  out = out.replaceAll('TODO 要点三', escape(clampText(knowledge.misconceptions?.[0] || knowledge.summaryPoints?.[0] || '避免常见误解', 24)));
  out = out.replaceAll('TODO 大数字/公式', escape(formula));
  out = out.replaceAll('TODO 注释', escape(clampText(formulaNote, 36)));
  out = out.replaceAll('TODO', escape(topic));

  return out;
}

export default {
  buildStoryboard,
  buildKnowledgeStoryboard,
  validateStoryboardQuality,
  assertStoryboardQuality,
  fillTeachingIndexHtml,
  findKnowledgePack,
  resolveKnowledge,
  knowledgeToStoryboard
};
