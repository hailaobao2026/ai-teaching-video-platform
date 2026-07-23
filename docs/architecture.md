# 系统架构

## 1. 总体架构

```text
┌────────────────────────────────────────────────────────────┐
│                     Web Client (React/Vite)                 │
│  创建课程 / 任务中心 / 课程广场 / 播放器 / 管理后台 / 学科知识点 │
└───────────────────────────┬────────────────────────────────┘
                            │ REST JSON
┌───────────────────────────▼────────────────────────────────┐
│                 API Server (Express, Node)                  │
│  Auth · Course · Job · Catalog · Admin · Upload             │
└───────────────┬─────────────────────────────┬──────────────┘
                │                             │
        ┌───────▼────────┐            ┌───────▼────────┐
        │   MySQL 8      │            │  Object Storage │
        │ users/jobs/... │            │ mp4/png/json   │
        └────────────────┘            └───────▲────────┘
                                              │
┌─────────────────────────────────────────────┴──────────────┐
│                 Generation Worker (Node)                    │
│  拉取 queued job → 调用 ai-teaching-media pipeline          │
│  → 写进度 → 上传产物 → 回写 success/failed                   │
└───────────────────────────┬────────────────────────────────┘
                            │ child_process / local FS
┌───────────────────────────▼────────────────────────────────┐
│              ai-teaching-media skill (本地)                 │
│  storyboard → Edge/Minimax TTS → scaffold index.html        │
│  → HyperFrames render → mp4                                 │
│  可选: Agnes 信息图/封面                                     │
└────────────────────────────────────────────────────────────┘
```

## 2. 为什么异步 Job + Worker

教学视频生成通常 2–10 分钟（TTS + HyperFrames 逐帧渲染），不能放在同步 HTTP 请求里。

流程：

1. 用户提交创建请求 → API 写入 `generation_jobs(status=queued)`
2. Worker 抢占任务 `queued → running`
3. Worker 在 `ARTIFACTS_ROOT/<jobId>/` 建工作区
4. 执行 pipeline 各阶段，更新 `progress` / `current_stage`
5. 成功：登记 `course_assets`，可选自动创建 `courses(draft)`
6. 失败：记录 `error_message`，支持重试

## 3. 模块划分

### 前端（对齐 genai-craft）

- 单页应用 `App.tsx` 多视图切换
- `services/*Service.ts` 调后端
- 播放器用原生 `<video>` + 封面图

### 后端 API

| 模块 | 职责 |
|------|------|
| auth | 注册登录会话 |
| courses | 课程 CRUD、发布、分类筛选 |
| jobs | 创建生成任务、查进度、取消/重试 |
| catalog | 学科/年级/章节/知识点检索、动画包目录 |
| admin | 审核、用户、配置、学科与知识点维护与批量同步 |
| model-settings | 用户级 TTS/生图/视频模型偏好 |
| assets | 静态文件访问签名/直链 |

### Worker

- `workers/teachingMediaWorker.js`
- `services/teachingMediaPipeline.js`：封装 skill 调用
- 并发度：默认 1（HyperFrames 吃 CPU/内存），可配置

## 4. 与 skill 的边界

平台**不重写** skill 内部逻辑，只做：

1. 把用户输入映射为 `storyboard.json` / prompt 输入
2. 调用 skill 脚本：
   - `edu-teaching-animation/scripts/minimax_tts.py`
   - `scaffold_video.py`
   - `hyperframes render`（或封装后的 build 脚本）
   - 可选 `ai-image-generator/scripts/generate.py`
3. 收集产物路径并入库

Skill 升级时，平台通过 `TEACHING_MEDIA_ROOT` 指向新目录即可。

## 5. 部署形态

### 开发机（推荐首期）

- 前端 :3000
- API :3002
- Worker 同机进程
- MySQL 本地/容器
- skill 与 ffmpeg 安装在宿主机

### 生产建议

- API / Worker 分离
- 产物盘独立大容量卷
- Worker 机器强化 CPU + 足够内存
- 对象存储（MinIO/S3）替换本地 uploads
- 队列可升级为 Redis/BullMQ（首期 MySQL 抢占足够）

## 6. 安全

- 用户输入做长度与敏感词过滤
- Worker 工作目录隔离在 jobId 下
- 管理接口鉴权
- 公开放映仅 `visibility=public + publish_status=approved`
- 不在前端暴露 API Key

## 用户模型设置（规划）

用户偏好与系统默认分层，任务创建时固化 `modelSnapshot`。详见 `docs/user-model-settings.md`。
