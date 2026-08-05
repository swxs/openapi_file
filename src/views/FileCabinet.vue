<template>
  <main
    class="cabinet"
    :class="{ 'is-dragging': dragging }"
    @dragenter.prevent="dragging = true"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <header class="masthead">
      <div class="brand-mark">卷</div>
      <div class="brand-copy">
        <span>PRIVATE ARCHIVE / {{ currentDate }}</span>
        <h1>私人文件柜</h1>
      </div>
      <div class="masthead-rule"></div>
      <div class="identity">
        <span class="status-dot"></span>
        <div>
          <strong>{{ userName }}</strong>
          <small>已加密连接</small>
        </div>
      </div>
    </header>

    <section class="intro">
      <div>
        <span class="section-index">ARCHIVE № 04</span>
        <h2>把重要之物，<br /><em>妥善归档。</em></h2>
        <p>
          文件不经过业务服务器，直接写入对象存储。内容指纹用于秒传与完整性核验。
        </p>
      </div>
      <label class="upload-button">
        <input
          type="file"
          multiple
          @change="selectFiles($event.target.files)"
        />
        <span class="plus">＋</span>
        <span><strong>收存文件</strong><small>选择或拖入文件</small></span>
      </label>
    </section>

    <section class="workspace">
      <a-tabs v-model:active-key="activeSection" @change="onSectionChange">
        <a-tab-pane key="files" tab="我的文件">
          <div class="filters">
            <nav aria-label="文件分类">
              <button
                v-for="item in categories"
                :key="item.key"
                type="button"
                :class="{ active: category === item.key }"
                @click="category = item.key"
              >
                {{ item.label }}
                <span>{{ categoryCounts[item.key] }}</span>
              </button>
            </nav>
            <div class="tools">
              <a-input
                v-model:value="query"
                allow-clear
                placeholder="检索文件名或备注"
                class="search-input"
              >
                <template #prefix><SearchOutlined /></template>
              </a-input>
              <a-select v-model:value="sort" class="sort-select">
                <a-select-option value="newest">最近归档</a-select-option>
                <a-select-option value="oldest">最早归档</a-select-option>
                <a-select-option value="name">按名称</a-select-option>
                <a-select-option value="largest">按大小</a-select-option>
              </a-select>
            </div>
          </div>

          <div class="ledger">
            <div class="ledger-head">
              <span>档案名称</span><span>类型</span><span>容量</span
              ><span>归档时间</span><span>操作</span>
            </div>
            <a-spin :spinning="loading">
              <div v-if="visibleFiles.length" class="ledger-body">
                <article
                  v-for="(file, index) in visibleFiles"
                  :key="file.id"
                  class="file-row"
                >
                  <span class="row-index">{{
                    String(index + 1).padStart(2, "0")
                  }}</span>
                  <button
                    type="button"
                    class="file-identity"
                    @click="openFile(file)"
                  >
                    <span class="file-stamp" :data-kind="categoryOf(file)">
                      {{ extensionOf(file).slice(0, 4) || "FILE" }}
                    </span>
                    <span>
                      <strong :title="file.file_name">{{
                        file.file_name
                      }}</strong>
                      <small>{{ file.description || file.file_id }}</small>
                    </span>
                  </button>
                  <span class="type-cell">{{ categoryLabel(file) }}</span>
                  <span class="mono">{{ formatBytes(file.file_size) }}</span>
                  <time>{{ formatDate(file.updated || file.create_at) }}</time>
                  <span class="row-actions">
                    <a-tooltip title="预览或下载">
                      <button type="button" @click="openFile(file)">
                        <EyeOutlined />
                      </button>
                    </a-tooltip>
                    <a-tooltip title="创建分享">
                      <button type="button" @click="openShare(file)">
                        <LinkOutlined />
                      </button>
                    </a-tooltip>
                    <a-tooltip title="删除">
                      <button
                        type="button"
                        class="danger"
                        @click="confirmDelete(file)"
                      >
                        <DeleteOutlined />
                      </button>
                    </a-tooltip>
                  </span>
                </article>
              </div>
              <a-empty
                v-else
                :description="query ? '没有匹配的档案' : '此抽屉尚未收存文件'"
              />
            </a-spin>
          </div>
          <footer class="ledger-footer">
            <span
              >已显示 {{ visibleFiles.length }} /
              {{ files.length }} 份档案</span
            >
            <button type="button" @click="loadFiles">
              <ReloadOutlined /> 刷新目录
            </button>
          </footer>
        </a-tab-pane>

        <a-tab-pane key="shares" tab="我的分享">
          <div class="share-heading">
            <div>
              <span class="section-index">OUTGOING REGISTER</span>
              <h3>外借登记簿</h3>
            </div>
            <p>撤销会立即使链接失效；删除只移除登记记录。</p>
          </div>
          <div class="share-grid">
            <article v-for="share in shares" :key="share.id" class="share-card">
              <div class="share-card-top">
                <span
                  :class="['share-status', { inactive: share.status !== 1 }]"
                >
                  {{ share.status === 1 ? "有效" : "已失效" }}
                </span>
                <span class="mono">№ {{ String(share.id).slice(-6) }}</span>
              </div>
              <h4>{{ share.name }}</h4>
              <p>{{ share.file_name || share.description || "共享档案" }}</p>
              <button
                type="button"
                class="share-url"
                :disabled="!share.url"
                @click="copyText(share.url)"
              >
                <span>{{ share.url || "未返回公开地址" }}</span>
                <CopyOutlined />
              </button>
              <div class="share-meta">
                <span>创建于 {{ formatDate(share.create_at) }}</span>
                <span>{{
                  share.expires_at
                    ? `到期 ${formatDate(share.expires_at)}`
                    : "长期有效"
                }}</span>
              </div>
              <div class="share-actions">
                <a-button
                  :disabled="share.status !== 1"
                  @click="handleRevoke(share)"
                  >撤销链接</a-button
                >
                <a-button danger @click="handleDeleteShare(share)"
                  >删除记录</a-button
                >
              </div>
            </article>
            <a-empty
              v-if="!shareLoading && !shares.length"
              description="暂无分享记录"
            />
          </div>
        </a-tab-pane>
      </a-tabs>
    </section>

    <div v-if="dragging" class="drop-curtain">
      <div>
        <span>DROP TO ARCHIVE</span>
        <strong>松开以收存文件</strong>
      </div>
    </div>

    <UploadQueue ref="uploadQueue" @finished="onUploadFinished" />
    <PreviewModal
      :open="previewOpen"
      :file="previewFile"
      @close="previewOpen = false"
    />

    <a-modal
      v-model:open="shareOpen"
      title="登记一条分享"
      ok-text="创建并复制"
      cancel-text="取消"
      :confirm-loading="shareSubmitting"
      @ok="submitShare"
    >
      <a-form layout="vertical">
        <a-form-item label="关联档案">
          <a-input :value="shareForm.file_name" disabled />
        </a-form-item>
        <a-form-item label="分享名称" required>
          <a-input
            v-model:value="shareForm.name"
            maxlength="255"
            placeholder="例如：项目素材交付"
          />
        </a-form-item>
        <a-form-item label="附注">
          <a-textarea
            v-model:value="shareForm.description"
            :rows="3"
            placeholder="可选，说明分享用途"
          />
        </a-form-item>
        <a-form-item label="失效时间">
          <a-date-picker
            v-model:value="shareForm.expires_at"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
            placeholder="留空则长期有效"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from "vue";
