# AI 教学媒体系统实施计划

## 目标

将 `skills_collection/ai-teaching-media` 的六类能力封装为可登录、可异步执行、可审核分享的 Web 系统，技术形态对齐 `genai-craft` 的 React/Vite + Express + MySQL + 独立 Worker 架构。

## 阶段

- [x] 读取六个子 skill、参考架构和现有项目
- [x] 审计现有 API、数据库、前端和 Worker
- [x] 补齐 PRD、架构、概要、详细、数据库与运行文档
- [x] 实现六类输出档位和资产入库
- [x] 补齐任务取消、登出、资产查询与筛选接口
- [x] 构建、API 冒烟和 Worker 命令链验证
- [x] 复制/同步到用户指定的 `/mnt/f/work/code/github/wwwzhouhui` 目录

## 验收标准

- [x] 无 API Key 时，创建任务仍能入队，Worker 失败信息明确且可重试；不静默伪造成功。
- [x] `teaching_video_full` 真实执行 storyboard → TTS → scaffold → HyperFrames → MP4（2026-07-20 已验证：能量守恒定律，68s/1080p）。
- [x] `infographic_only`、`short_video_cover`、`image_generation` 真实生成并登记 PNG/JSON（2026-07-20 已验证，Agnes）。
- [x] `package_all`、`tech_article_diagram` 完整 E2E（2026-07-21 已验证）。
- [x] `article_explainer_video` 真实完成文章分镜 → TTS → scaffold → HyperFrames（2026-07-21 已验证：光合作用简说，约 40s/1080p）。
- [x] 任务、课程和资产在内存模式与 MySQL 模式拥有一致公开字段（内存已验证；MySQL 运行时 2026-07-21 已验证：schema/login/job claim，image 任务见 progress）。
- [x] `npm test`、`npm run build`、TypeScript、Node 语法检查和 API 冒烟通过。

## 复核记录（2026-07-19）

- [x] 发现并修复内存模式 API/Worker 跨进程缓存导致的失败状态不可见问题。
- [x] 真实 Worker 无 Key 路径：`queued → running → failed`，API 可读错误并可 `retry`。
- [x] 验证任务状态筛选/分页、管理员任务列表、资产详情权限和 404 行为。
- [x] 验证密码哈希、会话过期、配置跨进程可见、输入校验和 Docker Compose 配置。
- [x] 清理本轮测试产生的内存任务与会话记录。


## 复核记录（2026-07-20/21 P1）

- [x] API/Worker 启动脚本：`scripts/start-api.sh` / `start-worker.sh` / `stop-services.sh` / `status-services.sh` + `server/loadEnv.js`
- [x] 图片档位真实 PNG：`image_generation` / `infographic_only` / `short_video_cover`
- [x] 修复 `articleStoryboardBuilder`（numeric chapter id + panels/statement，避免 scaffold 崩溃）
- [x] `article_explainer_video` 真实出片
- [x] MySQL 运行时联调（DaoCloud 镜像 + 3013 栈；见 progress 2026-07-21 P2）

- [x] tech_article_diagram：串行生图 + 部分成功可入库；默认 notebook 风格降低 edit/i2i 压力
- [x] package_all：视频 + infographic + cover + diagram 全资产入库

- [x] 用户模型设置 M2–M4（DB/API/pipeline/前端/测试）


## 学科与知识点目录

- [x] 表结构 subjects / knowledge_points
- [x] 管理端独立菜单与左右分栏编辑
- [x] 批量同步接口与种子 JSON
- [x] 初中语/英/史/地/政 + ChemAIForge + mathviz 入库
- [x] docs 同步更新

## 2026-07-22 前端风格迁移

### Phase: Frontend style migration

**Status:** complete

### 目标

在不改变路由、接口、状态管理和业务交互的前提下，将当前前端的布局、设计令牌、组件观感与响应式体验迁移为 `../genai-craft` 的视觉风格。

### 阶段

- [x] 对比两个项目的技术栈、页面结构、字体、色彩、间距与组件样式
- [x] 确定可复用视觉规则及当前页面的映射方式
- [x] 实施全局样式、壳层、导航和业务页面视觉迁移
- [x] 构建、类型检查并进行桌面/移动端浏览器验收
- [x] 记录改动与验证结果

### 约束

- 保持 `services/api.ts`、接口字段、权限、状态流转和用户操作逻辑不变。
- 不向仓库写入 API Key。
- 遵循现有 React/Vite 技术栈，不为纯视觉迁移引入不必要框架。

