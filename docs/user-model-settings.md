# 用户模型设置需求与设计文档

> 文档状态：**已确认（§13 产品决策已锁定）· M2–M4 已实现**  
> 创建日期：2026-07-21  
> 确认日期：2026-07-21  
> 说明：确认后再进入实现阶段。  
> 关联：`docs/PRD.md`、`docs/product.md`、`docs/api.md`、`docs/data-model.md`、`docs/pipeline.md`、`docs/architecture.md`  
> 适用角色：学生 / 教师 / 管理员

---

## 1. 背景与目标

### 1.1 现状问题

当前模型相关配置主要分两层：

1. **平台/环境默认**：`DEFAULT_TTS_PROVIDER`、`DEFAULT_IMAGE_PROVIDER`、`HYPERFRAMES_QUALITY` 等。
2. **管理员系统配置**：`/api/admin/config`（全站默认 TTS/图片 provider、音色、渲染质量）。
3. **任务级零散覆盖**：创建任务时可传 `imageProvider`，TTS/视频渲染仍主要吃全站默认。

结果是：

- 学生/教师无法按自己需求固定偏好；
- 文生视频链路缺少用户可选模型/渲染档位；
- 管理员只能改全站默认，无法区分“平台兜底”与“个人偏好”。

### 1.2 目标

为 **学生、教师、管理员** 提供统一的 **模型设置** 能力，使用户可按需配置：

| 能力域 | 用户可配置项（首期） |
|---|---|
| TTS 语音合成 | provider、voice、语速（可选） |
| 文生图片 | provider、默认风格/比例（可选） |
| 文生视频 / 教学动画渲染 | 渲染引擎（首期 HyperFrames）、质量档位、默认输出档位偏好 |

创建生成任务时，按 **任务覆盖 > 用户模型设置 > 系统配置 > 环境变量** 解析最终模型。

### 1.3 非目标（本轮不做）

- 用户自带/粘贴第三方 API Key 明文存库（安全风险高，见 §8）
- 完整多云视频大模型实时生成（Sora/Runway 等）作为默认主链路
- 按学校/班级统一下发模型策略（可后续）
- 计费与额度扣减（仅预留字段）

---

## 2. 角色与权限

| 能力 | 学生 | 教师 | 管理员 |
|---|:---:|:---:|:---:|
| 查看自己的模型设置 | ✅ | ✅ | ✅ |
| 修改自己的模型设置 | ✅ | ✅ | ✅ |
| 恢复系统默认 | ✅ | ✅ | ✅ |
| 查看平台可用模型目录 | ✅ | ✅ | ✅ |
| 修改全站默认模型（系统配置） | ❌ | ❌ | ✅ |
| 启用/禁用某 provider 对普通用户开放 | ❌ | ❌ | ✅ |
| 代看/代改其他用户模型设置 | ❌ | ❌ | ❌（首期）；二期再评估 |

说明：

- **三类角色都有“个人模型设置”**，入口在个人中心。
- 管理员额外保留现有 **系统配置**，作为无用户偏好时的兜底。

---

## 3. 功能需求

### 3.1 模型设置页（个人中心）

路径建议：`个人中心 → 模型设置`（或独立菜单「模型设置」）。

页面分组：

1. **TTS 模型**
2. **文生图片模型**
3. **文生视频 / 教学动画模型**
4. **偏好与高级**（可选折叠）

每组展示：

- 当前生效值（用户设置 / 继承系统默认）
- 可选列表（仅显示对当前角色开放且平台已配置凭据的项）
- 保存 / 重置为系统默认
- 简要说明（费用、速度、质量提示，文案级）

### 3.2 TTS 配置项

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `ttsProvider` | enum | TTS 服务商 | `edge` / `minimax` / `say` |
| `ttsVoice` | string | 音色 ID | `zh-CN-XiaoxiaoNeural` |
| `ttsSpeed` | number | 语速，可选，默认 1.0 | `0.8~1.5` |
| `ttsEnabled` | bool | 是否启用自定义；false 表示完全跟随系统 | `true` |

业务规则：

1. `ttsProvider=edge` 时，`ttsVoice` 必须属于 Edge 音色白名单。
2. `ttsProvider=minimax` 时，平台需具备 `MINIMAX_API_KEY`；否则该选项对用户灰显/不可选。
3. 无效组合保存时返回 400。

