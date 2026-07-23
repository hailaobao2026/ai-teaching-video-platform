# 审查发现与处置

## 本轮已确认并修复

- 初始审计发现的 `outputProfile` 未分支、MySQL 缺少 `course_assets`、缺少登出/取消/资产接口等问题已解决。
- 状态文件曾滞后于实现，已改为与当前代码和证据一致。
- Job `status/page/limit` 查询此前被忽略，现已加入内存/MySQL两种模式的过滤和分页。
- `/api/assets/:assetId`、`/api/admin/jobs` 此前缺失，现已补齐权限检查和分页查询。
- 真实 Worker 验收暴露内存模式跨进程缓存问题：API 进程看不到 Worker 写入的失败状态。已增加 JSON 仓储刷新逻辑，API 现可读到 `failed` 和错误信息。
- 二次审查发现内存文件写入非原子、弱密码哈希、会话不失效、MySQL 无初始管理员、管理员配置未落地、输入校验不足和审核意见未记录；现已分别加入原子写入、scrypt（兼容旧哈希）、7 天会话过期、MySQL 管理员初始化、`system_config` API、输入白名单和 `course_reviews`。
- 旧弱哈希登录成功后会自动升级为 scrypt，避免兼容路径长期保留弱凭据。
- 前端曾缺少管理员配置控件、真实登出和角色菜单过滤，API 错误也会显示原始 JSON；现已补齐配置表单、登出流程、管理员入口权限显示和错误解析。

## 当前证据

- `server/services/teachingMediaPipeline.js` 暴露七个档位：六类用户能力与 `package_all` 聚合档位。
- `server/db.js` 同时实现 `course_assets` MySQL 表、内存资产集合、任务/课程关联、资产详情和跨进程刷新。
- `server/index.js` 已覆盖任务筛选、取消、重试约束、登出、Job/课程资产、资产详情和管理员任务接口。
- Worker 无 Key 实测结果：`queued → running → failed`，错误为 `AGNES_API_KEY 未设置...`；API 查询成功，重试返回 `queued`。
- Vite 首页和 API `/health` 当前可访问；构建和 TypeScript 检查通过。
- 管理员配置更新会被 Worker 读取，用于 provider、TTS、skill 路径和 HyperFrames 质量配置。

## 仍未完成的验收项

- 场景填充仍是 skill scaffold 后的最小 TODO 替换，不是完整学科模板库。
- 静态 `/uploads` 媒体代理已有签名 URL 能力，生产仍建议对象存储。
- 生产增强：SSE/WebSocket 进度、Redis/BullMQ、多 Worker 扩展、内容安全/计费未做。
- Compose 全容器 `api/worker` 镜像构建与端到端容器内出片尚未在本机完整跑通（宿主 MySQL 栈 + 一键脚本已就绪）。

## 生产风险

- 对象存储、病毒扫描、内容安全审核、SSE/WebSocket、计费、Redis/BullMQ、多 Worker 扩展仍未实现。
- 内存模式仅用于开发和冒烟，生产应使用 MySQL，并配置独立 Worker 与持久化产物盘。
- API Key 只从服务端环境变量读取，仓库和交付目录不包含真实密钥。

## 2026-07-20 真实出片证据

- 依赖：edge-tts + hyperframes 0.7.64 + chrome-headless-shell + ffmpeg
- 成功产物：`server/uploads/videos/job_mrtcioh5_hozwkm.mp4`（1920x1080 H.264/AAC，68.2s，约 9.4MB）
- 工作区：`server/data/jobs/job_mrtcioh5_hozwkm/`（audio 7 段 + storyboard + index.html + renders）
- 阻塞点已解除：skill 路径、edge-tts、hyperframes 安装、Headless Chrome
- 仍开放：PNG 档位 Key 实测、MySQL E2E、API/Worker 守护与端口稳定性


## 2026-07-20/21 P1 联调发现

