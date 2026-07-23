# 里程碑计划

## M0 设计与脚手架
- [x] 产品/架构/API/数据模型文档
- [x] 前后端可运行骨架
- [x] Job + Worker + skill pipeline 适配层

## M1 闭环打通
- [x] 六类 skill 输出档位和统一资产登记
- [x] 任务创建、取消、重试、登出和资产查询 API
- [x] 内存模式 API 冒烟与前端生产构建
- [x] 用“能量守恒定律”端到端自动出片（teaching_video_full 已通）
- [x] 图片档位与 article_explainer_video 真实出片（2026-07-20/21）
- [x] package_all / tech_article_diagram 真实出片（2026-07-21）
- [ ] 任务进度 SSE/轮询优化
- [ ] 场景填充从 TODO 升级为模板库

## M2 教学运营
- [ ] 课程分类树完善
- [ ] 审核流 + 推荐位
- [ ] 播放量/收藏/再创作

## M3 生产化
- [x] MySQL 强制模式
- [ ] Redis 队列
- [ ] 对象存储
- [ ] 多 Worker 水平扩展

## 角色与审核（文档已确认，待开发）

- [x] 学生/教师/管理员角色与注册鉴权（P1 已落地，审核流仍待 P2）
- [ ] 注册选角色；教师选授课学科（**无邀请码**）
- [x] 教师按学科审核学生作品；教师作品仅管理员；无对口教师 fallback 管理员
- [ ] 用户管理与旧 `user` → **`student` 迁移**
- [ ] 越权详情统一 **404**；**学生全档位**生成；教师可自改学科（≥1）

### P1 状态

- 数据与鉴权已落地：角色/注册/me/profile/迁移
- 待 P2：教师按学科审核 API 与前端审核台

### P2 状态

- 审核流已落地：教师学科队列 / 管理员全量 / fallback
- 待 P3 增强：用户管理页、教师学科自改 UI 打磨

### P3 状态

- 用户管理 / 个人中心学科自改 / 审核意见展示已落地
- 待 P4：补齐越权与迁移自动化回归清单

### P4 状态

- [x] 自动化回归：`npm run test:p4`
- [x] 越权 404 / 学科隔离 / user→student 迁移 / 学生全档位

## 用户模型设置（§13 已确认，M2–M4 已实现）

- [x] `user_model_settings` 表与 API（catalog/me get-put-reset）
- [x] 创建任务写入 `modelSnapshot`；pipeline 读取用户 TTS/图片/视频质量
- [x] 前端个人中心「模型设置」+ 创建页生效摘要/覆盖
- [ ] 管理员系统默认与 allowlist
- 详见 `docs/user-model-settings.md`

### 用户模型设置确认摘要

1. 视频首期仅 HyperFrames  
2. 学生可选用付费 provider（allowlist + 平台 Key）  
3. 首期不做管理员代改他人设置  
4. 全局偏好（非按档位分套）  
5. 默认 videoQuality=`standard`  


## 学科与知识点目录（2026-07-22）

- [x] subjects / knowledge_points 表与公开 catalog API
- [x] 管理端独立菜单「学科与知识点」+ 左右分栏编辑
- [x] 一键同步动画知识包（KNOWLEDGE_PACKS）
- [x] mathviz 数学入门/基础批次入库
- [x] ChemAIForge 化学 102 实验入库
- [x] 初中语文 / 英语 / 历史 / 地理 / 政治知识库入库
- [x] 年级字典扩展 grade1–grade12
- [ ] 小学语文/英语系统化批次
- [ ] 高中各科系统化批次
- [ ] 知识点与专用动画零件更细粒度关联（visual 关键词自动装配增强）
