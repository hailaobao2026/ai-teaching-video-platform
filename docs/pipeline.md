# 生成流水线（核心：ai-teaching-media）

## 1. 目标产物

对齐实测：

`.../02-teaching-animation/renders/energy-conservation.mp4`

可选附属：

- 3:4 封面
- 9:16 信息图
- storyboard.json / durations.json / montage.png

## 2. 平台到 skill 的映射

用户输入：

```text
学科=物理 年级=初二 主题=能量守恒定律
```

Worker 生成工作区：

```text
ARTIFACTS_ROOT/<jobId>/
  storyboard.json
  audio/
  index.html
  renders/
  meta/
```

### Stage A — Storyboard
平台根据知识点模板生成 7 段 `storyboard.json`：

- palette：按学科映射（physics→electricity/sound/...）
- voice：默认 edge / 可配置 minimax
- segments：引入→核心→例子→总结

实现位置：`server/services/storyboardBuilder.js`

### Stage B — TTS
```bash
python TEACHING_MEDIA_ROOT/edu-teaching-animation/scripts/minimax_tts.py \
  storyboard.json --outdir audio --provider edge
```

### Stage C — Scaffold + 场景填充
```bash
python .../scaffold_video.py <work_dir> --force
```
随后 `sceneFiller.js` 根据 visual 描述补 SVG/卡片（可先模板化，后接 LLM）。

### Stage D — Render
```bash
npx --yes hyperframes render --quality standard --output renders/<slug>.mp4
```
（Windows 下用平台封装脚本，不直接依赖 bash build_video.sh）

### Stage E — Optional images
若 `outputProfile=package_all`：

```bash
python .../ai-image-generator/scripts/generate.py --provider agnes ...
```

### Stage F — Package
- 校验 mp4 存在与时长
- 复制到 `uploads/videos/`
- 写 `course_assets`
- 创建/更新 course 草稿

## 3. 进度上报

| stage | progress |
|-------|----------|
| queued | 0 |
| storyboard | 10 |
| tts | 30 |
| scaffold | 45 |
| render | 50–90 |
| package | 95 |
| succeeded | 100 |

## 4. 失败与重试

可恢复：

- Edge TTS 网络抖动
- HyperFrames 临时失败

不可恢复（直接 failed + 明确错误）：

- 输入主题为空
- skill 路径不存在
- ffmpeg/node 缺失

重试策略：同 job 重新入队，工作区可 `--skip-existing` 复用已有 mp3。

## 5. 首期模板库

内置 3 套高质量模板，降低冷启动：

1. 物理：能量守恒定律（已验证）
2. 物理：声现象（skill 自带示例）
3. 生物：光合作用

模板只作默认分镜骨架，用户主题字段覆盖标题与旁白关键词。
