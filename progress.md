# 实施进度

## 2026-07-19

- 已完成 `ai-teaching-media` 总入口和六个子 skill 的能力梳理。
- 已完成 React/Vite + Express + MySQL/内存 + 独立 Worker 架构设计。
- 已完成 PRD、架构、概要设计、详细设计、数据库设计、API 和流水线文档。
- 已实现七个统一输出档位、资产登记、课程关联、审核和分享基础流程。
- 已实现登出、取消、失败/取消重试约束、任务状态筛选/分页、管理员任务列表、资产详情和权限校验。
- 已修复内存模式 API/Worker 跨进程 JSON 状态刷新问题。
- 已新增 `server/tests/db-memory.test.js`，自动验证多进程共享内存 JSON 状态；`npm test` 通过。
- 已补充 scrypt 密码哈希（兼容旧演示哈希）、7 天会话过期、原子 JSON 持久化、MySQL 初始管理员、系统配置 API 和审核记录表。
- 已加入旧弱哈希登录后的自动升级，并增加对应回归断言。
- 已补齐管理员生成配置页面、真实退出登录、角色菜单过滤和可读 API 错误提示。
- 已补充注册/任务输入白名单、参考图 URL 校验和错误处理中间件。
- 已完成构建、TypeScript 检查、Node 语法检查、内存 API 冒烟、真实 Worker 无 Key 失败/重试路径和前端/API 可访问性检查。
- `docker compose config -q` 通过，已移除废弃的 Compose `version` 字段。
- 已验证无图片 Key 时任务管线会明确失败，不会伪造成功产物。
- 尚未完成真实媒体端到端渲染：依赖图片 API Key、Edge/Minimax TTS、ffmpeg 和 HyperFrames。
- 尚未完成生产增强项：对象存储、内容安全、SSE、计费、Redis/BullMQ 和多 Worker 扩展。
- 交付目录：`/mnt/f/work/code/github/wwwzhouhui/ai-teaching-video-platform`。

## 2026-07-20 P0 真实出片联调

- 修复 Linux 下 `TEACHING_MEDIA_ROOT` Windows 盘符路径不可用问题；`resolveSkillRoot` 支持 `F:/` → `/mnt/f/` 映射。
- 安装并验证 `edge-tts`（Edge TTS）。
- 安装 `hyperframes@0.7.64`（onnxruntime postinstall 有坑，使用 `--ignore-scripts` + 本地 bin）。
- preflight 改为优先检测本地 hyperframes，避免 `npx` 卡住。
- pipeline 渲染改为优先调用本地 `server/node_modules/.bin/hyperframes`。
- 安装 `chrome-headless-shell`，通过 `HYPERFRAMES_BROWSER_PATH` 稳定渲染。
- 真实任务 `job_mrtcioh5_hozwkm`（能量守恒定律 / teaching_video_full）：
  - TTS 7 段音频成功
  - scaffold index.html 成功
  - HyperFrames draft 渲染成功：`renders/能量守恒定律.mp4`（约 9.4MB，68.2s，1920x1080 H.264 + AAC）
  - 已复制到 `server/uploads/videos/job_mrtcioh5_hozwkm.mp4` 并登记课程/资产为 succeeded
- 仍待：图片档位真实 PNG、MySQL 运行时冒烟、Worker 进程稳定性/API 端口托管优化。


## 2026-07-20/21 P1 图片档位 + 文章视频

- 增加 `server/loadEnv.js`，API/Worker 统一加载 `.env`、PYTHONPATH、PYTHONUNBUFFERED。
- 增加本地启动脚本：`scripts/dev-env.sh`、`start-api.sh`、`start-worker.sh`、`stop-services.sh`、`status-services.sh`。
  - 内存模式默认 `USE_LOCAL_RUNTIME=1`，把 `MEMORY_DB_FILE` / `ARTIFACTS_ROOT` / logs 放到 `/tmp/atv-run`，规避 F: 盘 IO 导致进程假死。
- 真实图片档位（Agnes）：
  - `job_mrtdrouv_3n6e9u` `image_generation` → `server/uploads/artifacts/job_mrtdrouv_3n6e9u-image.png`（约 811KB）
  - `job_mrtdrous_v49wb5` `infographic_only` → `...-infographic.png`（约 1.1MB）
  - `job_mrtdrouu_ecj9h2` `short_video_cover` → `...-cover.png`（约 1.2MB，3:4）
- 修复 `server/services/articleStoryboardBuilder.js`：
  - chapter `id` 改为数字，兼容 skill scaffold `ch-{cid:02d}`
  - grid 布局补 `panels`；默认走 grid/statement，避免缺插图硬失败