- F: 挂载盘上 Node 启动/写 memory-db 会偶发极慢甚至“进程在但未 listen”。内存模式建议 `MEMORY_DB_FILE` 与 `ARTIFACTS_ROOT` 放本机盘（`/tmp/atv-run`）。
- Agnes 生图可用，但 3:4 封面偶发长时间 HTTP 卡住；直连重试可成功。`AGNES_HTTP_TIMEOUT` 建议 90–180。
- `articleStoryboardBuilder` 旧实现：
  1) chapter id 用字符串 `ch-01`，scaffold 里 `f"ch-{cid:02d}"` 直接异常；
  2) `layout=grid` 无 `panels` 会被 scaffold 拒绝。
- 文章视频 E2E 已打通：storyboard → Edge TTS → scaffold → HyperFrames draft → 入库。


## 2026-07-21 tech/package 联调

- Agnes 并行 manifest（`--parallel`）易触发 `image queue is full` HTTP 503；改为串行后稳定。
- `cozy-handdrawn` 会把 manifest 切到 edit/i2i，更吃队列；`notebook` generation 更适合批量 E2E。
- `package_all` 真实链路：teaching video → infographic → cover → diagram，全资产入库成功。
- Docker Hub 拉 `mysql:8.0` 在本环境仍失败，MySQL 模式运行时冒烟未做。

## 2026-07-21 运维与 MySQL 联调发现

- 官方 Docker Hub 拉 `mysql:8.0` 易超时；可用 `docker.m.daocloud.io/library/mysql:8.0` 后 `docker tag ... mysql:8.0`。
- `scripts/dev-env.sh` 若 `source .env` 会覆盖 `start-mysql-stack.sh` 预先 export 的 `PORT/USE_MYSQL`；必须保留调用方覆盖项。
- 内存栈与 MySQL 栈请隔离 `PORT` 与 `LOG_DIR`（建议 3012+/tmp/atv-run/logs 与 3013+/tmp/atv-run/mysql-run）。
- `/mnt/f` 上跑 Node 仍可能慢；优先 `ATV_SERVER_DIR=/tmp/atv-server-run` + `scripts/sync-server-run.sh`。
- compose 对外 MySQL 端口是 **3307**；宿主进程连库应 `MYSQL_PORT=3307`，容器内仍是 3306。

- Worker 写 `finished_at: new Date().toISOString()` 时 MySQL DATETIME 报 `ER_TRUNCATED_WRONG_VALUE`；`db.updateJob` 需把日期字段转 `Date`（`toMysqlDate`）。
- Agnes 高峰可能长时间挂起或 503；MySQL 路径必须能把失败状态落库，避免任务永久 `running`。

## 2026-07-21 Agnes 超时设计

- skill 侧已支持 `AGNES_HTTP_TIMEOUT` / `AGNES_HTTP_RETRIES`，但默认 300s×重试仍可能让 Worker 假死。
- 平台侧必须再加 **进程硬超时**（`IMAGE_GEN_TIMEOUT_MS`），避免 HTTP 库卡死不返回。
- 推荐开发默认：90s timeout + 1 retry；生产可按网络调高，但务必保留硬上限。


## 2026-07-21 Compose 踩坑

- 不要把宿主 `node_modules` 拷进镜像；尤其 hyperframes 在本机可能是指向 `/tmp/...` 的坏链。
- compose 必须使用独立 `.env.compose`，避免开发 `.env` 里 `MYSQL_USER=root` 让官方 mysql 镜像拒绝启动。
- api/worker 双进程初始化管理员需要幂等（忽略 ER_DUP_ENTRY）。

## 用户模型设置实现要点
- 解析优先级：task > user(enabled) > system/env
- videoProvider v1 强制 hyperframes
- 用户设置不存 API Key；catalog 按 allowlist + ready 过滤
- job.input_json.modelSnapshot 固化本次生效模型
- compose：API/worker 代码热拷贝后 restart；web 用 `npm run build` 刷新 dist

