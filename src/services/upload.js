import { completeUpload, presignUpload } from "../api/files";

export function calculateMd5(file, onProgress) {
  const worker = new Worker(
    new URL("../workers/md5.worker.js", import.meta.url),
  );
  let cancel;
  const promise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      callback(value);
    };
    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);

    worker.onmessage = ({ data }) => {
      if (data.type === "progress") onProgress?.(data.progress);
      if (data.type === "complete") {
        resolveOnce(data);
      }
      if (data.type === "error") {
        rejectOnce(new Error(data.message));
      }
    };
    worker.onerror = (event) => {
      rejectOnce(new Error(event.message || "MD5 Worker 异常"));
    };
    cancel = () => rejectOnce(new DOMException("指纹计算已取消", "AbortError"));
    worker.postMessage(file);
  });
  return { promise, cancel: () => cancel?.() };
}

export function putToOss({
  url,
  file,
  contentMd5,
  signedHeaders = {},
  onProgress,
}) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open("PUT", url);
    const headers = {
      "Content-Type": file.type || "application/octet-stream",
      "Content-MD5": contentMd5,
      ...signedHeaders,
    };
    Object.entries(headers).forEach(([name, value]) => {
      if (value != null) xhr.setRequestHeader(name, value);
    });
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`OSS 返回 HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("OSS 上传网络错误"));
    xhr.onabort = () => reject(new DOMException("上传已取消", "AbortError"));
    xhr.send(file);
  });
  return { promise, cancel: () => xhr.abort() };
}

export async function uploadFile(file, hooks = {}) {
  const { promise: digestPromise, cancel: cancelDigest } = calculateMd5(
    file,
    (progress) => hooks.onState?.("hashing", progress),
  );
  hooks.onCancelReady?.(cancelDigest);
  const { md5, contentMd5 } = await digestPromise;
  const metadata = {
    file_id: md5,
    file_name: file.name,
    file_size: file.size,
    content_type: file.type || "application/octet-stream",
    content_md5: contentMd5,
  };

  hooks.onState?.("presigning", 0);
  const response = await presignUpload(metadata);
  const signed = response?.data ?? response;
  if (!signed?.skip_upload) {
    const url = signed?.presigned_url || signed?.upload_url;
    if (!url) throw new Error("服务端未返回 OSS 上传地址");
    const { promise, cancel } = putToOss({
      url,
      file,
      contentMd5,
      signedHeaders: signed.headers || signed.signed_headers,
      onProgress: (progress) => hooks.onState?.("uploading", progress),
    });
    hooks.onCancelReady?.(cancel);
    await promise;
    hooks.onState?.("completing", 100);
    await completeUpload(metadata);
  }
  hooks.onState?.("done", 100, Boolean(signed?.skip_upload));
}