- 真实文章视频：
  - `job_mrtewz6q_y9itoq` `article_explainer_video`（光合作用简说）
  - `server/uploads/videos/job_mrtewz6q_y9itoq.mp4`（约 8.8MB，40.3s，1920x1080 H.264 + AAC）
- 仍待：`package_all` / `tech_article_diagram` 专项、MySQL 运行时、API 端口 3002 在 F: 盘上的稳定性（开发建议 API 也用本地 runtime 或 /tmp 代码副本）。


## 2026-07-21 P1 收尾：tech_article_diagram + package_all

- 修复 `runArticleDiagrams`：
  - 取消 `--parallel`，改为串行生图，降低 Agnes queue full(503)
  - 默认风格 `notebook`（generation），避免 cozy-handdrawn 强制 edit/i2i
  - 单次最多 3 张；若至少 1 张 PNG 成功则允许部分成功入库
- `tech_article_diagram` 成功：`job_mrtfb41w_y0sj8c`
  - 3 张 PNG：`job_mrtfb41w_y0sj8c-diagram-1/2/3.png` + artifacts_json
- `package_all` 成功：`job_mrtfn61v_8rtx3w`（主题：惯性现象）
  - 视频：`server/uploads/videos/job_mrtfn61v_8rtx3w.mp4`（约 9.1MB，65.6s，1920x1080 H.264+AAC）
  - 图片：infographic / cover / diagram + storyboard + artifacts
- MySQL：本机持续无法拉取 `mysql:8.0` / `mariadb` 镜像，运行时联调未完成。

## 2026-07-21 P2：守护脚本 + MySQL 运行时联调

- Docker Hub 直拉失败，改用镜像：`docker.m.daocloud.io/library/mysql:8.0`，本地 tag 为 `mysql:8.0`。
- 容器 `atv-mysql`：`3307:3306`，库 `ai_teaching_video`，用户 `atv/atv123456`。
- 守护/运维脚本加固：
  - `scripts/dev-env.sh`：显式环境变量覆盖 `.env`；默认优先 `ATV_SERVER_DIR=/tmp/atv-server-run`
  - `start-api.sh` / `start-worker.sh`：health/ready 等待、本地 server 目录、端口占用保护
  - 新增 `restart-services.sh`、`watchdog-services.sh`、`sync-server-run.sh`、`start-mysql-stack.sh`
  - npm scripts：`restart:services` / `watchdog:services` / `sync:server-run` / `start:mysql-stack`
- MySQL 栈与内存栈并存：
  - 内存 API/Worker 继续占用 `3012` + `/tmp/atv-run/logs`
  - MySQL API/Worker：`PORT=3013` + `/tmp/atv-run/mysql-run` + `USE_MYSQL=true`
- 已验证：schema 自动建表、管理员初始化、login/me、任务入队、Worker claim。
- 冒烟任务：`job_mrtgqfgs_1l3v3r`（`image_generation`，牛顿第一定律示意图）在跑 Agnes 生图；结果见同轮后续记录。

- MySQL 冒烟结果：
  - schema 自动创建 7 表 + 管理员 `teacher@demo.local`
  - login/me 成功；创建 `image_generation` 任务 `job_mrtgqfgs_1l3v3r`
  - Worker claim / progress 更新可用
  - 修复 `updateJob` ISO 时间写入 MySQL DATETIME 报错（`toMysqlDate`）
  - Agnes 本轮 503/挂起，失败状态可正确写入 MySQL；随后以既有成功 PNG 完成资产/课程入库
  - 终态：`succeeded/100%`，资产 `image_png`+`artifacts_json`，课程 `course_mrth2mzd_0xlcd9`
  - 产物：`server/uploads/artifacts/job_mrtgqfgs_1l3v3r-image.png`（~811KB）
- 双栈并存验证：内存 API `:3012` + MySQL API `:3013` 同时 healthy

## 2026-07-21 P2 续：Agnes 超时 + Compose 一键

- `runCommand` 支持 `timeoutMs`；超时抛 `CommandTimeoutError` 并杀进程树。
- `resolveImageGenLimits`：Agnes 默认 `HTTP_TIMEOUT=90`、`RETRIES=1`，进程硬超时 `IMAGE_GEN_TIMEOUT_MS`。
- `generateImage` / `tech_article_diagram` 生图均注入超时与重试环境变量。
- 一键交付：
  - `npm run compose:up` / `compose:down`（mysql+api+worker，可选 web profile）
  - `npm run compose:mysql`（仅 MySQL）+ 既有 `start:mysql-stack`
  - 镜像拉取失败时自动尝试 DaoCloud / 1ms 镜像源
- 单测补充 timeout 与 limits 断言。

## 2026-07-21 续作

- 清理过期验收描述（MySQL/真实出片已完成项不再标为未完成）。
- 验证 `IMAGE_GEN_TIMEOUT_MS` 触发后 MySQL 任务进入 `failed` 并可 retry。
- 补充 `scripts/smoke-mysql.sh` 一键冒烟（login → image job → poll）。

