import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryOf,
  filterAndSortFiles,
  formatBytes,
  previewKind,
} from "../src/utils/files.js";

test("按扩展名识别虚拟分类和预览方式", () => {
  assert.equal(categoryOf({ file_name: "photo.WEBP" }), "image");
  assert.equal(categoryOf({ ext: ".mp4" }), "video");
  assert.equal(categoryOf({ file_name: "report.pdf" }), "document");
  assert.equal(categoryOf({ file_name: "archive.zip" }), "other");
  assert.equal(previewKind({ file_name: "report.pdf" }), "pdf");
  assert.equal(previewKind({ file_name: "archive.zip" }), "download");
});

test("筛选不修改原数组并支持分类、搜索和排序", () => {
  const files = [
    { file_name: "b.png", file_size: 20, create_at: "2026-01-01" },
    { file_name: "a.png", file_size: 10, create_at: "2026-02-01" },
    { file_name: "memo.txt", file_size: 30, create_at: "2026-03-01" },
  ];
  const result = filterAndSortFiles(files, {
    category: "image",
    query: ".png",
    sort: "name",
  });
  assert.deepEqual(
    result.map((file) => file.file_name),
    ["a.png", "b.png"],
  );
  assert.equal(files[0].file_name, "b.png");
});

test("文件容量采用易读单位", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});