## Volcengine Seedream (2026-07-21)
- Endpoint: `https://ark.cn-beijing.volces.com/api/plan/v3/images/generations` (sync)
- Model: `doubao-seedream-5.0-lite`
- Env: `VOLCENGINE_API_KEY` (alias `ARK_API_KEY`)
- Size: total pixels must be >= 3,686,400; map 16:9→2560x1440, 9:16→1440x2560, 1:1→1920x1920
- edit mode not supported
- E2E job_mrucj5e0_76z3wy: ~45s, VolcengineProvider, asset infographic_png

## Seed TTS 2.0 (2026-07-21)
- Endpoint HTTP unidirectional: `https://openspeech.bytedance.com/api/v3/plan/tts/unidirectional`
- Headers: `X-Api-Key`, `X-Api-Resource-Id: seed-tts-2.0`, `X-Api-Request-Id`
- Body: `{user:{uid}, req_params:{text, speaker, audio_params:{format:mp3,sample_rate:24000,speech_rate}}}`
- Response: multi-line JSON; `code=0` chunks with base64 `data`; final `code=20000000`
- speech_rate ≈ (speed-1)*100 clamped [-50,100]; `speed` field ignored
- Verified speakers include zh_female_vv_uranus_bigtts, zh_female_cancan_uranus_bigtts, zh_male_dayi_uranus_bigtts, ...

## Speed bench: Seed TTS + Seedream (2026-07-21)

### TTS (same 7 segments, sequential)
- Edge: **9.60s** wall, timeline 60.26s
- Seed TTS 2.0: **9.11s** wall, timeline 59.15s
- Delta: Seed ~**5% faster** (almost same order)

### Image (infographic 9:16)
- Seedream / volcengine local generate.py: **31.13s** (success, ~268–308KB)
- Platform job `job_mrudu9pj_2uk7hc` Seedream: **47s** end-to-end success
- Platform job `job_mrudu9q4_r54fdm` Agnes: **~251s then failed** (HTTP timeout / read timeout)
- Earlier Seedream smoke `job_mrucj5e0_76z3wy`: **45s** success

### Full teaching video (Seed TTS)
- `job_mrud58ws_ojxbzu` total **335s**
- Stage est by mtime: TTS **8.5s**, scaffold **0.2s**, HyperFrames render **~325s**
- Conclusion: switching TTS/image does **not** materially change full-video wall time; render dominates.

### Takeaway
- Seedream is clearly faster & more reliable than Agnes in this environment for info-graphics.
- Seed TTS speed ≈ Edge; quality/voice variety is the main gain, not big latency win.
- To speed end-to-end video: optimize HyperFrames (already draft/fps20/workers6), not TTS.

## package_all speed compare (2026-07-21)

### Baseline
- job_mru76le9_vwj1xk: package_all / Agnes / Edge / draft / fps30 / 能量守恒定律
- total wall: **795s**

### New (default volcengine)
- job_mruh30o4_ii9j0x: package_all / Volcengine Seedream / Seed TTS / draft / fps20
- total wall: **353s** (~44% of baseline)
- stage est (mtime):
  - TTS (seed): ~seconds to tens of seconds class (from logs: storyboard->images_parallel quickly)
  - images_parallel (3 Seedream): completed before render; all 3 PNGs present
  - HyperFrames render still majority of remaining time (~5 min class)

### Default config
- DEFAULT_IMAGE_PROVIDER=volcengine
- system_config.default_image_provider=volcengine
- modelSnapshot.source.imageProvider=system confirmed on new job


