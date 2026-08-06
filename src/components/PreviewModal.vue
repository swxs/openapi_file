<template>
  <a-modal
    :open="open"
    :title="null"
    width="min(1000px, 92vw)"
    :footer="null"
    centered
    class="preview-modal"
    @cancel="$emit('close')"
  >
    <header v-if="displayFile" class="preview-header">
      <span class="file-stamp" :data-kind="fileCategory">
        {{ stampLabel }}
      </span>
      <div class="name-block">
        <template v-if="renaming">
          <a-input
            ref="renameInputRef"
            v-model:value="editBaseName"
            class="rename-input"
            size="small"
            :maxlength="240"
            @keydown.enter.prevent="saveRename"
            @keydown.esc.prevent="cancelRename"
            @blur="saveRename"
          />
          <span v-if="nameParts.extension" class="name-ext"
            >.{{ nameParts.extension }}</span
          >
        </template>
        <template v-else>
          <span class="name-base" :title="displayFile.file_name">{{
            nameParts.baseName || displayFile.file_name
          }}</span>
          <span v-if="nameParts.extension" class="name-ext"
            >.{{ nameParts.extension }}</span
          >
        </template>
      </div>
      <button
        type="button"
        class="rename-btn"
        :disabled="renaming || savingRename"
        aria-label="改名"
        @click="startRename"
      >
        <EditOutlined />
      </button>
    </header>

    <div class="preview-stage">
      <a-spin v-if="loading" tip="正在取得临时预览凭证…" />
      <img
        v-else-if="kind === 'image'"
        :src="url"
        :alt="displayFile?.file_name"
      />
      <video v-else-if="kind === 'video'" :src="url" controls autoplay />
      <iframe
        v-else-if="kind === 'pdf'"
        :src="url"
        :title="displayFile?.file_name"
      />
      <button
        v-else-if="kind === 'download' && displayFile"
        type="button"
        class="download-card"
        :disabled="downloading"
        @click="triggerDownload"
      >
        <span class="download-stamp" :data-kind="fileCategory">{{
          stampLabel
        }}</span>
        <strong>{{ categoryLabel }}</strong>
        <span class="download-meta">{{
          formatBytes(displayFile.file_size)
        }}</span>
        <span class="download-meta"
          >归档于 {{ formatDate(displayFile.create_at) }}</span
        >
        <em>{{ downloading ? "正在取得下载凭证…" : "点击下载" }}</em>
      </button>
      <a-result
        v-else-if="error"
        status="error"
        title="无法打开预览"
        :sub-title="error"
      />
    </div>
  </a-modal>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { EditOutlined } from "@ant-design/icons-vue";
import { getDownloadUrl, updateFile } from "../api/files";
import {
  buildFileName,
  categoryOf,
  extensionOf,
  formatBytes,
  formatDate,
  previewKind,
  splitFileName,
  unwrapData,
} from "../utils/files";

const props = defineProps({
  open: Boolean,
  file: { type: Object, default: null },
});
const emit = defineEmits(["close", "renamed"]);

const loading = ref(false);
const downloading = ref(false);
const url = ref("");
const error = ref("");
const kind = ref("");
const displayFile = ref(null);
const renaming = ref(false);
const savingRename = ref(false);
const editBaseName = ref("");
const renameInputRef = ref(null);

const nameParts = computed(() => splitFileName(displayFile.value?.file_name));
const fileCategory = computed(() =>
  displayFile.value ? categoryOf(displayFile.value) : "other",
);
const stampLabel = computed(() =>
  (extensionOf(displayFile.value) || "file").slice(0, 4).toUpperCase(),
);
const categoryLabel = computed(() => {
  const labels = {
    image: "图像资料",
    video: "影像资料",
    document: "文书资料",
    other: "其他资料",
  };
  return labels[fileCategory.value] || labels.other;
});

function resolveDownloadUrl(payload) {
  return (
    (typeof payload === "string" ? payload : payload?.url) ||
    payload?.presigned_url ||
    ""
  );
}

async function loadPreviewUrl() {
  if (!displayFile.value || kind.value === "download") return;
  loading.value = true;
  error.value = "";
  url.value = "";
  try {
    const payload = unwrapData(
      await getDownloadUrl(displayFile.value.id, "inline"),
    );
    url.value = resolveDownloadUrl(payload);
    if (!url.value) throw new Error("服务端未返回预览地址");
  } catch (requestError) {
    error.value = requestError?.message || "预览地址获取失败";
  } finally {
    loading.value = false;
  }
}