### 3.3 文生图片配置项

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `imageProvider` | enum | 生图服务商 | `agnes` / `mulerun` / `apimart` / `atlascloud` |
| `imageStyle` | string | 默认风格，可选 | `cozy-handdrawn` |
| `imageAspectRatio` | string | 默认比例偏好，可选 | `16:9` / `9:16` / `3:4` |
| `imageEnabled` | bool | 是否启用自定义 | `true` |

业务规则：

1. 仅展示平台已配置对应 API Key 的 provider。
2. 任务若显式传 `imageProvider`，优先任务值。
3. 信息图/封面等档位仍可按产物强制比例，用户比例仅作默认偏好。

### 3.4 文生视频 / 教学动画配置项

> 说明：当前主链路是 **HTML 分镜 + TTS + HyperFrames 渲染**，不是通用“文本直出视频大模型”。  
> 本需求把“视频生成相关可选项”统一收口为用户可配的 **视频模型/渲染设置**，并为未来视频大模型预留扩展。

| 字段 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `videoProvider` | enum | 视频生成/渲染引擎 | 首期：`hyperframes`；预留：`external_t2v` |
| `videoQuality` | enum | 渲染质量 | `draft` / `standard` / `high` |
| `videoFps` | number | 可选，默认 30 | `24/30` |
| `preferredOutputProfile` | enum | 创建页默认输出档位 | `teaching_video_full` 等 |
| `videoEnabled` | bool | 是否启用自定义 | `true` |

业务规则：

1. 首期 `videoProvider` 仅开放 `hyperframes`（本地可控、已打通）。
2. `videoQuality` 映射现有 `HYPERFRAMES_QUALITY` / pipeline quality。
3. `preferredOutputProfile` 只影响创建页默认值，不限制用户改选其他档位。
4. 若未来接入文生视频大模型：
   - 新增 provider 到目录；
   - 任务 `outputProfile` 可扩展 `t2v_clip` 等；
   - 仍走 Job/Worker 异步。

### 3.5 创建任务时的生效逻辑

解析优先级（高 → 低）：

1. **任务请求体显式字段**（`imageProvider` / 未来 `ttsProvider` / `videoQuality`）
2. **用户模型设置**（enabled=true 的字段）
3. **系统配置** `system_config`
4. **环境变量默认**

写入 Job 时必须固化快照，避免用户事后改设置导致历史任务语义变化：

```json
{
  "modelSnapshot": {
    "ttsProvider": "edge",
    "ttsVoice": "zh-CN-XiaoxiaoNeural",
    "ttsSpeed": 1.0,
    "imageProvider": "agnes",
    "imageStyle": "cozy-handdrawn",
    "videoProvider": "hyperframes",
    "videoQuality": "draft",
    "source": {
      "ttsProvider": "user",
      "imageProvider": "task",
      "videoQuality": "system"
    }
  }
}
```

`source` 用于审计：值来自 `task|user|system|env`。

### 3.6 可用模型目录

系统提供只读目录接口，前端用于渲染下拉框：

- provider 是否对当前用户可见
- 是否已配置平台凭据（ready）
- 推荐标签、说明、适用场景

管理员可在系统配置中设置：

- `models.tts.allowlist`
- `models.image.allowlist`
- `models.video.allowlist`

未在 allowlist 中的 provider 不对普通用户展示（管理员可看全量用于排障）。

---

## 4. 用户故事

1. **学生固定 Edge 音色**  
   学生在模型设置中选择 TTS=`edge` + 音色「晓晓」，之后每次生成教学视频都用该音色，无需每次填写。

2. **教师偏好 Agnes 生图**  
   教师设置图片 provider=`agnes`，生成 `package_all` 时信息图/封面走 Agnes；若某次任务临时改 `imageProvider=mulerun`，仅该任务覆盖。

3. **管理员降级渲染质量做调试**  
   管理员个人设置 `videoQuality=draft`，自己的试跑更快；全站默认仍可保持 `standard`。

4. **无 Key 的 provider 不可选**  
   平台未配置 Minimax Key 时，用户设置页 TTS 不展示/禁用 minimax，并提示“平台未开通”。

5. **恢复默认**  
   用户点击“恢复系统默认”后，个人设置清空/disabled，后续跟随管理员系统配置。

---

## 5. 数据模型设计

