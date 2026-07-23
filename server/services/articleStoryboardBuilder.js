const THEMES = new Set(['warm', 'midnight']);

function pickLayout(index, group) {
  // Avoid illustration layout in auto builder so scaffold/render can proceed without PNG gen.
  // grid needs panels; statement is good for emphasis chapters.
  if (group.length >= 2) return 'grid';
  return 'statement';
}

function buildPanels(group, topic) {
  const source = group.length ? group : [`理解${topic}的关键要点`];
  return source.slice(0, 4).map((text, index) => ({
    title: `要点 ${index + 1}`.slice(0, 8),
    desc: String(text).replace(/\s+/g, ' ').slice(0, 20),
    at: 0
  }));
}

export function buildArticleStoryboard(input, config = {}) {
  const article = String(input.article || '').trim();
  if (!article) throw new Error('article_explainer_video 需要 article 原文');

  const paragraphs = article
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\n{2,}|(?<=[。！？!?])\s+/)
    .map(text => text.replace(/^#{1,6}\s+/, '').trim())
    .filter(text => text.length >= 8)
    .slice(0, 60);

  if (!paragraphs.length) throw new Error('article 原文无法拆分为有效章节');

  // Keep chapter count realistic for short articles (avoid empty filler chapters).
  const chapterCount = Math.min(8, Math.max(3, paragraphs.length));
  const groups = Array.from({ length: chapterCount }, () => []);
  paragraphs.forEach((paragraph, index) => {
    groups[Math.min(chapterCount - 1, Math.floor(index * chapterCount / paragraphs.length))].push(paragraph);
  });
  const filledGroups = groups.filter(group => group.length > 0);
  const topic = input.topic || paragraphs[0].slice(0, 28);
  const theme = THEMES.has(input.theme) ? input.theme : 'warm';

  return {
    title: topic,
    subtitle: input.chapter || '文章章节解说',
    theme,
    voice: {
      provider: config.default_tts_provider || process.env.DEFAULT_TTS_PROVIDER || 'edge',
      voice_id: config.default_edge_voice || process.env.DEFAULT_EDGE_VOICE || 'zh-CN-XiaoxiaoNeural',
      edge_voice_id: config.default_edge_voice || process.env.DEFAULT_EDGE_VOICE || 'zh-CN-XiaoxiaoNeural',
      speed: 1
    },
    chapters: filledGroups.map((group, index) => {
      const narration = group.slice(0, 5);
      const layout = pickLayout(index, group);
      const chapter = {
        id: index + 1,
        kicker: index === 0 ? '开篇' : `第 ${index + 1} 章`,
        headline: (group[0] || topic).slice(0, 30),
        subhead: (group[1] || `理解${topic}的第 ${index + 1} 个关键层次`).slice(0, 52),
        layout,
        tags: [input.subject || '知识', input.grade || '通识'].filter(Boolean),
        narration
      };

      if (layout === 'grid') {
        chapter.panels = buildPanels(group, topic);
      } else if (layout === 'statement') {
        chapter.statement = {
          text: (group[0] || topic).slice(0, 48)
        };
      } else {
        chapter.cards = group.slice(1, 4).map((text, cardIndex) => ({
          title: `要点 ${cardIndex + 1}`,
          body: text.slice(0, 72)
        }));
        chapter.illustration = {
          id: `ch-${String(index + 1).padStart(2, '0')}`,
          brief: `围绕“${(group[0] || topic).slice(0, 80)}”绘制清晰的教育概念图，不添加未经原文支持的事实。`
        };
      }
      return chapter;
    })
  };
}

export default { buildArticleStoryboard };
