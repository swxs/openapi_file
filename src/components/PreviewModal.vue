<template>
  <a-modal
    :open="open"
    :title="file?.file_name || '文件预览'"
    width="min(1000px, 92vw)"
    :footer="null"
    centered
    class="preview-modal"
    @cancel="$emit('close')"
  >
    <div class="preview-stage">
      <a-spin v-if="loading" tip="正在取得临时预览凭证…" />
      <img v-else-if="kind === 'image'" :src="url" :alt="file.file_name" />
      <video v-else-if="kind === 'video'" :src="url" controls autoplay />
      <iframe v-else-if="kind === 'pdf'" :src="url" :title="file.file_name" />
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
import { ref, watch } from "vue";
import { getDownloadUrl } from "../api/files";
import { previewKind, unwrapData } from "../utils/files";

const props = defineProps({
  open: Boolean,
  file: { type: Object, default: null },
});
defineEmits(["close"]);

const loading = ref(false);
const url = ref("");
const error = ref("");
const kind = ref("");

watch(
  () => [props.open, props.file?.id],
  async () => {
    if (!props.open || !props.file) return;
    loading.value = true;
    error.value = "";
    url.value = "";
    kind.value = previewKind(props.file);
    try {
      const payload = unwrapData(await getDownloadUrl(props.file.id, "inline"));
      url.value =
        (typeof payload === "string" ? payload : payload?.url) ||
        payload?.presigned_url;
      if (!url.value) throw new Error("服务端未返回预览地址");
    } catch (requestError) {
      error.value = requestError?.message || "预览地址获取失败";
    } finally {
      loading.value = false;
    }
  },
);
</script>

<style lang="less">
.preview-modal {
  .ant-modal-content {
    overflow: hidden;
    background: #f3efe5;
  }

  .ant-modal-body {
    padding: 0;
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
</style>
