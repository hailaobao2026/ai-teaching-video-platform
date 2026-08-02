# 阿里云百炼模型接入说明

## 当前可直接使用

当前乡村课堂 AI 助教和知识驱动分镜都使用 OpenAI-compatible `chat/completions`，因此可以直接使用百炼兼容接口：

- `BAILIAN_BASE_URL=https://llm-hed5mn2ug7z7kn53.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- `BAILIAN_MODEL=qwen3-max`
- `BAILIAN_API_KEY=只在本机 .env 配置`

也可以使用项目已有变量：`ASSISTANT_LLM_API_KEY`、`ASSISTANT_LLM_BASE_URL`、`ASSISTANT_LLM_MODEL`。助教变量优先级更高，适合将问答模型和视频分镜模型分开配置。

## 模型用途

| 百炼模型 | 当前状态 | 适用功能 |
|---|---|---|
| Qwen3-Max | 已支持 | 课堂问答、知识解释、分镜知识补全 |
| Qwen3-Omni | 接口预留 | 图片/音频/视频联合理解，需要新增多模态输入流程 |
| Qwen3 端侧小尺寸版 | 可作为兼容模型配置 | 低资源或本地部署场景，需要确认百炼控制台中的准确模型 ID |
| FunASR | 尚未接入 | 语音提问转文字，需要新增音频上传、转写和课堂录音权限流程 |

## 安全要求

- API Key 只放在本机 `.env`，不要写入 `README`、源码、截图或提交记录。
- 你在对话中粘贴过的 Key 建议在百炼控制台立即禁用并重新生成。
- 当前服务调用失败会回退本地知识库，不会把 Key 写入任务输入、数据库或日志。

## 本地配置

```env
ASSISTANT_LLM_ENABLED=true
ASSISTANT_LLM_API_KEY=你的新Key
ASSISTANT_LLM_BASE_URL=https://llm-hed5mn2ug7z7kn53.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
ASSISTANT_LLM_MODEL=qwen3-max

BAILIAN_API_KEY=你的新Key
BAILIAN_BASE_URL=https://llm-hed5mn2ug7z7kn53.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
BAILIAN_MODEL=qwen3-max
```

配置后重启 API 服务和 Worker。无 Key 时仍然可以用本地知识库完成课堂问答演示。


## 配置优先级与故障降级

AI 助教读取顺序：`ASSISTANT_LLM_*` → `BAILIAN_*` → `DASHSCOPE_*` → 通用 `LLM_*` / `OPENAI_*`。分镜构建优先读取 `BAILIAN_*`，再读取其他兼容变量。

调用路径统一为兼容接口的 `/chat/completions`。未配置 Key、请求超时或模型异常时，AI 助教回退本地知识点目录；API Key 不写入任务输入、试点记录或公开日志。