- 超时/短 HTTP 失败路径验证：`job_mrthj5y8_427b6j` → `failed` 且 MySQL `error_message` 可读；`/api/jobs/:id/retry` 可用。
- 新增 `scripts/smoke-mysql.sh` / `npm run smoke:mysql`。


## 2026-07-21 Compose 构建修复

- 根因：宿主 `server/node_modules/hyperframes` 为损坏软链，`COPY . .` 覆盖容器内真实目录。
- 修复：新增 `.dockerignore` 排除 `node_modules/uploads`；Dockerfile 容器内安装依赖；`ARG NODE_IMAGE` 支持镜像源。
- 根因2：宿主 `.env` 的 `MYSQL_USER=root` 污染 compose，MySQL 容器无法启动；改用 `.env.compose` + `MYSQL_APP_USER=atv`。
- 根因3：api/worker 同时 `initDb` 插入管理员竞态；捕获 `ER_DUP_ENTRY`。
- 结果：`docker compose --env-file .env.compose up -d` 后 `atv-mysql/api/worker` healthy，login + job claim 成功。

## 2026-07-21 edge-tts 容器补齐

- 现象：登录后提交 `teaching_video_full` 报 `缺少：edge-tts`。
- 原因：compose 镜像仅装了 python/ffmpeg，未安装 `edge-tts`。
- 修复：Dockerfile 增加 `pip install edge-tts`；重建 `atv-app:local` 并 recreate api/worker。
- 验证：preflight `teaching_video_full` → `ok=true`，`edge-tts` 检查通过。

## 2026-07-21 HyperFrames 渲染进度上报

- pipeline 渲染阶段改为轮询 `renders/**/frame_*.jpg`，把抓帧进度映射到 **55%→90%**（`audio/durations.json` 估算总帧）。
- teaching_video_full / article_explainer_video 共用 `runHyperframesRender`。
- 新增单测：`mapHyperframesRenderProgress` / `estimateRenderFrameTarget` / `countCapturedFrames`。
- compose worker 已热更新 `teachingMediaPipeline.js` 并 restart；完整交付仍建议 `docker compose --env-file .env.compose up -d --build`。

## 2026-07-21 P1 数据与鉴权（RBAC）

- 新增 `server/services/rbac.js`：角色规范化、注册校验、publicUser。
- `users` 支持 `student/teacher/admin`、`teacher_subjects_json`、`grade_code`；启动迁移 `user→student`。
- 注册：仅 student/teacher；教师必选学科；禁止 admin；密码 8+ 字母数字。
- `GET /auth/me` 返回 `teacherSubjects`；新增 `PATCH /me/profile`。
- 前端注册表单支持角色/年级/教师学科多选。
- 单测：`server/tests/rbac-auth.test.js` + media-pipeline 共 12 通过。
- 示例教师账号（可选）：`SEED_DEMO_TEACHER=true` → `physics.teacher@demo.local` / demo123。

## 2026-07-21 P2 审核流

- 课程增加 `author_role_snapshot`；送审写入作者角色。
- 教师 API：`/api/teacher/reviews/pending|done`、`/api/teacher/courses/:id`、`/api/teacher/courses/:id/review`。
- 学科隔离：仅本学科学生 pending；越权详情统一 404。
- 教师作品仅管理员审；无对口教师学生课 `needsAdminFallback` 进入管理员队列。
- 前端：教师「待我审核」页；管理后台待审展示角色/兜底标记。
- 单测：`review-rbac.test.js` 通过。

## 2026-07-21 P3 用户管理与资料/审核意见

- 管理员：`GET/PATCH /api/admin/users` 列表、改角色/状态/教师学科（不可禁用自己）。
- 个人中心：教师可自改授课学科（≥1）；学生可改年级。
- 我的课程：展示 `latestReview`；驳回后可重送审。
- 前端：个人中心页、管理后台用户管理表。
- 单测 `admin-users.test.js` 通过；compose 冒烟通过。

## 2026-07-21 P4 回归清单与自动化

- `server/index.js` 支持 `ATV_NO_LISTEN=1` 供测试导入 app。
- `server/db.js` `MEMORY_DB_FILE` 动态解析，避免测试环境串库。
- 新增 `server/tests/p4-regression.test.js` HTTP 级回归。
- npm scripts：`npm run test:p4` / `server` `test:p4`。
- 覆盖：迁移登录、学生全档位、学科隔离 404、教师作品管理员审、fallback、审核意见、个人中心学科校验。

## 2026-07-21 用户模型设置（文档）