### 5.1 新表 `user_model_settings`（推荐）

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | varchar(64) PK/FK | 用户 ID |
| tts_provider | varchar(32) null | |
| tts_voice | varchar(64) null | |
| tts_speed | decimal(4,2) null | |
| tts_enabled | tinyint/bool | 默认 false |
| image_provider | varchar(32) null | |
| image_style | varchar(64) null | |
| image_aspect_ratio | varchar(16) null | |
| image_enabled | tinyint/bool | 默认 false |
| video_provider | varchar(32) null | 默认 null |
| video_quality | varchar(16) null | draft/standard/high |
| video_fps | int null | |
| preferred_output_profile | varchar(64) null | |
| video_enabled | tinyint/bool | 默认 false |
| extra_json | json null | 扩展 |
| updated_at | datetime | |
| created_at | datetime | |

内存模式等价结构：

```json
{
  "user_model_settings": {
    "user_xxx": {
      "ttsEnabled": true,
      "ttsProvider": "edge",
      "ttsVoice": "zh-CN-XiaoxiaoNeural",
      "imageEnabled": true,
      "imageProvider": "agnes",
      "videoEnabled": true,
      "videoProvider": "hyperframes",
      "videoQuality": "draft",
      "preferredOutputProfile": "teaching_video_full"
    }
  }
}
```

### 5.2 `system_config` 扩展键

| key | 说明 |
|---|---|
| `default_tts_provider` | 已有 |
| `default_edge_voice` | 已有 |
| `default_image_provider` | 已有 |
| `hyperframes_quality` | 已有/对齐 videoQuality 默认 |
| `default_video_provider` | 新增，默认 `hyperframes` |
| `models.tts.allowlist` | 新增 |
| `models.image.allowlist` | 新增 |
| `models.video.allowlist` | 新增 |
| `models.catalog_version` | 新增，目录版本号 |

### 5.3 `generation_jobs.input_json` 扩展

保留现有字段，新增：

- `ttsProvider` / `ttsVoice` / `ttsSpeed`（任务级可选覆盖）
- `videoProvider` / `videoQuality`
- `modelSnapshot`（服务端写入，只读回显）

### 5.4 不落库内容

- 任何用户 API Key
- provider 原始密钥
- 临时调试 token

---

## 6. 接口设计

### 6.1 获取平台模型目录

`GET /api/models/catalog`

鉴权：登录用户。

响应示例：

```json
{
  "tts": [
    {
      "provider": "edge",
      "label": "Edge TTS",
      "ready": true,
      "voices": [
        { "id": "zh-CN-XiaoxiaoNeural", "label": "晓晓（女）" },
        { "id": "zh-CN-YunxiNeural", "label": "云希（男）" }
      ],
      "roles": ["student", "teacher", "admin"]
    },
    {
      "provider": "minimax",
      "label": "Minimax TTS",
      "ready": false,
      "reason": "MINIMAX_API_KEY 未配置",
      "voices": [],
      "roles": ["teacher", "admin"]
    }
  ],
  "image": [
    { "provider": "agnes", "label": "Agnes", "ready": true, "roles": ["student", "teacher", "admin"] }
  ],
  "video": [
    {
      "provider": "hyperframes",
      "label": "HyperFrames 教学动画渲染",
      "ready": true,
      "qualities": ["draft", "standard", "high"],
      "roles": ["student", "teacher", "admin"]
    }
  ],
  "outputProfiles": ["teaching_video_full", "package_all", "infographic_only", "..."]
}
```

### 6.2 获取我的模型设置

`GET /api/me/model-settings`

响应：

```json
{
  "settings": {
    "ttsEnabled": true,
    "ttsProvider": "edge",
    "ttsVoice": "zh-CN-XiaoxiaoNeural",
    "ttsSpeed": 1.0,
    "imageEnabled": false,
    "imageProvider": null,
    "videoEnabled": true,
    "videoProvider": "hyperframes",
    "videoQuality": "draft",
    "preferredOutputProfile": "teaching_video_full"
  },
  "effective": {
    "ttsProvider": "edge",
    "ttsVoice": "zh-CN-XiaoxiaoNeural",
    "imageProvider": "agnes",
    "videoProvider": "hyperframes",
    "videoQuality": "draft"
  },
  "systemDefaults": {
    "ttsProvider": "edge",
    "ttsVoice": "zh-CN-XiaoxiaoNeural",
    "imageProvider": "agnes",
    "videoProvider": "hyperframes",
    "videoQuality": "standard"
  }
}
```

