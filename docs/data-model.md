# 数据模型

## ER 概览

```text
users 1──* generation_jobs
users 1──* courses
users 1──1 user_model_settings
courses 1──* course_assets
courses 1──* course_reviews
system_config (kv)
```

## 表设计

### users
| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(32) PK | |
| email | varchar(128) unique | |
| password_hash | varchar(128) | |
| nickname | varchar(64) | |
| role | enum('student','teacher','admin') | 历史 `user` 启动时迁移为 `student` |
| status | enum('active','disabled') | |
| teacher_subjects_json | JSON 数组 | 教师授课学科 code 列表；学生/管理员为空 |
| grade_code | varchar nullable | 学生年级（可选） |
| created_at | datetime | |

### categories（首期未单独建表）
首期由 `/api/catalog/categories` 返回内置字典；后续再迁移为学科分类树。

| 字段 | 说明 |
|------|------|
| id | |
| parent_id | 可空 |
| subject_code | physics/math/... |
| grade_code | grade7/grade8/... |
| name | 展示名 |
| sort_order | |

预置示例：

- 物理 / 初二 / 机械能与能量
- 生物 / 初一 / 光合作用
- 数学 / 初二 / 勾股定理

### generation_jobs
| 字段 | 说明 |
|------|------|
| id | jobId |
| user_id | |
| status | queued/running/succeeded/failed/cancelled |
| output_profile | teaching_video_full/... |
| input_json | 完整输入快照 |
| progress | 0-100 |
| current_stage | storyboard/tts/scaffold/render/upload |
| work_dir | 本地工作区 |
| result_course_id | 成功后关联 |
| error_message | |
| started_at / finished_at | |
| created_at | |

### job_events（后续项）
任务日志表尚未落地；当前阶段和最后错误保存在 `generation_jobs`。

### courses
| 字段 | 说明 |
|------|------|
| id | |
| user_id | 作者 |
| category_id | |
| title | |
| topic | 知识点 |
| summary | |
| visibility | private/public |
| publish_status | draft/pending/approved/rejected |
| cover_url | |
| video_url | |
| duration_sec | |
| view_count | |
| like_count | |
| author_role_snapshot | 送审时作者角色 student/teacher |
| source_job_id | |
| tags_json | |
| created_at / updated_at | |

### course_assets
一个课程可挂多产物。

| type | 示例 |
|------|------|
| video_mp4 | energy-conservation.mp4 |
| cover_png | 3:4 封面 |
| infographic_png | 9:16 |
| storyboard_json | |
| timeline_json | |
| montage_png | |

### course_reviews
审核记录：审核人、审核人角色、动作、意见、学科范围快照、时间。教师/管理员审核均写入。


### user_model_settings（规划中）

用户级模型偏好。详见 `docs/user-model-settings.md`。

| 字段 | 说明 |
|------|------|
| user_id | PK |
| tts_provider / tts_voice / tts_speed / tts_enabled | TTS 偏好 |
| image_provider / image_style / image_aspect_ratio / image_enabled | 文生图偏好 |
| video_provider / video_quality / video_fps / preferred_output_profile / video_enabled | 文生视频/渲染偏好 |
| extra_json | 扩展 |
| created_at / updated_at | |

`generation_jobs.input_json` 将增加 `modelSnapshot` 固化本次实际模型。

### system_config
KV：默认 provider、并发、skill 路径、是否自动送审、模型 allowlist、默认 video provider/quality 等。详见 `docs/user-model-settings.md`。

## 状态机

### Job
`queued → running → succeeded|failed`  
`running → cancelled`（尽力取消）  
`failed → queued`（重试）

### Course publish
`draft → pending → approved|rejected`  
`approved → rejected`（下架）

### subjects
学科大类目录（管理后台可维护）。

| 字段 | 说明 |
|------|------|
| code | 主键，如 physics / chinese |
| name | 显示名 |
| sort_order | 排序 |
| enabled | 是否启用 |
| created_at / updated_at | |

### knowledge_points
学科下知识点/章节主题目录。

| 字段 | 说明 |
|------|------|
| id | 主键 |
| subject_code | 所属学科 |
| grade_code | 可选年级 |
| chapter | 章节 |
| topic | 知识点 / 课程主题 |
| summary | 摘要 |
| keywords_json | 关键词数组 |
| sort_order | 排序 |
| enabled | 是否启用 |
| source | seed / manual |
| created_at / updated_at | |

生成页通过 `/api/catalog/subjects`、`/api/catalog/categories`、`/api/catalog/knowledge-points` 读取；管理员通过 `/api/admin/subjects` 与 `/api/admin/knowledge-points` CRUD。

### knowledge_points 扩展字段
| 字段 | 说明 |
|------|------|
| learning_goals_json | 学习目标数组 |
| animation_pack | 关联动画包 code（energy/light/force/...） |
| pack_key | 对应 KNOWLEDGE_PACKS 键（同步用） |

管理端支持 `POST /api/admin/knowledge-points/sync` 一键从 `KNOWLEDGE_PACKS` 同步。