import { Modal, message } from "ant-design-vue";
import {
  CopyOutlined,
  DeleteOutlined,
  EyeOutlined,
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons-vue";
import UploadQueue from "../components/UploadQueue.vue";
import PreviewModal from "../components/PreviewModal.vue";
import {
  createShare,
  deleteFile,
  deleteShare,
  getDownloadUrl,
  listFiles,
  listShares,
  revokeShare,
} from "../api/files";
import { getTokenInfo } from "../utils/auth";
import {
  categoryOf,
  extensionOf,
  filterAndSortFiles,
  formatBytes,
  formatDate,
  previewKind,
  unwrapData,
  unwrapList,
} from "../utils/files";

const MAX_UPLOAD_BYTES =
  Number(process.env.VUE_APP_UPLOAD_MAX_BYTES) || 500 * 1024 * 1024;
const categories = [
  { key: "all", label: "全部档案" },
  { key: "image", label: "图片" },
  { key: "video", label: "视频" },
  { key: "document", label: "文档" },
  { key: "other", label: "其他" },
];

const activeSection = ref("files");
const category = ref("all");
const query = ref("");
const sort = ref("newest");
const files = ref([]);
const shares = ref([]);
const loading = ref(false);
const shareLoading = ref(false);
const dragging = ref(false);
const uploadQueue = ref(null);
const previewOpen = ref(false);
const previewFile = ref(null);
const shareOpen = ref(false);
const shareSubmitting = ref(false);
const shareForm = reactive({
  file_info_id: "",
  file_name: "",
  name: "",
  description: "",
  expires_at: null,
});

const tokenInfo = getTokenInfo();
const userName =
  tokenInfo.name || tokenInfo.username || tokenInfo.email || "私人档案员";
const currentDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const visibleFiles = computed(() =>
  filterAndSortFiles(files.value, {
    category: category.value,
    query: query.value,
    sort: sort.value,
  }),
);
const categoryCounts = computed(() => {
  const counts = {
    all: files.value.length,
    image: 0,
    video: 0,
    document: 0,
    other: 0,
  };
  files.value.forEach((file) => {
    counts[categoryOf(file)] += 1;
  });
  return counts;
});

function categoryLabel(file) {
  return {
    image: "图像资料",
    video: "影像资料",
    document: "文书资料",
    other: "其他资料",
  }[categoryOf(file)];
}

async function loadFiles() {
  loading.value = true;
  try {
    const result = unwrapList(
      await listFiles({
        use_pager: 1,
        page: 1,
        page_number: 500,
        order_by: ["-update_at"],
      }),
    );
    files.value = result.data;
  } catch (error) {
    message.error(error?.response?.data?.message || "文件目录读取失败");
  } finally {
    loading.value = false;
  }
}

async function loadShares() {
  shareLoading.value = true;
  try {
    shares.value = unwrapList(
      await listShares({
        use_pager: 1,
        page: 1,
        page_number: 100,
        order_by: ["-update_at"],
      }),
    ).data;
  } catch (error) {
    message.error(error?.response?.data?.message || "分享登记读取失败");
  } finally {
    shareLoading.value = false;
  }
}

function onSectionChange(section) {
  if (section === "shares") loadShares();
}

function selectFiles(fileList) {
  const accepted = [];
  Array.from(fileList || []).forEach((file) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      message.warning(
        `${file.name} 超过 ${formatBytes(MAX_UPLOAD_BYTES)} 上限`,
      );
    } else {
      accepted.push(file);
    }
  });
  if (accepted.length) uploadQueue.value?.addFiles(accepted);
}