`effective` = 按优先级解析后的“当前会用于新任务”的值，便于 UI 展示。

### 6.3 更新我的模型设置

`PUT /api/me/model-settings`

```json
{
  "ttsEnabled": true,
  "ttsProvider": "edge",
  "ttsVoice": "zh-CN-YunxiNeural",
  "imageEnabled": true,
  "imageProvider": "agnes",
  "videoEnabled": true,
  "videoProvider": "hyperframes",
  "videoQuality": "standard",
  "preferredOutputProfile": "package_all"
}
```

规则：

- 部分更新或全量更新均可（建议 PUT 全量分组提交，PATCH 可选）。
- 校验失败 400；无登录 401。
- 成功返回与 GET 相同结构。

### 6.4 重置我的模型设置

`POST /api/me/model-settings/reset`

- 清空用户自定义（或全部 enabled=false）
- 之后 effective 完全跟随系统默认

### 6.5 创建任务接口扩展

`POST /api/jobs` 增加可选字段：

```json
{
  "ttsProvider": "edge",
  "ttsVoice": "zh-CN-XiaoxiaoNeural",
  "ttsSpeed": 1.0,
  "imageProvider": "agnes",
  "videoProvider": "hyperframes",
  "videoQuality": "draft"
}
```

服务端：

1. 读取用户设置 + 系统默认；
2. 应用任务覆盖；
3. 调 preflight 校验依赖；
4. 写入 `input_json.modelSnapshot`。

### 6.6 管理员

保留：

- `GET/PUT /api/admin/config`

新增（**二期**，首期不做）：

- `GET /api/admin/users/:id/model-settings`
- `PUT /api/admin/users/:id/model-settings`（代管）

### 6.7 错误码

| HTTP | 场景 |
|---|---|
| 400 | provider/voice/quality 非法，或 provider 未开通 |
| 401 | 未登录 |
| 403 | 角色不允许使用该 provider（allowlist） |
| 409 | 目录版本过旧（可选，前端缓存失效） |

---

## 7. 前端信息架构

### 7.1 入口

- 所有角色：`个人中心` 增加 Tab/子页 **模型设置**
- 创建任务页：展示“当前生效模型”摘要 + 「去修改」链接
- 管理员：系统配置页增加“全站默认模型 / allowlist”

### 7.2 创建页交互

- 默认带出用户 `preferredOutputProfile`、effective providers
- 高级选项折叠：TTS / 图片 / 视频质量临时覆盖
- 提交前 preflight：若用户选了未 ready 的 provider，前端拦截并提示

### 7.3 任务详情

- 只读展示 `modelSnapshot`（本次实际使用模型）
- 便于排障：失败时知道走了哪个 provider/quality

---

## 8. 安全与合规设计

1. **密钥仅服务端环境变量/密钥管理**，用户设置只存 provider 名称与参数，不存 Key。  
2. 用户不可通过设置绕过 allowlist 使用未授权 provider。  
3. preflight 与创建任务双校验，防止前端篡改。  
4. 日志可记录 provider 名，禁止记录密钥与完整 prompt 中的敏感信息（沿用现有脱敏策略）。  
5. 若二期支持“用户自带 Key”：
   - 必须加密存储（KMS/应用层加密）
   - 默认关闭
   - 仅教师/管理员可选
   - 需要单独安全评审（本轮明确不做）

---

## 9. 后端与流水线设计

### 9.1 解析服务

新增 `server/services/modelSettings.js`（建议）：

- `getCatalog(user)`
- `getUserSettings(userId)`
- `getEffectiveModelConfig(userId, taskInput, systemConfig)`
- `validateModelSettings(patch, catalog)`

### 9.2 Worker / Pipeline 改动点

| 阶段 | 读取字段 |
|---|---|
| TTS | `modelSnapshot.ttsProvider/ttsVoice/ttsSpeed` |
| 生图 | `modelSnapshot.imageProvider`（及 style 偏好） |
| 渲染 | `modelSnapshot.videoQuality` → hyperframes `--quality` |
| 预检 | preflight 使用 effective providers，而不是只看 env 默认 |

### 9.3 兼容策略