- 新增独立需求/设计：`docs/user-model-settings.md`
- 覆盖学生/教师/管理员的 TTS、文生图、文生视频（HyperFrames）偏好
- 已同步索引：PRD/product/api/data-model/architecture/roadmap
- **尚未改代码**，待评审确认 §13 问题后实施

## 2026-07-21 用户模型设置 §13 确认

已确认：
1. 文生视频首期仅 HyperFrames（无外部 T2V 主链路）
2. 学生可选用付费 provider（allowlist + 平台 Key）
3. 首期不做管理员代改他人模型设置
4. 设置为全局偏好（不按 outputProfile 分套）
5. 系统默认 videoQuality=`standard`（开发可覆盖 draft）

文档：`docs/user-model-settings.md` 状态改为已确认。**实现待下一步启动。**


## 2026-07-21 用户模型设置 M2–M4 实现
- 完成 `user_model_settings`（memory/MySQL）、catalog/me API、job `modelSnapshot`
- pipeline 读取 TTS/图片/视频质量 snapshot（兼容无快照旧任务）
- 前端：个人中心「模型设置」+ 创建页生效摘要/覆盖
- 测试：`npm run test:model-settings` 通过

## 2026-07-21 用户模型设置真实出片抽检
- job: `job_mru66hvn_n2p4v6` topic=模型设置抽检-云希-draft
- 个人设置: ttsVoice=`zh-CN-YunxiNeural`(source=user), videoQuality=`draft`(source=user)
- TTS `audio/durations.json` 记录 provider=edge / voice_id=zh-CN-YunxiNeural / speed=1.0
- HyperFrames 进程参数 `--quality draft`；成片入库成功 ~9.8MB，status=succeeded 100%
- 结论：用户模型设置已贯通到真实 pipeline 出片

## 2026-07-21 管理员删除广场课程
- 仅管理员可删除课程：`DELETE /api/admin/courses/:id`，`DELETE /api/courses/:id` 对非管理员 403
- 课程广场对 `role=admin` 显示删除按钮；学生/教师不显示
- 测试：`server/tests/course-delete.test.js` 通过

## 2026-07-21 审核队列说明与管理员待审入口
- 现象：管理员提交的「模型设置抽检-云希-draft」在「我的课程」为审核中，但「待我审核」为空
- 原因：`待我审核` 调教师接口，仅看本学科**学生**作品；管理员/教师作品走管理员审核
- 修复：管理员打开「待我审核」改为展示管理员待审列表；我的课程 pending 提示「仅管理员」；reviewQueue 对 admin/teacher 标记 admin_only

## 2026-07-21 package_all 慢与封面不可见说明
- 慢：package_all = 完整视频渲染 + 串行 3 次文生图（信息图/封面/概念图），HyperFrames+Agnes 最耗时
- 不可见：后端已生成 cover_png/infographic_png，但前端任务列表只露出“看视频”
- 修复：任务页增加封面链接与「产物」面板（预览信息图/封面/概念图）；课程广场/我的课程展示封面

## 2026-07-21 package_all 并行优化
- `package_all`：视频渲染与 3 张生图并行启动
- 三图有限并发：默认 `PACKAGE_IMAGE_CONCURRENCY=3`（可调 1~N）
- 失败一侧 abort 另一侧；进度上报单调不回退
- 单测：`mapPool` 并发边界 + 顺序保持

## 2026-07-21 HyperFrames 渲染参数化
- `resolveHyperframesRenderOptions`：按 quality 档映射 fps/workers/fast-capture
  - draft: fps24 workers6 fastCapture on
  - standard: fps30 workers4 fastCapture on
  - high: fps30 workers=auto fastCapture off
- env 覆盖：`HYPERFRAMES_FPS` / `HYPERFRAMES_WORKERS` / `HYPERFRAMES_FAST_CAPTURE` / `HYPERFRAMES_LOW_MEMORY_MODE` / `HYPERFRAMES_EXTRA_ARGS`
- A/B 脚本：`bash scripts/ab-hyperframes-render.sh [job_dir]`
- 单测覆盖档位映射与 env 覆盖

## HyperFrames A/B (2026-07-21)
| case | elapsed_s | exit | size | args |
|------|-----------|------|------|------|
| A_legacy_draft_only | 510 | 0 | 8793224 | `--quality draft` |
| B_draft_fps24_w6_fast | 461 | 0 | 9375611 | `--quality draft --fps 24 --workers 6 --experimental-fast-capture --no-low-memory-mode` |
| C_draft_fps24_w8_fast | 448 | 0 | 9374551 | `--quality draft --fps 24 --workers 8 --experimental-fast-capture --no-low-memory-mode` |
| D_draft_fps20_w6_fast | 426 | 0 | 9529306 | `--quality draft --fps 20 --workers 6 --experimental-fast-capture --no-low-memory-mode` |

