import SparkMD5 from "spark-md5";

const CHUNK_SIZE = 4 * 1024 * 1024;

function hexToBase64(hex) {
  let binary = "";
  for (let index = 0; index < hex.length; index += 2) {
    binary += String.fromCharCode(parseInt(hex.slice(index, index + 2), 16));
  }
  return btoa(binary);
}

self.onmessage = async (event) => {
  const file = event.data;
  const spark = new SparkMD5.ArrayBuffer();
  const chunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

  try {
    for (let index = 0; index < chunks; index += 1) {
      const start = index * CHUNK_SIZE;
      const chunk = await file
        .slice(start, Math.min(start + CHUNK_SIZE, file.size))
        .arrayBuffer();
      spark.append(chunk);
      self.postMessage({
        type: "progress",
        progress: Math.round(((index + 1) / chunks) * 100),
      });
    }
    const md5 = spark.end();
    self.postMessage({
      type: "complete",
      md5,
      contentMd5: hexToBase64(md5),
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "MD5 计算失败",
    });
  }
};
