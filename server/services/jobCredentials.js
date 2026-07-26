import db from '../db.js';
import { resolveRuntimeCredentialsForJob } from './modelSettings.js';

// 建任务时锁定的是 provider 选择，凭证在执行时现场解析（用户换 key 后重试才会生效）。
// 因此这里把快照里的每个字段都当作 taskInput 传入 —— taskInput 优先级最高，
// 可保证解析出的 effective 与 modelSnapshot 完全一致。
function providerSelectionFromJob(job) {
  const input = job.input_json || {};
  const snapshot = input.modelSnapshot || {};
  const pick = (...values) => values.find(value => value != null && value !== '');
  return {
    ttsProvider: pick(snapshot.ttsProvider, input.ttsProvider),
    ttsVoice: pick(snapshot.ttsVoice, input.ttsVoice),
    ttsSpeed: pick(snapshot.ttsSpeed, input.ttsSpeed),
    imageProvider: pick(snapshot.imageProvider, input.imageProvider),
    imageStyle: pick(snapshot.imageStyle, input.style),
    imageAspectRatio: pick(snapshot.imageAspectRatio, input.aspectRatio),
    videoProvider: pick(snapshot.videoProvider, input.videoProvider),
    videoQuality: pick(snapshot.videoQuality, input.videoQuality),
    videoFps: pick(snapshot.videoFps, input.videoFps)
  };
}

export async function resolveJobRuntimeCredentials(job) {
  const user = await db.findUserById(job.user_id);
  if (!user) throw new Error('任务发起人不存在');
  if (user.status && user.status !== 'active') throw new Error('任务发起人账号已禁用');
  return resolveRuntimeCredentialsForJob({
    user,
    userSettings: await db.getUserModelSettings(user.id),
    systemConfig: await db.getConfig(),
    taskInput: providerSelectionFromJob(job)
  });
}

export default { resolveJobRuntimeCredentials };
