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


### user_model_settings（已实现）

用户级模型偏好。详见 `docs/user-model-settings.md`。

| 字段 | 说明 |
|------|------|
| user_id | PK |
| tts_provider / tts_voice / tts_speed / tts_enabled | TTS 偏好 |
| image_provider / image_style / image_aspect_ratio / image_enabled | 文生图偏好 |
| video_provider / video_quality / video_fps / preferred_output_profile / video_enabled | 文生视频/渲染偏好 |
| extra_json | 扩展；当前保存 `providerCredentials`（用户 provider 的 API URL、模型名及凭证） |
| created_at / updated_at | |

`generation_jobs.input_json` 已写入 `modelSnapshot`，固化本次实际使用的 provider、音色/模型和质量档位；同时保存 `textbookEdition`、`classroomScenario`、`lowBandwidth` 等乡村课堂参数。任务输入不保存明文 provider 凭证。

> 安全边界：用户模型设置中的 `providerCredentials` 当前位于 MySQL `extra_json`（memory 模式位于本地 JSON 状态），API 响应只返回掩码后的 API Key。生产环境应进一步使用 KMS 或应用层加密保护该字段。

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


### rural_pilot_evidence_records

真实乡村课堂试点证据表，同时支持 MySQL 与 memory JSON 模式。

| 字段组 | 字段 | 说明 |
|---|---|---|
| 基本信息 | `created_by`, `school_name`, `region`, `teacher_name`, `class_name` | 创建教师与试点现场；公开材料需脱敏 |
| 教学信息 | `grade_code`, `subject_code`, `textbook_edition`, `topic`, `course_id`, `job_id` | 可关联已有课程与生成任务 |
| 备课效率 | `prep_before_minutes`, `prep_after_minutes` | 使用平台前后备课耗时 |
| 学习效果 | `pre_quiz_total`, `pre_quiz_correct`, `post_quiz_total`, `post_quiz_correct` | 匿名汇总小题统计，不记录学生个人信息 |
| 教师评价 | `teacher_accuracy_score`, `teacher_usefulness_score`, `teacher_feedback` | 1–5 分评价与文字反馈 |
| 网络现场 | `network_mode`, `offline_downloaded`, `offline_played`, `playback_duration_sec`, `playback_interruption_count`, `incident_note` | 在线、弱网和离线播放证据 |
| 合规状态 | `consent_confirmed`, `status`, `submitted_at`, `verified_at` | 授权确认与草稿/提交/复核流程 |

状态机：`draft` → `submitted` → `verified`。汇总只使用 `submitted`、`verified` 记录，并且正确率分母必须大于 0；无有效样本时返回 `null`。