- 无用户设置记录：行为与现网一致。
- 旧任务无 `modelSnapshot`：详情页显示“历史任务未记录快照”。
- 管理端系统配置继续生效，作为兜底。

---

## 10. 状态与默认值

### 10.1 平台默认（可被管理员改）

| 项 | 默认 |
|---|---|
| TTS | `edge` + `zh-CN-XiaoxiaoNeural` |
| 图片 | `agnes`（若 Key 存在） |
| 视频 | `hyperframes` + **`standard`**（开发/compose 可显式改为 draft） |

### 10.2 用户新建设置默认

- 所有 `*Enabled=false`
- 字段 null
- UI 显示“跟随系统：xxx”

---

## 11. 验收标准（DoD）

1. 学生/教师/管理员均可进入模型设置并保存成功。  
2. 用户设置 TTS 后，新建教学视频任务 TTS 使用该 provider/voice。  
3. 用户设置 imageProvider 后，生图档位使用该 provider；任务级覆盖优先生效。  
4. 用户设置 videoQuality=draft 后，HyperFrames 以 draft 渲染。  
5. 未开通 Key 的 provider 不可被保存为启用状态。  
6. 重置后恢复系统默认。  
7. Job 详情可看到 modelSnapshot。  
8. 自动化测试覆盖：优先级解析、校验失败、目录 ready 过滤、三角色可读写自己的设置。  

---

## 12. 实施分期建议

| 阶段 | 内容 | 预估 |
|---|---|---|
| M1 文档确认 | 本文档评审 + §13 决策锁定 | **已完成** |
| M2 数据与 API | `user_model_settings`、catalog/effective/put/reset | **已完成** |
| M3 Pipeline 接线 | TTS/图片/视频质量读取 snapshot | **已完成** |
| M4 前端 | 模型设置页 + 创建页摘要/覆盖 | **已完成** |
| M5 测试 | 单测 + API 冒烟 + 一次真实出片抽检 | 单测/API 冒烟已完成；真实出片抽检可选 |

---

## 13. 已确认产品决策（2026-07-21）

以下 5 项已确认并作为首期实现约束，**不再作为待选项**：

| # | 决策项 | 确认结果 |
|---|---|---|
| 1 | 文生视频首期范围 | **仅 HyperFrames 质量档**；不引入外部 T2V 作为默认主链路（`videoProvider` 仅开放 `hyperframes`，外部 provider 仅预留扩展位） |
| 2 | 学生是否可选付费 provider | **允许**；须同时满足：管理员 allowlist 开放 + 平台已配置对应 Key（ready=true） |
| 3 | 管理员代改他人模型设置 | **首期不做**；仅用户管理自己的设置。二期再评估 `GET/PUT /admin/users/:id/model-settings` |
| 4 | 设置粒度 | **首期全局偏好**（一套 TTS/图片/视频设置应用于所有任务）；不按 `outputProfile` 分套。二期可扩展分档位配置 |
| 5 | 默认 `videoQuality` | **系统默认 `standard`**；开发/compose 可用环境变量或系统配置覆盖为 `draft` |

### 派生实现约束

1. `GET /models/catalog` 的 `video` 列表首期只返回 ready 的 `hyperframes`（可带 qualities）。
2. 学生/教师/管理员写入 `imageProvider`/`ttsProvider` 时，服务端必须校验 allowlist + ready，失败 400/403。
3. 不实现管理员代管他人 model-settings API（文档中“可选同期”改为二期）。
4. `user_model_settings` 不设计 per-profile JSON 分套；仅全局字段。
5. 系统配置 / env 默认：`hyperframes_quality` / `default videoQuality` = `standard`（除非显式配置 draft）。
6. 创建任务仍允许任务级覆盖 `videoQuality`/`imageProvider`/`ttsProvider`（优先级最高）。

---

## 14. 附录：与现有字段映射

| 现有 | 用户设置对应 |
|---|---|
| `DEFAULT_TTS_PROVIDER` / `default_tts_provider` | system default TTS |
| `DEFAULT_EDGE_VOICE` / `default_edge_voice` | system default voice |
| `DEFAULT_IMAGE_PROVIDER` / `default_image_provider` | system default image |
| 任务 `imageProvider` | task override |
| `HYPERFRAMES_QUALITY` / `hyperframes_quality` | system default videoQuality |
| 未来外部 T2V provider | `videoProvider` 扩展 |