function onDrop(event) {
  dragging.value = false;
  selectFiles(event.dataTransfer.files);
}

function onDragLeave(event) {
  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget))
    return;
  dragging.value = false;
}

function onUploadFinished(file) {
  message.success(`${file.name} 已归档`);
  loadFiles();
}

async function openFile(file) {
  if (previewKind(file) !== "download") {
    previewFile.value = file;
    previewOpen.value = true;
    return;
  }
  try {
    const payload = unwrapData(await getDownloadUrl(file.id, "attachment"));
    const url =
      (typeof payload === "string" ? payload : payload?.url) ||
      payload?.presigned_url;
    if (!url) throw new Error("服务端未返回下载地址");
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    message.error("下载地址获取失败");
  }
}

function confirmDelete(file) {
  Modal.confirm({
    title: "确认移出文件柜？",
    content: `“${file.file_name}”将从你的档案中删除；共享内容会按引用情况安全清理。`,
    okText: "确认删除",
    okType: "danger",
    cancelText: "保留",
    async onOk() {
      await deleteFile(file.id);
      message.success("档案已删除");
      await loadFiles();
    },
  });
}

function openShare(file) {
  Object.assign(shareForm, {
    file_info_id: file.id,
    file_name: file.file_name,
    name: file.file_name,
    description: "",
    expires_at: null,
  });
  shareOpen.value = true;
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  message.success("分享地址已复制");
}

async function submitShare() {
  if (!shareForm.name.trim()) {
    message.warning("请填写分享名称");
    return;
  }
  shareSubmitting.value = true;
  try {
    const payload = {
      file_info_id: shareForm.file_info_id,
      name: shareForm.name.trim(),
      description: shareForm.description.trim() || undefined,
      expires_at: shareForm.expires_at || undefined,
    };
    const result = unwrapData(await createShare(payload));
    shareOpen.value = false;
    if (result?.url) await copyText(result.url);
    else message.success("分享已创建");
    if (activeSection.value === "shares") await loadShares();
  } catch (error) {
    message.error(error?.response?.data?.message || "创建分享失败");
  } finally {
    shareSubmitting.value = false;
  }
}

async function handleRevoke(share) {
  await revokeShare(share.id);
  message.success("分享链接已撤销");
  await loadShares();
}