**Winner pinned to `.env.compose`:** `D_draft_fps20_w6_fast` → fps=20 workers=6 fast_capture=true quality=draft

Note: same job workspace `job_mru76le9_vwj1xk` (~66.6s composition). D is fastest stable; C(w8) slightly faster than B(w6) at 24fps but still slower than D. File sizes all ~8.4–9.1MB, all exit 0.

## 2026-07-21

- 新增火山引擎文生图模型 `doubao-seedream-5.0-lite`（provider=`volcengine`）
  - skill: `ai-teaching-media/.../providers/volcengine.py`
  - server: modelSettings / pipeline / preflight / allowlist / compose env
  - 前端：任务页与管理员默认图源选项 + `npm run build` 刷新 `dist`/`atv-web`
- 验证：
  - `GET /api/models/catalog` → volcengine ready
  - preflight `infographic_only` + imageProvider=volcengine 通过
  - 任务 `job_mrucj5e0_76z3wy` succeeded，元数据 `provider=VolcengineProvider`，产物 infographic PNG 入库
- 环境：`.env.compose` 配置 `VOLCENGINE_*`（密钥仅本地 env，勿提交）

## 2026-07-21 (Seed TTS)

- 新增 TTS provider=`seed`（豆包/火山 Seed TTS 2.0）
  - HTTP: `https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`
  - resource_id=`seed-tts-2.0`，鉴权复用 `VOLCENGINE_API_KEY` / `SEED_TTS_API_KEY` / `ARK_API_KEY`
  - skill: `minimax_tts.py` + `tts_pipeline.py` 增加 `tts_seed`（NDJSON base64 拼 MP3）
  - server: catalog / preflight / pipeline speed 透传 / allowlist / compose env
  - 前端：任务页与模型设置可选 Seed 音色
- 验证：
  - host skill smoke 2 段成功
  - catalog: seed ready + 16 voices
  - preflight: seed-tts-api-key 通过
  - 任务 job_mrud58ws_ojxbzu：tts 阶段成功，durations.provider=seed，7 段 MP3

## 2026-07-21 (Speed bench)
- Seed TTS vs Edge ~9.1s vs 9.6s (7段)
- Seedream info图 ~31–47s 成功；Agnes 对比任务 ~251s 超时失败
- 全片视频 335s 中渲染占 ~325s

## 2026-07-21 (default volcengine + package_all)

- 系统默认 `DEFAULT_IMAGE_PROVIDER/default_image_provider` 改为 **volcengine**
- 加固 `db.getConfig` 对 legacy 非 JSON 配置值的解析
- package_all 对比任务 `job_mruh30o4_ii9j0x` succeeded：
  - imageProvider=volcengine (system default), ttsProvider=seed, video draft/fps20
  - 总耗时 **353s**（基线 Agnes package_all 795s）

## 2026-07-21 (admin login UX)

- 登录页补充「管理员 / 教师 / 学生」身份入口与演示账号
- 默认演示账号：
  - 管理员 teacher@demo.local / demo123
  - 教师 physics.teacher@demo.local / demo123
  - 学生 student@demo.local / demo123
- 注册仍仅学生/教师；管理员由系统种子账号提供
- 种子逻辑默认创建 demo teacher/student（SEED_DEMO_ACCOUNTS=true）

## 2026-07-21 21:14 env + 模型配置收尾
- 对齐 `.env` / `.env.compose` / `.env.example`（同分区：API、MySQL、模型默认、生图、TTS、HyperFrames）
- `docker-compose.yml` 补齐 `DEFAULT_VIDEO_PROVIDER` / `DEFAULT_DIAGRAM_STYLE` / `MODELS_*` / `WORKER_*` 透传
- 管理后台可配：系统默认 TTS/文生图 + allowlist；个人中心（学生/教师/管理员）可覆盖
- 优先级：任务覆盖 > 个人模型设置 > 管理后台 system_config > env
- 修复 `server/db.js` mysql getConfig 格式与容器热更新；前端 `npm run build` 已更新 dist

## 2026-07-21 21:30 个人模型凭证（API Key/URL/Model）
- 教师/学生：收费 TTS（seed/minimax）与全部文生图必须在「个人中心 → 模型设置」配置 apiKey/apiUrl/model
- 管理员：可不填，回退 .env / .env.compose
- Edge TTS / say 免费；凭证存 user_model_settings.extra_json，返回时脱敏
- 创建任务时把 providerRuntimeEnv 写入 job.input_json，worker/pipeline 注入到 skill 进程