async function triggerDownload() {
  if (!displayFile.value || downloading.value) return;
  downloading.value = true;
  try {
    const payload = unwrapData(
      await getDownloadUrl(displayFile.value.id, "attachment"),
    );
    const downloadUrl = resolveDownloadUrl(payload);
    if (!downloadUrl) throw new Error("服务端未返回下载地址");
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  } catch (requestError) {
    message.error(requestError?.message || "下载地址获取失败");
  } finally {
    downloading.value = false;
  }
}

function startRename() {
  if (!displayFile.value) return;
  editBaseName.value = nameParts.value.baseName;
  renaming.value = true;
  nextTick(() => renameInputRef.value?.focus());
}

function cancelRename() {
  renaming.value = false;
  editBaseName.value = nameParts.value.baseName;
}

async function saveRename() {
  if (!displayFile.value || !renaming.value || savingRename.value) return;
  const trimmed = editBaseName.value.trim();
  if (!trimmed) {
    message.warning("文件名不能为空");
    return;
  }
  const nextFileName = buildFileName(trimmed, nameParts.value.extension);
  if (nextFileName === displayFile.value.file_name) {
    cancelRename();
    return;
  }
  savingRename.value = true;
  try {
    const payload = unwrapData(
      await updateFile(displayFile.value.id, {
        file_name: nextFileName,
        ext: nameParts.value.extension
          ? `.${nameParts.value.extension}`
          : displayFile.value.ext,
      }),
    );
    const updated = payload?.data ?? payload ?? {};
    displayFile.value = { ...displayFile.value, ...updated };
    emit("renamed", displayFile.value);
    renaming.value = false;
    message.success("文件名已更新");
  } catch (requestError) {
    message.error(requestError?.response?.data?.message || "改名失败");
  } finally {
    savingRename.value = false;
  }
}

watch(
  () => [props.open, props.file?.id, props.file?.file_name],
  async () => {
    if (!props.open || !props.file) return;
    displayFile.value = { ...props.file };
    renaming.value = false;
    error.value = "";
    url.value = "";
    kind.value = previewKind(props.file);
    await loadPreviewUrl();
  },
);
</script>

<style lang="less">
@ink: #17201d;
@paper: #f3efe5;
@paper-deep: #e6e0d2;
@line: #c8c0ad;
@green: #34584b;

.preview-modal {
  .ant-modal-content {
    overflow: hidden;
    background: @paper;
  }

  .ant-modal-body {
    padding: 0;
  }
}

.preview-header {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 56px;
  padding: 14px 18px;
  background: @paper-deep;
  border-bottom: 1px solid @line;
}

.file-stamp,
.download-stamp {
  display: grid;
  flex: 0 0 45px;
  place-items: center;
  width: 45px;
  height: 35px;
  color: #78543c;
  font-family: "Courier New", monospace;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  background: #e7d5bd;
  border: 1px solid #b99672;
  border-radius: 2px;
  transform: rotate(-1deg);

  &[data-kind="image"] {
    color: #315b4d;
    background: #d7e2d9;
    border-color: #8da699;
  }

  &[data-kind="video"] {
    color: #765f30;
    background: #e8dfbd;
    border-color: #b7a56c;
  }

  &[data-kind="document"] {
    color: #39546a;
    background: #d8e0e3;
    border-color: #8ca0aa;
  }
}

.name-block {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  line-height: 1.4;
}

.name-base {
  overflow: hidden;
  font-family: "Noto Serif SC", "SimSun", serif;
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-ext {
  flex: 0 0 auto;
  color: #6d756f;
  font-family: "Courier New", monospace;
  font-size: 12px;
}

.rename-input {
  flex: 1;
  min-width: 0;
}

.rename-btn {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 32px;
  height: 32px;
  color: #46514c;
  background: #eeeae0;
  border: 1px solid #cec7b9;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: white;
    background: @green;
    border-color: @green;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.preview-stage {
  display: grid;
  place-items: center;
  min-height: 62vh;
  overflow: hidden;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    #19211f;
  background-size: 28px 28px;

  img,
  video {
    max-width: 100%;
    max-height: 72vh;
    object-fit: contain;
  }

  iframe {
    width: 100%;
    height: 72vh;
    border: 0;
  }
}

.download-card {
  display: grid;
  gap: 10px;
  width: min(420px, 88%);
  padding: 28px 24px;
  color: #eef2ea;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.22);
  cursor: pointer;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.75;
  }

  strong {
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: 20px;
    font-weight: 700;
  }

  .download-meta {
    color: rgba(238, 242, 234, 0.72);
    font-family: "Courier New", monospace;
    font-size: 11px;
  }

  em {
    margin-top: 8px;
    color: #d69755;
    font-style: normal;
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  .download-stamp {
    justify-self: center;
  }
}
</style>