### 本轮错误

| 错误 | 尝试 | 处置 |
|------|------|------|
| 当前目录不是 Git 仓库，`git status` 无法使用 | 1 | 改用文件清单、内容对比和构建验证记录改动；不重复执行该命令 |
| 首次追加规划补丁因历史文件末尾上下文不匹配而未应用 | 1 | 分别读取文件准确尾部后再追加 |
| 提取 JSX 结构的 `rg` 命令含未正确转义的反引号，shell 解析失败 | 1 | 改用不匹配模板字面量的独立查询；其余并行查询均成功 |
| Chromium 截图落盘与同一 shell 内的 `file/ls` 检查出现时序差异 | 1 | 后续将截图命令与文件检查拆成独立步骤 |
| CSS 检索正则以 `--bg` 开头，被 `rg` 识别为未知参数，导致并行校验批次结果不完整 | 1 | 后续查询使用 `rg -e`；拆开重跑 TypeScript 与构建 |
| 完整服务端测试 41 项中 2 项失败：默认图片 provider 为 `agnes`（测试期望 `volcengine`）；学生生图未配置个人 Key 返回 400 | 1 | 判定与本轮前端文件无关；读取失败测试的隔离环境设置后决定是否可安全定向复跑 |
| 规划完成检查首次返回 0/0 | 1 | 项目历史计划不是脚本识别的 Phase/Status 格式；为本轮补充一个可机器识别的完成阶段 |

### 验收结果

- [x] `npx tsc --noEmit`
- [x] `npm run build`（1580 modules；CSS 12.69 kB；JS 276.95 kB）
- [x] 1440×1000 首页、1024×900 登录页、768×900 任务页、390×844 首页、375×812 生成页浏览器截图
- [x] 1024/768/375 页面宽度均满足 `scrollWidth === clientWidth`
- [x] 导航点击、active 状态、登录入口、响应式表单/表格布局验证
- [x] 开发服务 `http://127.0.0.1:4173/` 返回 HTTP 200 且无运行时日志错误
- [ ] 全部服务端测试通过：实际 39/41；2 项为现行 provider/个人凭证规则与旧测试断言不一致，和本轮前端修改无关

## 2026-07-23 历史视频兼容与工业革命知识包

### Phase: History palette and Industrial Revolution knowledge

**Status:** complete

### 目标

让历史学科分镜可以通过 `ai-teaching-media` 脚手架，并让“工业革命”使用教材化结构化知识而不是泛化 heuristic 模板。

### 阶段

- [x] 定位 `history` 配色缺失与工业革命泛化分镜原因
- [x] 新增 `history` 配色、文档和脚手架回归测试
- [x] 新增工业革命知识包及历史泛化质量门禁测试
- [x] 运行技能校验、定向测试和完整相关测试
- [x] 验证 Worker 可见修改，并给出失败任务重试条件

### 验收标准

- `palette: history` 可生成 `index.html`，并写入历史主题 CSS 变量。
- “工业革命”分镜包含英国起点、蒸汽动力、工厂制度、交通革新和双重影响等真实知识锚点。
- 历史学科分镜中的“适用条件/变量关系/套公式”等泛化表述不能通过严格质量门禁。
- `quick_validate.py`、技能回归测试和服务端分镜测试通过。

### 本轮错误

| 错误 | 尝试 | 处置 |
|------|------|------|
| `npm test -- --test-name-pattern` 参数位于测试文件通配之后，未筛选到目标分镜测试 | 1 | 改为直接运行 `node --test tests/storyboard-knowledge.test.js` |
| 从平台目录用技能相对路径执行 `rg`，4 个技能路径不存在 | 1 | 后续在技能根目录执行检查；代码与测试未受影响 |
| 检查测试提前结束原因时误读不存在的 `admin-api.test.js` | 1 | 依据实际文件清单改读 `admin-users.test.js` 与 `course-delete.test.js` |
| 当前 `npm --prefix server test` 只执行前两个测试文件后成功退出 | 1 | 相关测试已直接运行 11/11；完整套件改为逐文件循环执行 |
| 完整服务端逐文件测试 42 项中 2 项失败 | 1 | 失败仍为既有 provider/个人图片 Key 测试假设，和本轮修改无代码交集；本轮相关 11/11 通过 |
| 容器健康检查请求 `/api/health` 返回 404 | 1 | 读取路由确认实际端点为 `/health`，改用正确路径复核 |
