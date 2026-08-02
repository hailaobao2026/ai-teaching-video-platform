# 2026-08-01 功能与文档更新摘要

## 今日实现

1. 产品定位升级为“乡村课堂 AI 助教”。
2. 新增 AI 课堂助教：知识点检索、百炼/OpenAI-compatible 模型、本地知识库兜底和来源展示。
3. 一键备课新增教材版本、课堂场景、低带宽优先和乡村课堂模板。
4. 课堂播放新增大屏/全屏、视频下载与离线使用提示。
5. 新增真实试点证据闭环：备课耗时、学生前后测、教师评价、弱网/离线现场、草稿/提交/复核和汇总。
6. 新增百炼模型配置文档与 API Key 安全要求。

## 关键代码

- `App.tsx`
- `ruralPresets.ts`
- `server/services/ruralTeachingAssistant.js`
- `server/services/storyboardBuilder.js`
- `server/db.js`
- `server/index.js`
- `services/api.ts`
- `types.ts`

## 验证结果

- `server/tests/rural-teaching-assistant.test.js`：AI 助教检索与本地兜底。
- `server/tests/rural-pilot-evidence.test.js`：试点创建、校验、授权、权限隔离和汇总。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。

## 真实性边界

项目目前提供的是“真实数据采集、复核和统计工具”，不代表已经完成真实乡村学校试点。比赛材料仍需在线下取得授权并采集原始证明，系统不得生成或展示虚构成果。

## 2026-08-02 后续修复

1. 恢复并清理 `App.tsx` 的 UTF-8 中文文案，避免前端显示乱码。
2. 修复管理后台 provider 列表缺少逗号导致的 React 白屏问题。
3. 补齐模型设置个人凭证、`qwenimage`、乡村课堂参数、任务 `modelSnapshot` 和 Docker Compose 前端运行说明。
4. 更新架构、数据模型、API、流水线、启动、知识目录和路线图文档。

## 本次验证

- `npm run build`：通过。
- 文档乱码扫描与 `git diff --check -- docs`：本次修改后执行。