function handleDeleteShare(share) {
  Modal.confirm({
    title: "删除这条分享记录？",
    content: share.name,
    okText: "删除",
    okType: "danger",
    cancelText: "取消",
    async onOk() {
      await deleteShare(share.id);
      message.success("分享记录已删除");
      await loadShares();
    },
  });
}

loadFiles();
</script>

<style lang="less" scoped>
@ink: #17201d;
@paper: #f1eee5;
@paper-deep: #e6e0d2;
@line: #c8c0ad;
@orange: #bd642c;
@green: #34584b;

.cabinet {
  min-height: 100vh;
  color: @ink;
  background:
    radial-gradient(
      circle at 15% 0%,
      rgba(189, 100, 44, 0.08),
      transparent 26%
    ),
    repeating-linear-gradient(
      0deg,
      rgba(23, 32, 29, 0.018) 0 1px,
      transparent 1px 5px
    ),
    @paper;
}

.masthead {
  display: flex;
  align-items: center;
  gap: 18px;
  min-height: 88px;
  padding: 0 clamp(24px, 5vw, 78px);
  color: #f4f0e7;
  background: @ink;
  border-bottom: 4px solid @orange;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  color: @ink;
  font-family: "Noto Serif SC", "SimSun", serif;
  font-size: 23px;
  font-weight: 900;
  background: #d99a57;
  border-radius: 50%;
}

.brand-copy {
  span {
    color: #99a69f;
    font-family: "Courier New", monospace;
    font-size: 9px;
    letter-spacing: 0.15em;
  }

  h1 {
    margin: 1px 0 0;
    color: inherit;
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: 20px;
    letter-spacing: 0.16em;
  }
}

.masthead-rule {
  flex: 1;
  height: 1px;
  background: #3d4945;
}

.identity {
  display: flex;
  align-items: center;
  gap: 10px;

  div {
    display: grid;
  }

  strong {
    max-width: 180px;
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: #8f9a95;
    font-size: 9px;
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #70a584;
  border: 2px solid @ink;
  border-radius: 50%;
  box-shadow: 0 0 0 1px #70a584;
}

.intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 40px;
  max-width: 1420px;
  margin: 0 auto;
  padding: clamp(58px, 8vw, 112px) clamp(24px, 5vw, 78px) 52px;

  h2 {
    margin: 16px 0 20px;
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: clamp(38px, 5.2vw, 72px);
    font-weight: 800;
    line-height: 1.06;
    letter-spacing: -0.04em;

    em {
      color: @orange;
      font-style: normal;
    }
  }

  p {
    max-width: 570px;
    margin: 0;
    color: #626a65;
    font-size: 13px;
    line-height: 1.8;
  }
}

.section-index {
  color: @orange;
  font-family: "Courier New", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
}

.upload-button {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 16px;
  min-width: 226px;
  padding: 18px 22px;
  color: #f5f0e6;
  background: @orange;
  border: 1px solid #9c4a1c;
  box-shadow: 7px 7px 0 @ink;
  cursor: pointer;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease;

  &:hover {
    box-shadow: 3px 3px 0 @ink;
    transform: translate(4px, 4px);
  }

  input {
    display: none;
  }

  > span:last-child {
    display: grid;
  }

  strong {
    font-size: 15px;
  }

  small {
    color: #f0cfb7;
    font-size: 10px;
  }
}

.plus {
  font-size: 30px;
  font-weight: 200;
}

.workspace {
  max-width: 1420px;
  margin: 0 auto;
  padding: 0 clamp(24px, 5vw, 78px) 90px;

  :deep(.ant-tabs-nav) {
    margin-bottom: 28px;
    border-bottom: 1px solid @line;
  }

  :deep(.ant-tabs-tab) {
    padding: 14px 2px;
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: 16px;
    font-weight: 700;
  }
}

.filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;

  nav {
    display: flex;
    gap: 4px;
    overflow-x: auto;
  }

  nav button {
    padding: 9px 12px;
    color: #5e665f;
    white-space: nowrap;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    cursor: pointer;

    span {
      margin-left: 5px;
      color: #94978e;
      font-family: "Courier New", monospace;
      font-size: 9px;
    }

    &.active {
      color: @ink;
      font-weight: 700;
      border-color: @orange;
    }
  }
}

.tools {
  display: flex;
  gap: 8px;
}

.search-input {
  width: 240px;
}

.sort-select {
  width: 118px;
}

