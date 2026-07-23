# 学科与知识点目录

> 更新日期：2026-07-22  
> 目标：让生成页可选择/搜索章节与知识点，管理员可维护并一键同步批量知识库。

## 1. 能力概览

1. **学科大类**：语文、数学、英语、物理、化学、生物、地理、历史、政治。
2. **知识点子类**：章节 + 主题 + 摘要 + 关键词 + 学习目标 + 关联动画包 + 年级。
3. **生成页**：`KnowledgeSelector` 支持学科/年级级联、章节选择、关键字搜索填入。
4. **管理页**：左侧菜单「学科与知识点」独立页面（避免塞进管理后台导致过长）。
5. **批量同步**：动画知识包 / ChemAIForge 化学 / 初中语数外史地政等一键入库。

## 2. 数据表

### subjects
| 字段 | 说明 |
|------|------|
| code | 主键，如 `physics` |
| name | 显示名 |
| sort_order | 排序 |
| enabled | 是否启用 |

### knowledge_points
| 字段 | 说明 |
|------|------|
| id | 主键 |
| subject_code | 学科 |
| grade_code | `grade1`–`grade12`，可空 |
| chapter | 章节 |
| topic | 知识点名称 |
| summary | 摘要 |
| keywords_json | 关键词数组 |
| learning_goals_json | 学习目标数组 |
| animation_pack | 动画包 code |
| pack_key | 同步幂等键（如 `chemaiforge:slug`、`junior-chinese:grade7:记叙文六要素`） |
| sort_order / enabled / source | 排序、启用、来源（seed/manual/knowledge_pack/chemaiforge/junior_*） |

实现位置：
- Schema/CRUD：`server/db.js`
- 规范化与种子加载：`server/services/knowledgeCatalog.js`
- 动画包元数据：`PACK_META` + `storyboardBuilder.KNOWLEDGE_PACKS`

## 3. 年级字典

| code | 名称 |
|------|------|
| grade1–grade6 | 一至六年级 |
| grade7–grade9 | 初一至初三 |
| grade10–grade12 | 高一至高三 |

注册/学生资料校验使用 `server/services/rbac.js` 的 `GRADE_CODES`；公开接口 `GET /api/catalog/grades` 返回完整小学–高中列表。

## 4. 已内置批量知识库

| 来源 | 学科 | 规模（约） | 种子文件 / 同步接口 |
|------|------|------------|---------------------|
| 动画知识包 KNOWLEDGE_PACKS | 多学科 | 20+ | `POST .../sync` |
| mathviz 入门+基础 | 数学 | 14 | 写入 catalog 种子；可在管理端维护 |
| ChemAIForge 102 实验 | 化学 | 102 | `server/data/chemaiforge-knowledge-points.json` → `sync-chemaiforge` |
| 初中语文 | 语文 | 65 | `server/data/junior-chinese-knowledge-points.json` → `sync-junior-chinese` |
| 初中英语 | 英语 | 52 | `server/data/junior-english-knowledge-points.json` → `sync-junior-english` |
| 初中历史 | 历史 | 32 | `server/data/junior-history-knowledge-points.json` → `sync-junior-history` |
| 初中地理 | 地理 | 26 | `server/data/junior-geography-knowledge-points.json` → `sync-junior-geography` |
| 初中政治/道德与法治 | 政治 | 28 | `server/data/junior-politics-knowledge-points.json` → `sync-junior-politics` |

> 数量以管理端实际列表为准；同步接口支持 `overwrite=true` 幂等更新。

## 5. 管理端交互（2026-07-22 重排）

- 布局：**左列表 + 右固定编辑表单**（sticky）。
- 点「编辑」：右侧填入表单、列表项高亮「编辑中」、状态提示「正在编辑：xxx」。
- 学科大类维护默认折叠，减少首屏高度。
- 同步按钮：动画知识包 / ChemAIForge 化学 / 初中语文 / 初中英语 / 初中历史 / 初中地理 / 初中政治。

## 6. 与生成链路关系

1. 用户在生成页选择知识点 → 填入 `subject/grade/chapter/topic/learningGoals`。
2. Pipeline `buildStoryboard` 优先用知识包/目录信息做知识驱动分镜。
3. `animation_pack` / `detectFamily` 影响场景动画零件装配（光/力/电/化学/地理/历史等）。

## 7. 运维注意

1. Compose 镜像**不 bind-mount** `server/`：改后端后需 `docker compose --env-file .env.compose up -d --build api worker`，或开发期 `docker cp` + `docker restart atv-api`。
2. 前端静态资源来自 `./dist`：改 `App.tsx` 后执行 `npm run build`。
3. MySQL `LIMIT ?` 在部分驱动下会报错，列表查询对 limit 使用校验后的整型插值。
4. 演示管理员：`teacher@demo.local` / `demo123`（角色 admin）。
