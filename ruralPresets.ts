export const RURAL_LESSON_PRESETS = [
  {
    id: 'energy', title: '八年级物理：能量守恒',
    description: '用山路骑行、水电站和摩擦发热连接乡村生活经验。',
    form: {
      subject: 'physics', grade: 'grade8', chapter: '机械能与能量', topic: '能量守恒定律',
      learningGoals: ['理解能量转化与转移', '区分机械能守恒与能量守恒'],
      textbookEdition: '人教版', classroomScenario: 'in-class', lowBandwidth: true,
      styleNotes: '面向乡村八年级课堂，结合山路骑行、水电站和摩擦发热，短句讲解，预留教师暂停提问点。',
      outputProfile: 'teaching_video_full', style: 'whiteboard-sketch', videoQuality: 'draft'
    }
  },
  {
    id: 'pythagorean', title: '八年级数学：勾股定理',
    description: '用测量操场、屋架和田地直角距离设计课堂任务。',
    form: {
      subject: 'math', grade: 'grade8', chapter: '勾股定理', topic: '勾股定理',
      learningGoals: ['理解直角三角形三边关系', '能在实际测量中使用勾股定理'],
      textbookEdition: '人教版', classroomScenario: 'lesson-prep', lowBandwidth: true,
      styleNotes: '面向乡村课堂备课，结合操场测量、屋架和田地距离，安排板书公式与一道随堂题。',
      outputProfile: 'teaching_video_full', style: 'notebook', videoQuality: 'draft'
    }
  },
  {
    id: 'poetry', title: '七年级语文：诗词意象',
    description: '从月亮、炊烟、归雁等熟悉景物进入诗词理解。',
    form: {
      subject: 'chinese', grade: 'grade7', chapter: '古诗词阅读', topic: '诗词意象',
      learningGoals: ['识别常见意象', '结合语境体会诗歌情感'],
      textbookEdition: '部编版', classroomScenario: 'review', lowBandwidth: true,
      styleNotes: '面向乡村七年级复习课，从月亮、炊烟、归雁等熟悉景物切入，减少抽象术语，增加朗读停顿提示。',
      outputProfile: 'teaching_video_full', style: 'cozy-handdrawn', videoQuality: 'draft'
    }
  }
] as const;
