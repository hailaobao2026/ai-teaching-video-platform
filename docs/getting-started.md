# 开发启动说明

## 1. 内存模式（最快验证 API/页面）
```bash
cd /mnt/f/work/code/github/xiaohuihui202504/ai-teaching-video-platform
cp .env.example .env
# MySQL 首次启动时配置 ADMIN_EMAIL / ADMIN_PASSWORD
cd server && npm install && npm run dev
# 新开终端
cd server && npm run worker
# 新开终端
cd .. && npm install && npm run dev
```

打开 http://localhost:3000
演示账号：teacher@demo.local / demo123

如果当前 Node 环境没有生成 `.bin` shim，也可以直接运行 `node node_modules/vite/bin/vite.js`。

## 2. 真实生成
确保：
- TEACHING_MEDIA_ROOT 指向 skills_collection/ai-teaching-media
- python / ffmpeg / npx hyperframes 可用
- edge-tts 已安装（或配置 Minimax）

Worker 会把成功视频写到：
`server/uploads/videos/<jobId>.mp4`

## 3. 与 genai-craft 对齐点
- React + Vite 前端
- Express API :3002
- 用户/会话/管理后台
- 作品（课程）公开广场
- Docker compose 多服务

差异：生成引擎是 ai-teaching-media，不是 Sora 直连接口。


## 4. 推荐：脚本启动后端（更稳）

项目在 Windows 盘符挂载（如 `/mnt/f/...`）时，直接在该盘跑 API/Worker 可能出现启动慢或端口不监听。推荐：

```bash
# 内存模式默认把 MEMORY_DB_FILE / ARTIFACTS_ROOT / logs 放到 /tmp/atv-run
npm run start:backend
# 或
bash scripts/start-api.sh
bash scripts/start-worker.sh
bash scripts/status-services.sh
bash scripts/stop-services.sh
```

真实渲染还需要：
- `TEACHING_MEDIA_ROOT`
- `HYPERFRAMES_BROWSER_PATH`（chrome-headless-shell）
- `DEFAULT_IMAGE_PROVIDER=agnes` + `AGNES_API_KEY`（图片档位）
- `edge-tts` / `PYTHONPATH`


## 5. MySQL 运行时（宿主进程 + Docker MySQL）

当 Docker Hub 不可用时：

```bash
docker pull docker.m.daocloud.io/library/mysql:8.0
docker tag docker.m.daocloud.io/library/mysql:8.0 mysql:8.0
docker run -d --name atv-mysql \
  -e MYSQL_ROOT_PASSWORD=atv123456 \
  -e MYSQL_DATABASE=ai_teaching_video \
  -e MYSQL_USER=atv -e MYSQL_PASSWORD=atv123456 \
  -p 3307:3306 mysql:8.0 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

启动与内存栈隔离的 MySQL 后端（默认 API `:3013`）：

```bash
bash scripts/sync-server-run.sh
bash scripts/start-mysql-stack.sh
# 等价：USE_MYSQL=true PORT=3013 MYSQL_PORT=3307 MYSQL_USER=atv MYSQL_PASSWORD=atv123456 ...
bash scripts/status-services.sh
```

演示账号：`teacher@demo.local` / `demo123`

停止仅 MySQL 栈（注意 LOG_DIR）：

```bash
LOG_DIR=/tmp/atv-run/mysql-run bash scripts/stop-services.sh
```


## 6. 守护与重启

```bash
bash scripts/restart-services.sh
# 可选：简单看门狗（前台循环）
bash scripts/watchdog-services.sh
```

说明：
- `dev-env.sh` 会保留调用方已 export 的 `PORT/USE_MYSQL/MYSQL_*`，避免被根目录 `.env` 覆盖。
- 推荐 `ATV_SERVER_DIR=/tmp/atv-server-run`，改代码后先 `npm run sync:server-run` 再 restart。


## 7. 一键 Compose MySQL 栈（推荐交付）

仅 MySQL 容器 + 宿主 API/Worker：

```bash
npm run compose:mysql
npm run start:mysql-stack   # API :3013 by default
```

完整 compose（mysql + api + worker 容器）：

```bash
# 可选：Docker Hub 不通时
# export MYSQL_IMAGE=docker.m.daocloud.io/library/mysql:8.0
# Docker Hub 不通时指定镜像源
# export NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm
# export MYSQL_IMAGE=docker.m.daocloud.io/library/mysql:8.0
npm run compose:up
# 带前端：WITH_WEB=1 # Docker Hub 不通时指定镜像源
# export NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm
# export MYSQL_IMAGE=docker.m.daocloud.io/library/mysql:8.0
npm run compose:up
npm run compose:down
```

默认：
- API `http://127.0.0.1:3002`
- MySQL host `127.0.0.1:3307`
- 演示账号 `teacher@demo.local` / `demo123`（可用 `.env` 覆盖）


## 8. Agnes 超时 / 重试上限

Worker 生图会注入：

| 变量 | 默认 | 含义 |
|---|---|---|
| `AGNES_HTTP_TIMEOUT` | 90 | 单次 HTTP 超时（秒） |
| `AGNES_HTTP_RETRIES` | 1 | 503/网关重试次数 |
| `IMAGE_GEN_TIMEOUT_MS` | ~225000 | generate.py 进程硬超时（毫秒） |

超时后任务应进入 `failed`，可 `retry`，不会永久 `running`。

## 9. MySQL 冒烟脚本

```bash
# 先确保 MySQL 栈在 :3013
npm run start:mysql-stack
# 或仅测失败路径（短超时）
# AGNES_HTTP_TIMEOUT=5 IMAGE_GEN_TIMEOUT_MS=8000 SMOKE_ALLOW_FAILED=1 npm run smoke:mysql
npm run smoke:mysql
```


## 10. Compose 故障排查

```bash
# 推荐（不污染开发 .env）
docker compose --env-file .env.compose up -d --build
# 或
npm run compose:up

# Docker Hub 不通
export NODE_IMAGE=docker.m.daocloud.io/library/node:22-bookworm
export MYSQL_IMAGE=docker.m.daocloud.io/library/mysql:8.0
```

常见错误：
- `cannot replace ... node_modules/hyperframes with file` → 已用 `.dockerignore` 修复，请拉取最新 Dockerfile。
- `MYSQL_USER="root" ... cannot be used for the root user` → 使用 `.env.compose` / `MYSQL_APP_USER=atv`。
- `Duplicate entry teacher@demo.local` → 已在 `initDb` 幂等处理。

## RBAC 回归（P4）

```bash
npm run test:p4
# 或
npm --prefix server run test:p4
```

覆盖：旧 `user→student` 迁移登录、禁止注册 admin、学生 7 档位建任务、教师学科隔离/404、教师作品仅管理员、无对口教师 fallback、审核意见回写、教师学科自改校验。


## 学科与知识点管理

1. 使用管理员账号登录（默认 `teacher@demo.local` / `demo123`）。
2. 左侧打开 **学科与知识点**。
3. 可筛选学科、搜索知识点；右侧编辑表单固定显示。
4. 一键同步按钮：
   - 动画知识包
   - ChemAIForge 化学(102)
   - 初中语文 / 英语 / 历史 / 地理 / 政治
5. 生成页「章节 / 知识点」可下拉选择或关键字匹配，无需手输全部内容。

Compose 注意：

```bash
# 后端代码变更后需重建镜像（server/ 默认不挂载）
docker compose --env-file .env.compose up -d --build api worker

# 前端变更后重建静态资源（web 挂载 ./dist）
npm run build
```

详见 `docs/knowledge-catalog.md` 与 `docs/api.md`。
