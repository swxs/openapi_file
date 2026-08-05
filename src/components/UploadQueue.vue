<template>
  <aside v-if="jobs.length" class="upload-queue" aria-live="polite">
    <header>
      <div>
        <span class="eyebrow">TRANSFER LOG</span>
        <strong>上传队列</strong>
      </div>
      <span>{{ activeCount }} 项进行中</span>
    </header>
    <div class="queue-list">
      <article v-for="job in jobs" :key="job.id" class="queue-item">
        <div class="queue-row">
          <span class="queue-name" :title="job.file.name">{{
            job.file.name
          }}</span>
          <button
            v-if="!['done', 'error', 'cancelled'].includes(job.status)"
            type="button"
            aria-label="取消上传"
            @click="cancel(job)"
          >
            取消
          </button>
          <button
            v-else-if="job.status === 'error'"
            type="button"
            @click="retry(job)"
          >
            重试
          </button>
        </div>
        <a-progress
          :percent="job.progress"
          :status="job.status === 'error' ? 'exception' : undefined"
          :show-info="false"
          size="small"
        />
        <div class="queue-meta">
          <span>{{ statusText(job) }}</span>
          <span>{{ formatBytes(job.file.size) }}</span>
        </div>
      </article>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from "vue";
import { uploadFile } from "../services/upload";
import { formatBytes } from "../utils/files";

const emit = defineEmits(["finished"]);
const jobs = ref([]);
const activeCount = computed(
  () =>
    jobs.value.filter(
      (job) => !["done", "error", "cancelled"].includes(job.status),
    ).length,
);

const labels = {
  queued: "等待处理",
  hashing: "正在生成内容指纹",
  presigning: "正在申请安全通道",
  uploading: "正在直传 OSS",
  completing: "正在归档",
  done: "上传完成",
  error: "上传失败",
  cancelled: "已取消",
};

function statusText(job) {
  if (job.instant) return "秒传完成 · 已存在相同内容";
  if (job.error) return job.error;
  return labels[job.status] || job.status;
}

async function run(job) {
  job.status = "queued";
  job.progress = 0;
  job.error = "";
  job.instant = false;
  try {
    await uploadFile(job.file, {
      onCancelReady(cancel) {
        job.cancel = cancel;
      },
      onState(status, progress, instant) {
        job.status = status;
        job.progress = progress;
        job.instant = instant;
      },
    });
    emit("finished", job.file);
  } catch (error) {
    if (error?.name === "AbortError" || job.status === "cancelled") return;
    job.status = "error";
    job.error = error?.message || "上传失败";
  }
}

function addFiles(files) {
  Array.from(files).forEach((file) => {
    const job = {
      id: `${Date.now()}-${crypto.randomUUID?.() || Math.random()}`,
      file,
      status: "queued",
      progress: 0,
      cancel: null,
      error: "",
      instant: false,
    };
    jobs.value.unshift(job);
    run(job);
  });
}

function cancel(job) {
  job.status = "cancelled";
  job.cancel?.();
}

function retry(job) {
  run(job);
}

defineExpose({ addFiles });
</script>

<style lang="less" scoped>
.upload-queue {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 40;
  width: min(390px, calc(100vw - 32px));
  overflow: hidden;
  color: #f3efe5;
  background: #18211e;
  border: 1px solid #35423d;
  box-shadow: 0 22px 60px rgba(17, 24, 21, 0.3);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #35423d;

  div {
    display: grid;
    gap: 3px;
  }

  > span {
    color: #a8b2ab;
    font-size: 12px;
  }
}

.eyebrow {
  color: #d89b5c;
  font-family: "Courier New", monospace;
  font-size: 9px;
  letter-spacing: 0.16em;
}

.queue-list {
  max-height: 310px;
  overflow: auto;
}

.queue-item {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.queue-row,
.queue-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.queue-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button {
  padding: 0;
  color: #d89b5c;
  font-size: 11px;
  background: none;
  border: 0;
  cursor: pointer;
}

.queue-meta {
  margin-top: 5px;
  color: #8f9b94;
  font-size: 10px;
}
</style>
