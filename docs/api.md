# API 设计

Base: `http://localhost:3002/api`（经 Nginx 时为 `http://localhost:3000/api`）

鉴权：`Authorization: Bearer <sessionToken>`

## Auth
- `POST /auth/register` body: `{ email, password, nickname, role: "student"|"teacher", grade?, teacherSubjects? }`（禁止 admin；教师学科必填 ≥1；无邀请码）
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me` → `{ user: { id,email,nickname,role,status,teacherSubjects,grade } }`
- `PATCH /me/profile` body: `{ nickname?, teacherSubjects?, grade? }`（教师自改学科须 ≥1）
- `GET /me/model-settings` 我的模型设置 + effective/systemDefaults
- `PUT /me/model-settings` 更新 TTS/文生图/文生视频偏好
- `POST /me/model-settings/reset` 恢复系统默认
- `GET /models/catalog` 可用模型目录（按角色与平台 Key 过滤）

## Catalog（公开）
- `GET /catalog/subjects` 学科大类（chinese/math/english/physics/...）
- `GET /catalog/grades` 年级字典（`grade1`–`grade12`，含小学/初中/高中）
- `GET /catalog/categories?subject=&grade=&q=` 章节聚合（来自知识点表）
- `GET /catalog/knowledge-points?subject=&grade=&chapter=&q=&limit=` 知识点检索（生成页下拉/搜索）
- `GET /catalog/knowledge-points/:id` 单条知识点
- `GET /catalog/animation-packs` 动画包列表（energy/sound/math/light/...）

## Jobs（生成）
### 创建任务
`POST /jobs`

```json
{
  "subject": "physics",
  "grade": "grade8",
  "chapter": "机械能与能量",
  "topic": "能量守恒定律",
  "learningGoals": ["理解能量守恒"],
  "outputProfile": "package_all",
  "styleNotes": "口语化，适合暑假复习",
  "style": "cozy-handdrawn",
  "imageProvider": "volcengine",
  "ttsProvider": "edge",
  "ttsVoice": "zh-CN-XiaoxiaoNeural",
  "videoProvider": "hyperframes",
  "videoQuality": "draft",
  "article": "文章型档位使用的 Markdown 原文",
  "autoCreateCourse": true
}
```

响应：

```json
{ "jobId": "job_xxx", "status": "queued" }
```

### 查询
- `GET /jobs/:id`
- `GET /jobs?status=&page=`
- `POST /jobs/:id/retry`
- `POST /jobs/:id/cancel`
- `GET /jobs/:id/assets`

进度示例：

```json
{
  "id": "job_xxx",
  "status": "running",
  "progress": 62,
  "currentStage": "render",
  "stages": [
    {"name": "storyboard", "status": "done"},
    {"name": "tts", "status": "done"},
    {"name": "scaffold", "status": "done"},
    {"name": "render", "status": "running"},
    {"name": "package", "status": "pending"}
  ]
}
```

## Courses
- `GET /courses` 广场（仅 approved+public，支持 `subject`、`grade`、`q`）
- `GET /courses/:id`
- `GET /courses/:id/assets`
- `GET /me/courses`（含 `latestReview`）
- `GET /courses/:id/reviews` 作者/管理员查看审核历史
- `PATCH /courses/:id` 改标题/摘要/分类
- `POST /courses/:id/submit` 送审（写入 `author_role_snapshot`；响应含 `reviewRouting`: subject_teacher|admin_fallback|admin_only）
收藏/点赞接口暂未实现，列入后续版本。

输出档位：`image_generation`、`infographic_only`、`teaching_video_full`、`package_all`、`tech_article_diagram`、`article_explainer_video`、`short_video_cover`。

筛选：`?subject=physics&grade=grade8&q=能量`

## Teacher review
- `GET /teacher/reviews/pending?subject=&grade=&q=&page=`  仅本学科学生 pending
- `GET /teacher/reviews/done?page=`  本人审核记录
- `GET /teacher/courses/:id`  无权限统一 404
- `POST /teacher/courses/:id/review` `{ "action":"approve|reject", "comment":"..." }`（驳回意见必填）

## Admin
- `GET /admin/users?role=&status=&q=&page=` 用户列表
- `PATCH /admin/users/:id` `{ nickname?, role?, status?, teacherSubjects?, grade? }`（不可禁用/降权自己；教师学科≥1）
- `GET /admin/stats`
- `GET /admin/jobs`
- `GET /admin/courses?publishStatus=pending`  全量（含教师作品、无对口教师学生作品）；项含 `needsAdminFallback`
- `POST /admin/courses/:id/review` `{ "action":"approve|reject", "comment":"..." }`
- `DELETE /admin/courses/:id` 管理员删除课程（广场/库内）；非管理员调用 `DELETE /courses/:id` 返回 403
- `GET/PUT /admin/config`

### 学科与知识点管理（admin）
- `GET /admin/subjects` 含停用学科
- `POST /admin/subjects` body: `{ code, name, sortOrder?, enabled? }`
- `PATCH /admin/subjects/:code`
- `GET /admin/knowledge-points?subject=&grade=&chapter=&q=&limit=`
- `POST /admin/knowledge-points` body:
  ```json
  {
    "subjectCode": "chinese",
    "gradeCode": "grade7",
    "chapter": "现代文阅读",
    "topic": "记叙文六要素",
    "summary": "...",
    "keywords": ["记叙文", "六要素"],
    "learningGoals": ["能找出六要素"],
    "animationPack": "generic",
    "packKey": "optional-unique-key",
    "sortOrder": 10,
    "enabled": true
  }
  ```
- `PATCH /admin/knowledge-points/:id`
- `DELETE /admin/knowledge-points/:id`

### 知识点批量同步（admin）
| 接口 | 说明 |
|------|------|
| `POST /admin/knowledge-points/sync` | 从 `KNOWLEDGE_PACKS` 同步动画知识包（章节/主题/摘要/关键词/学习目标/动画包） |
| `POST /admin/knowledge-points/sync-chemaiforge` | 同步 ChemAIForge 化学实验 102 条 |
| `POST /admin/knowledge-points/sync-junior-chinese` | 同步初中语文知识库 |
| `POST /admin/knowledge-points/sync-junior-english` | 同步初中英语知识库 |
| `POST /admin/knowledge-points/sync-junior-history` | 同步初中历史知识库 |
| `POST /admin/knowledge-points/sync-junior-geography` | 同步初中地理知识库 |
| `POST /admin/knowledge-points/sync-junior-politics` | 同步初中政治/道德与法治知识库 |

body 统一：`{ "overwrite": true }`  
响应：`{ total, created, updated, skipped, items[] }`  
幂等键优先 `pack_key`，否则 `subject_code + topic`（部分同步还匹配 chapter）。

## Assets
- 媒体访问：`GET /media/:id?expires=&sig=`（签名 URL）
- 兼容旧路径：`/uploads/...`（若配置）

## Health
- `GET /health`

## 前端菜单对应
- 管理后台：用户/待审/系统模型默认
- **学科与知识点**（独立左侧菜单，仅 admin）：左右分栏维护 + 一键同步按钮