.ledger {
  overflow: hidden;
  background: rgba(248, 246, 239, 0.72);
  border: 1px solid @line;
  box-shadow: 0 12px 40px rgba(42, 47, 42, 0.06);
}

.ledger-head,
.file-row {
  display: grid;
  grid-template-columns: minmax(300px, 2fr) 110px 100px 160px 126px;
  align-items: center;
}

.ledger-head {
  min-width: 900px;
  padding: 11px 22px 11px 62px;
  color: #7a7f77;
  font-family: "Courier New", monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: @paper-deep;
  border-bottom: 1px solid @line;
}

.ledger-body {
  min-width: 900px;
}

.file-row {
  position: relative;
  padding: 14px 22px 14px 62px;
  border-bottom: 1px solid #d8d2c5;
  transition: background 150ms ease;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: #fffdf7;
  }
}

.row-index {
  position: absolute;
  left: 20px;
  color: #a49d8e;
  font-family: "Courier New", monospace;
  font-size: 10px;
}

.file-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 13px;
  padding: 0;
  color: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;

  > span:last-child {
    display: grid;
    min-width: 0;
  }

  strong,
  small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    font-size: 13px;
  }

  small {
    max-width: 440px;
    margin-top: 3px;
    color: #8a8e86;
    font-family: "Courier New", monospace;
    font-size: 9px;
  }
}

.file-stamp {
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

.type-cell,
time,
.mono {
  color: #676d67;
  font-size: 11px;
}

.mono {
  font-family: "Courier New", monospace;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 5px;

  button {
    display: grid;
    place-items: center;
    width: 31px;
    height: 31px;
    color: #46514c;
    background: #eeeae0;
    border: 1px solid #cec7b9;
    cursor: pointer;

    &:hover {
      color: white;
      background: @green;
      border-color: @green;
    }

    &.danger:hover {
      background: #9f3f31;
      border-color: #9f3f31;
    }
  }
}

.ledger-footer {
  display: flex;
  justify-content: space-between;
  padding: 13px 4px;
  color: #777d76;
  font-size: 10px;

  button {
    color: @green;
    background: none;
    border: 0;
    cursor: pointer;
  }
}

.share-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 30px;
  margin: 18px 0 24px;

  h3 {
    margin: 7px 0 0;
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: 30px;
  }

  p {
    color: #737970;
    font-size: 11px;
  }
}

.share-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.share-card {
  padding: 22px;
  background: #f8f5ed;
  border: 1px solid @line;
  border-top: 4px solid @green;

  h4 {
    margin: 22px 0 4px;
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: 18px;
  }

  > p {
    min-height: 34px;
    margin: 0 0 15px;
    color: #747a73;
    font-size: 11px;
  }
}

.share-card-top,
.share-meta,
.share-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.share-status {
  padding: 3px 7px;
  color: #315547;
  font-size: 9px;
  background: #dce7df;
  border: 1px solid #99aa9e;

  &.inactive {
    color: #7d7469;
    background: #e7e2d8;
    border-color: #bfb7aa;
  }
}

.share-url {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  color: #40544b;
  background: #e9ede7;
  border: 1px dashed #9eaa9f;
  cursor: pointer;

  span {
    overflow: hidden;
    font-family: "Courier New", monospace;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.share-meta {
  margin: 13px 0;
  color: #8b8e87;
  font-size: 9px;
}

.share-actions {
  justify-content: flex-end;
}

.drop-curtain {
  position: fixed;
  z-index: 90;
  inset: 0;
  display: grid;
  place-items: center;
  color: white;
  background: rgba(23, 32, 29, 0.9);
  backdrop-filter: blur(5px);

  div {
    display: grid;
    place-items: center;
    width: min(560px, 78vw);
    height: 300px;
    border: 2px dashed #d69755;
  }

  span {
    color: #d69755;
    font-family: "Courier New", monospace;
    font-size: 11px;
    letter-spacing: 0.2em;
  }

  strong {
    margin-top: -90px;
    font-family: "Noto Serif SC", "SimSun", serif;
    font-size: 30px;
  }
}

@media (max-width: 860px) {
  .masthead-rule,
  .identity {
    display: none;
  }

  .intro {
    align-items: stretch;
    flex-direction: column;
  }

  .upload-button {
    width: 100%;
  }

  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .tools {
    width: 100%;
  }

  .search-input {
    flex: 1;
    width: auto;
  }

  .ledger {
    overflow-x: auto;
  }

  .share-heading {
    align-items: start;
    flex-direction: column;
  }
}
</style>
