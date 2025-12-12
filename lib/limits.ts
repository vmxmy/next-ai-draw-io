// 共享限制常量（前后端复用）
// 注意：保持纯常量文件，避免引入浏览器/Node 专属依赖。

export const MAX_FILES = 5
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB

export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / 1024 / 1024
