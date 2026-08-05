import api from "../plugins/axios";

const FILE_INFO = "/api/upload/file_info/";
const SHARE_LINK = "/api/upload/share_link/";
const PRESIGN = "/api/upload/presign";

export function listFiles(params) {
  return api.get(FILE_INFO, { params });
}

export function deleteFile(id) {
  return api.delete(`${FILE_INFO}${id}`);
}

export function presignUpload(data) {
  return api.post(`${PRESIGN}/upload`, data);
}

export function completeUpload(data) {
  return api.post(`${PRESIGN}/complete`, data);
}

export function getDownloadUrl(id, disposition = "inline") {
  return api.get(`${PRESIGN}/download/${id}`, {
    params: { disposition },
  });
}

export function listShares(params) {
  return api.get(SHARE_LINK, { params });
}

export function createShare(data) {
  return api.post(SHARE_LINK, data);
}

export function revokeShare(id) {
  return api.put(`${SHARE_LINK}${id}/revoke`);
}

export function deleteShare(id) {
  return api.delete(`${SHARE_LINK}${id}`);
}