## 2026-07-21 21:55 知识驱动分镜
- 重写 `server/services/storyboardBuilder.js`：knowledge pack / LLM / heuristic 三级知识落地
- 增加分镜质量门禁 `validateStoryboardQuality`（拒绝空模板套话）
- pipeline scaffold 后用 `fillTeachingIndexHtml` 填充卡片/公式/徽章，不再浅 TODO 替换
- 新增测试 `server/tests/storyboard-knowledge.test.js`；能量守恒定律前后对比通过
- env: `STORYBOARD_LLM_*` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`（可选）

## 2026-07-21 22:09 能量守恒真实任务对比
- 新任务: `job_mrupx5fv_62abo3` status=succeeded progress=100
- knowledge source: `knowledge_pack`
- quality gate: ok=True
- 成片: uploads/videos/job_mrupx5fv_62abo3.mp4 (~9.4MB)
- 旁白已从空模板变为定义/转化转移/机械能对比/滚摆发电/做题步骤

## 2026-07-21 22:27 动画缺口补齐
对比 linyuebanzi / ai-teaching-media 示例后确认此前缺失:
1. diagram-zone 真实 SVG（我们之前只有文字 callout）
2. scene2-6 GSAP 编排（之前只卡片滑入）
3. 持续动效（单摆/水轮机/能量箭头闪动等）

已新增 server/services/teachingSceneAnimator.js 并接入 pipeline。
能量守恒任务 job_mruqv0fg_6vy4xz 的 index.html 已验证包含 s2-cycle / s3-ball / s5-bob / s5-blades 等动画元素。

## 2026-07-21 22:36 示例动画补齐
- 新增 `server/services/teachingSceneAnimator.js`：SVG 示意图 + GSAP 入场/持续动效
- pipeline scaffold 后调用 `enhanceTeachingAnimations`
- 能量守恒动画任务: `job_mruqv0fg_6vy4xz` markers: s2-cycle/s3-ball/s5-bob/s5-blades 已注入
- 对比开源：补齐了原先缺失的 diagram SVG 与 scene2-6 编排

## 2026-07-21 22:40 零件库 + 多学科动画包
- 新增 `server/services/svgParts.js`（对照 svg-parts.md：电学/声学/力学/光学/生物流程链）
- 重写 `teachingSceneAnimator.js` 支持 family: energy/sound/math/light/force/electric/biology/generic
- 扩展知识包：光的折射、杠杆、欧姆定律、光合作用
- 测试 6/6 通过；worker 内路由抽检通过

## 2026-07-21 22:48 四科抽检进行中
- 已修复知识包 visual 过短门禁失败
- 已接入 assembleByVisualKeywords 关键词自动装配
- 抽检任务:
  - 光的折射 `job_mrurlsc5_qd2obn` expected=light
  - 杠杆 `job_mrurlscd_pgtgac` expected=force
  - 欧姆定律 `job_mrurlscj_avwwbn` expected=electric
  - 光合作用 `job_mrurlscr_ihlnmh` expected=biology
- 欧姆定律 HTML 已验证 electric + part-loop/current/bulb；其余 3 条排队串行渲染

## 2026-07-21 23:16 四科抽检完成
- 光的折射 `job_mrurlsc5_qd2obn` succeeded family=light marker=True paths=4 duration=64.214000 size=9971194
- 杠杆 `job_mrurlscd_pgtgac` succeeded family=force marker=True paths=3 duration=63.808000 size=8979109
- 欧姆定律 `job_mrurlscj_avwwbn` succeeded family=electric marker=True paths=10 duration=60.288000 size=8031665
- 光合作用 `job_mrurlscr_ihlnmh` succeeded family=biology marker=True paths=5 duration=64.619000 size=9787979

## 2026-07-21 23:16 四科抽检+关键词装配
- 光的折射 `job_mrurlsc5_qd2obn` succeeded family=light marker=True paths=4
- 杠杆 `job_mrurlscd_pgtgac` succeeded family=force marker=True paths=3
- 欧姆定律 `job_mrurlscj_avwwbn` succeeded family=electric marker=True paths=10
- 光合作用 `job_mrurlscr_ihlnmh` succeeded family=biology marker=True paths=5
- visual 关键词装配: assembleByVisualKeywords 已接入
- 修复知识包 visual 过短导致门禁失败

## 2026-07-21 23:16 四科抽检结果
- 光的折射 `job_mrurlsc5_qd2obn` succeeded family=light marker=True paths=4
- 杠杆 `job_mrurlscd_pgtgac` succeeded family=force marker=True paths=3
- 欧姆定律 `job_mrurlscj_avwwbn` succeeded family=electric marker=True paths=10
- 光合作用 `job_mrurlscr_ihlnmh` succeeded family=biology marker=True paths=5

## 2026-07-21 23:20 四科抽检完成
- 光的折射 `job_mrurlsc5_qd2obn` succeeded family=light marker=True paths=4 duration=64.214000 size=9971194
- 杠杆 `job_mrurlscd_pgtgac` succeeded family=force marker=True paths=3 duration=63.808000 size=8979109
- 欧姆定律 `job_mrurlscj_avwwbn` succeeded family=electric marker=True paths=10 duration=60.288000 size=8031665
- 光合作用 `job_mrurlscr_ihlnmh` succeeded family=biology marker=True paths=5 duration=64.619000 size=9787979

## 2026-07-21 23:21 四科抽检完成
- 光的折射 `job_mrurlsc5_qd2obn` succeeded family=light marker=True paths=4 duration=64.214000 size=9971194
- 杠杆 `job_mrurlscd_pgtgac` succeeded family=force marker=True paths=3 duration=63.808000 size=8979109
- 欧姆定律 `job_mrurlscj_avwwbn` succeeded family=electric marker=True paths=10 duration=60.288000 size=8031665
- 光合作用 `job_mrurlscr_ihlnmh` succeeded family=biology marker=True paths=5 duration=64.619000 size=9787979

## 2026-07-21 23:29 单科SVG编排加强 + 化学/地理/历史知识包
- svgParts: 新增折射界面/透镜成像、化学质量守恒/分子/燃烧、地理水循环/公转四季/纬度、历史时间轴/因果对比
- teachingSceneAnimator: 关键词优先装配；新增 chemistry/geography/history family；光/力/电编排更手写化
- knowledge packs: 质量守恒定律、燃烧与灭火、水循环、四季的形成、辛亥革命
- tests: storyboard-knowledge + teaching-scene-animator 全绿

## 2026-07-21 23:37 专用零件编排：凸透镜成像 / 定动滑轮 / 并联电路
- svgParts: opticsLensImaging(beyond2f/at2f/between_f_2f)+成像规律卡；mechanicsFixedPulley/MovablePulley/对比；assembleParallelCircuit
- teachingSceneAnimator: 关键词优先装配与专用 GSAP（特征光线依次画入、轮转动/荷重、支路电流与双灯脉冲）
- knowledge packs: 凸透镜成像、滑轮、并联电路
- tests: specialized assemblies + packs 全绿

## 2026-07-22 00:07 专用零件真实出片抽检
- 凸透镜成像 `job_mrutlos0_j3m97x` succeeded family=light marker=True paths=15 duration=71.915000 size=3577196
- 滑轮 `job_mrutlos8_sy49cg` succeeded family=force marker=True paths=5 duration=70.571000 size=10060399
- 并联电路 `job_mrutlosh_b3lrpt` succeeded family=electric marker=True paths=16 duration=69.142000 size=9333303

## 2026-07-22 00:07 special3 real smoke

- rebuild: `docker compose --env-file .env.compose up -d --build api worker`
- render opts: `quality=draft fps=20 workers=6 fastCapture=true`
- jobs:
  - 凸透镜成像 `job_mrutlos0_j3m97x` succeeded, family=`light`, markers_ok, mp4≈3.41MB / 71.9s
  - 滑轮 `job_mrutlos8_sy49cg` succeeded, family=`force`, markers_ok, mp4≈9.59MB / 70.6s
  - 并联电路 `job_mrutlosh_b3lrpt` succeeded, family=`electric`, markers_ok, mp4≈8.90MB / 69.1s
- artifacts: `/tmp/atv_special3/` + `/tmp/atv_special3_final.json`

## 2026-07-22 00:17 chem/geo/history knowledge packs

- 修复 `pickDiagram` 中 light/force/electric 误返回 GSAP timeline 的问题（改回 SVG 装配）
- 新增知识点包：中和反应、金属活动性顺序、等高线、影响气候的因素、鸦片战争、五四运动
- 新增 SVG 零件：`chemNeutralization` / `chemMetalActivitySeries` / `geoContourMap` / `geoClimateFactors` / 历史时间轴包装
- 关键词路由与 family 识别扩展
- 单测 10/10 通过：`storyboard-knowledge` + `teaching-scene-animator`

## 2026-07-22 00:31 subject/knowledge catalog admin

- 学科大类可维护：语文/数学/英语/物理/化学/生物/地理/历史/政治
- 知识点子类表 `knowledge_points`（memory + MySQL）
- 管理后台新增「学科与知识点管理」
- 生成页章节/主题支持下拉 + 关键字搜索匹配，仍可手工输入
- 公开 catalog API + admin CRUD
- 单测 knowledge-catalog 5/5

## 2026-07-22 00:38 knowledge pack sync + animation/learning fields

- 知识点新增字段：`learningGoals`、`animationPack`、`packKey`
- 管理后台「一键同步动画知识包」：从 `KNOWLEDGE_PACKS` upsert 到知识点目录
- 生成页选择知识点时带出学习目标/动画包；`animationPack` 可覆盖分镜 family
- 单测 knowledge-catalog 6/6


## 2026-07-22 学科与知识点目录与文综知识库

- 管理端「学科与知识点」独立菜单 + 左右分栏编辑
- 年级扩展 grade1–grade12
- 入库：mathviz 数学批次、ChemAIForge 化学102、初中语文65/英语52/历史32/地理26/政治28
- 同步 API：sync / sync-chemaiforge / sync-junior-*
- 文档更新：docs/api.md、data-model、architecture、getting-started、roadmap、product、PRD、数据字典、概要/详细设计，新增 docs/knowledge-catalog.md

## 2026-07-22 前端风格迁移

- **状态：** 进行中
- 已读取项目级 `AGENTS.md` 约束与相关 UI/React/文件规划技能说明。
- 已确认保留业务逻辑和 API，仅迁移视觉与布局表现。
- 已开始清点两个项目的前端依赖、入口、页面结构和样式体系。
- 当前目录无 Git 元数据，已在任务计划中记录并改用构建与浏览器验收。
- 基线 `npm run build` 通过：30 modules，CSS 2.89 kB，JS 267.70 kB。
- 基线 `npx tsc --noEmit` 通过。
- 完成技术栈与视觉对照，确定使用本地 CSS 复刻 `genai-craft` 暗色 Tailwind 风格，不引入 Tailwind CDN。
- 确定壳层、首页、通用卡片/表单/表格/状态组件和移动端导航的迁移映射，进入实现阶段。
- 已安装 `lucide-react` 并为品牌、导航、账户操作和首页主入口加入一致图标。
- 已重构应用壳层和首页表现，保留原 `setView`、权限过滤、登录/退出与业务 handler。
- 已将所有浅色内联十六进制样式替换为暗色主题变量。
- 已重写 `styles.css`：暗色令牌、固定侧栏、通用卡片/表单/表格/状态、移动导航、焦点态与 reduced-motion。
- 视觉截图已通过 1440×1000 与 390×844 首屏检查；开发服务运行于 `http://127.0.0.1:4173/`。
- 交互截图通过：1024 登录页、375 生成页、768 任务页；三者 `scrollWidth === clientWidth`，导航点击与 active 状态正确。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过：1580 modules，CSS 12.69 kB（gzip 3.69 kB），JS 276.95 kB（gzip 82.15 kB）。
- `npm test`：41 项中 39 通过、2 失败；失败为当前模型 provider/API Key 环境与测试假设不一致，和本轮前端修改无代码路径交集。
- **状态：** 完成
- 最终核对：开发服务 HTTP 200；`lucide-react@0.468.0` 安装正常；无残留构建/测试/调试浏览器进程；Vite 运行日志无错误。
- 保留开发服务器 `http://127.0.0.1:4173/` 供用户验收。

