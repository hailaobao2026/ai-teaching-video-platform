# AGENTS.md

本项目是 K12 教学视频生成与分享平台。

- 生成核心：本地 skill `ai-teaching-media`
- 参考架构：`../genai-craft`
- 默认不要把 API Key 写入仓库
- Worker 是重 CPU 任务，开发时单独进程运行

关键路径：
- `server/services/teachingMediaPipeline.js`
- `server/workers/teachingMediaWorker.js`
- `docs/architecture.md`