## 2026-07-21 21:55 知识驱动分镜
- 重写 `server/services/storyboardBuilder.js`：knowledge pack / LLM / heuristic 三级知识落地
- 增加分镜质量门禁 `validateStoryboardQuality`（拒绝空模板套话）
- pipeline scaffold 后用 `fillTeachingIndexHtml` 填充卡片/公式/徽章，不再浅 TODO 替换
- 新增测试 `server/tests/storyboard-knowledge.test.js`；能量守恒定律前后对比通过
- env: `STORYBOARD_LLM_*` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL`（可选）

## 2026-07-21 22:27 动画缺口补齐
对比 linyuebanzi / ai-teaching-media 示例后确认此前缺失:
1. diagram-zone 真实 SVG（我们之前只有文字 callout）
2. scene2-6 GSAP 编排（之前只卡片滑入）
3. 持续动效（单摆/水轮机/能量箭头闪动等）

已新增 server/services/teachingSceneAnimator.js 并接入 pipeline。
能量守恒任务 job_mruqv0fg_6vy4xz 的 index.html 已验证包含 s2-cycle / s3-ball / s5-bob / s5-blades 等动画元素。

## 2026-07-21 22:40 零件库 + 多学科动画包
- 新增 `server/services/svgParts.js`（对照 svg-parts.md：电学/声学/力学/光学/生物流程链）
- 重写 `teachingSceneAnimator.js` 支持 family: energy/sound/math/light/force/electric/biology/generic
- 扩展知识包：光的折射、杠杆、欧姆定律、光合作用
- 测试 6/6 通过；worker 内路由抽检通过

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

## 2026-07-22 前端风格迁移发现

### 用户要求

- 仔细分析 `../genai-craft` 的前端技术栈和 CSS 样式。
- 当前项目整体前端改为参考项目风格。
- 业务逻辑、功能、接口与状态管理保持不变。

### 初步发现

- 两个项目都具有 React/Vite/TypeScript 前端入口，参考项目包含 `App.tsx`、`components/`、`services/` 等结构。
- 当前目录没有 `.git`，参考项目有 Git 元数据；本轮不能用当前项目的 Git diff 作为验收证据。
- 现有规划文件属于此前项目实施记录，本轮采用追加章节的方式保留历史。

### 技术栈与视觉对照

- 两端均为 React 19 + TypeScript + Vite 单页应用，当前项目无需切换框架。
- `genai-craft` 没有本地 Tailwind 包，而是在 `index.html` 用 Tailwind CDN；迁移将用现有 `styles.css` 实现等价视觉，避免增加生产环境 CDN 依赖。
- 参考项目全局背景为 `#0f111a`，主面板为 `#1c1f2e`，深层画布常用 `#090a0f` / `#161824`，边框使用 gray-800，文本以白色、gray-300/400/500 分级。
- 参考项目的常规主操作使用 blue-600/500，视频能力使用 purple-600，管理能力可使用 amber；布局为固定侧栏 + 内容滚动区，移动端切换为顶部/底部导航。
- 参考项目的组件特征包括：12–16px 左右圆角、1px 深灰边框、低饱和 hover、紧凑表单面板、明显的 active 导航状态。
- UI 设计系统检索给出的可执行校验项：正文对比度至少 4.5:1、可见焦点、交互目标约 44px、150–300ms 过渡、支持 reduced-motion，并检查 375/768/1024/1440px。

### 迁移策略

- 视觉以参考项目实际代码为准，不采用检索建议中的浅色青绿色方案。
- 不引入 Tailwind；重写本地 CSS 设计令牌，并为现有 JSX 增加少量语义结构/图标类。
- `services/api.ts`、业务 handler、状态、表单字段与条件渲染保持不变。
- 当前 `App.tsx` 的页面组件统一使用少量语义类：`card/grid/row/btn/badge/table`，因此可用 CSS 设计令牌覆盖绝大多数页面。
- 仍有少量浅色内联值集中在演示账号、资产详情、模型设置、知识点编辑状态等面板，需要逐个换成 CSS 变量，否则暗色主题下会突兀或对比不足。
- 当前移动端只是把侧栏变成横向滚动行；参考项目具有更清晰的移动导航模式，本轮会优化壳层标记与响应式布局。

### 首轮视觉验收

- 1440×1000：288px 固定侧栏、主内容左右留白、首页主入口与引擎面板比例稳定；无文字截断、遮挡或异常空白。
- 390×844：品牌栏与账户按钮不重叠，导航横向滚动，首页单列排列；H1、`ai-teaching-media` 和流程文本均能在容器内正确折行。
- 视觉已接近 `genai-craft`：`#0f111a` 背景、`#1c1f2e` 面板、gray 边框、blue active/CTA、purple 引擎强调及深色用户卡片。
- Chromium 为 Snap 包，截图实际落在 `/tmp/snap-private-tmp/snap.chromium/tmp/`；后续沿用该真实路径查看。