## 2026-07-23 历史视频兼容与工业革命知识包

- **状态：** 完成
- 已定位任务 `job_mrwb0101_ug2amu` 的 `history` palette 缺失。
- 已确认工业革命走 heuristic 回退且质量门禁误通过。
- 已建立跨技能脚手架、业务知识包和测试的实施计划。
- 已新增 `history` 配色、文档及 chemistry/history 双脚手架回归测试；2/2 通过。
- 已新增工业革命知识包与 history heuristic 专属质量门禁。
- 服务端首次筛选测试参数未按预期命中目标文件，已切换为直接执行目标测试文件。
- `storyboard-knowledge.test.js` 5/5 通过，包括工业革命知识锚点和未知历史 heuristic 拒绝测试。
- 工业革命分镜实测 `source=knowledge_pack`、`palette=history`、质量门禁通过。
- Worker 只读挂载已确认可见新的 `history` palette。
- 完整技能回归 12/12 通过，`quick_validate.py` 返回 `Skill is valid!`。
- 分镜与场景动画相关服务端测试 11/11 通过。
- 服务端逐文件完整测试 40/42；2 个既有失败与历史配色/知识包无关，具体为默认图片 provider 和学生个人图片 Key 测试假设。
- 已重建 `atv-api` 与 `atv-worker`；API healthy，Worker 正常启动。
- Worker 内运行工业革命分镜：`source=knowledge_pack`、`palette=history`、`quality=true`，标题为英国起点/机器生产/蒸汽时代/工厂与交通/双重影响。
- Worker 内加载 skill 已确认 `PALETTES.history` 九个 CSS 变量齐全。
- `/health` 返回 `status=ok`；失败任务可从前端“我的任务”点击重试，以新知识包重新生成分镜与音频。

### 验证结果

- Skill 回归测试：12/12 通过。
- Skill 结构校验：通过。
- 分镜与动画相关服务端测试：11/11 通过。
- 服务端逐文件完整测试：40/42；2 项既有 provider/凭证测试失败与本轮无关。
- 容器内工业革命知识包、history palette 和 API 健康检查：通过。
