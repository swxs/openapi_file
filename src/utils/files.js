export const FILE_CATEGORIES = {
  image: new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"]),
  video: new Set(["mp4", "webm", "mov", "m4v", "avi", "mkv", "ogv"]),
  document: new Set([
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "md",
    "csv",
    "rtf",
  ]),
};

export function extensionOf(file) {
  const source = file.ext || file.file_name || "";
  return source.toLowerCase().replace(/^\./, "").split(".").pop();
}

export function categoryOf(file) {
  const extension = extensionOf(file);
  if (FILE_CATEGORIES.image.has(extension)) return "image";
  if (FILE_CATEGORIES.video.has(extension)) return "video";
  if (FILE_CATEGORIES.document.has(extension)) return "document";
  return "other";
}

export function previewKind(file) {
  const extension = extensionOf(file);
  if (FILE_CATEGORIES.image.has(extension)) return "image";
  if (FILE_CATEGORIES.video.has(extension)) return "video";
  if (extension === "pdf") return "pdf";
  return "download";
}

export function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const amount = bytes / 1024 ** exponent;
  return `${amount >= 100 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

export function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function filterAndSortFiles(files, options = {}) {
  const { category = "all", query = "", sort = "newest" } = options;
  const needle = query.trim().toLocaleLowerCase();
  const filtered = files.filter((file) => {
    const matchesCategory = category === "all" || categoryOf(file) === category;
    const matchesQuery =
      !needle ||
      `${file.file_name || ""} ${file.description || ""}`
        .toLocaleLowerCase()
        .includes(needle);
    return matchesCategory && matchesQuery;
  });
  const directions = {
    newest: (a, b) =>
      new Date(b.updated || b.create_at || 0) -
      new Date(a.updated || a.create_at || 0),
    oldest: (a, b) =>
      new Date(a.updated || a.create_at || 0) -
      new Date(b.updated || b.create_at || 0),
    name: (a, b) =>
      (a.file_name || "").localeCompare(b.file_name || "", "zh-CN"),
    largest: (a, b) => Number(b.file_size || 0) - Number(a.file_size || 0),
  };
  return [...filtered].sort(directions[sort] || directions.newest);
}

export function unwrapData(response) {
  return response?.data?.data ?? response?.data ?? response;
}

export function unwrapList(response) {
  const payload = response?.data ?? response;
  const data = Array.isArray(payload) ? payload : payload?.data || [];
  return {
    data,
    total: payload?.pagination?.total ?? data.length,
  };
}