### 最终验证结论

- 1024 登录页、375 生成页、768 任务页均真实点击导航进入，active 状态正确。
- 1024 登录页 `scrollWidth/clientWidth=1024/1024`；375 生成页 `375/375`；768 任务页因纵向滚动条可视宽为 760，结果 `760/760`，均无整页横向溢出。
- 完整构建和 TypeScript 通过，开发服务 HTTP 200 且无控制台侧服务日志错误。
- 服务端测试 39/41：`model-settings.test.js` 内存配置写 `default_image_provider: agnes`，但断言无环境变量时期待 `volcengine`；`p4-regression.test.js` 未配置学生个人图片 Key，却期待收费图片 provider 任务创建成功。这两项与前端样式迁移无代码路径交集。
- 本轮产品代码变更集中在 `App.tsx`、`styles.css`、`package.json`、`package-lock.json`，构建同步更新 `dist/`；API service、后端、Worker 未修改。

## 2026-07-23 历史视频兼容发现

- 失败任务 `job_mrwb0101_ug2amu` 在 scaffold 45% 报 `未知 palette 'history'`；7 段 Seed TTS 音频已完成。
- `storyboardBuilder.js` 将 `history -> history`，但技能脚手架的 `PALETTES` 未包含 `history`，属于跨模块枚举不一致。
- “工业革命”未命中 `KNOWLEDGE_PACKS`，回退 heuristic 后生成“适用条件、变量关系”等理科模板套话；现有质量门禁仅做通用词面检查，误判为通过。
- 平台已有 history 动画 family 和历史时间轴零件，因此新增专用知识包后可以复用现有场景增强链路。

### 本轮技术决策

- `history` 使用低饱和勃艮第红主色、档案金强调、冷灰蓝结构色和纸张暖白背景，保持历史档案感并满足文本对比度。
- 同时实现专用工业革命知识包和历史学科泛化门禁：知识包解决当前主题质量，门禁防止其他未知历史主题悄悄产出理科套话。
- 现有历史包统一采用 `背景原因 → 过程节点 → 结果/影响 → 局限/评价 → 做题方法` 五子概念结构；工业革命将沿用该契约。
- junior-history 目录已为工业革命提供“蒸汽时代、生产力飞跃、社会变革”摘要和三个学习目标，但这些目录元数据不足以代替完整分镜知识包。
- 历史动画 family 已按场景提供时间轴、因果对比和方法卡，无需新增动画引擎或 SVG 基础设施。
- 现有 heuristic 的固定子概念会生成“成立条件、变量与不变量、量与量关系、条件-关系-回代”；这些词组适合构成 history 专属拒绝模式。
- 选定历史主题色：`#7A2E3A` 勃艮第红、`#9A641F` 档案金、`#F8F3EA` 纸张暖白、`#667085` 冷灰蓝；关键前景对比度分别达到 9.21、4.98、4.50，满足 WCAG 普通文本门槛。
- 工业革命实测生成 `knowledge_pack/history` 分镜，7 段为：引入、英国起点、机器生产、蒸汽时代、工厂与交通、双重影响、总结；质量门禁无错误和警告。
- 未知历史主题实测会同时报告 heuristic 来源错误和命中的历史理科模板词组，严格路径不再允许泛化内容进入 TTS。


## 学科与知识点目录（2026-07-22）

- 前端 dist 与 server 镜像不同步是常见“功能看不见”原因：改 App 后需 `npm run build`；改 server 后需重建 api/worker。
- `requireRole` 未定义会导致 API 崩溃→nginx 502。
- MySQL prepared statement `LIMIT ?` 可能报 Incorrect arguments，列表查询改为校验整型后插值。
- 编辑按钮“无反应”实际是表单在页面顶部；已改为右栏 sticky 编辑区。
