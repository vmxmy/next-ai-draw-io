import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16 // GCM 标准 IV 长度

/**
 * 获取加密密钥（从环境变量）
 * 要求：32 字节（256 位）base64 编码
 * 生成命令：openssl rand -base64 32
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
        throw new Error(
            "[encryption] ENCRYPTION_KEY environment variable is required. " +
                "Generate one using: openssl rand -base64 32",
        )
    }

    // Base64 解码为 32 字节密钥
    const keyBuffer = Buffer.from(key, "base64")
    if (keyBuffer.length !== 32) {
        throw new Error(
            `[encryption] ENCRYPTION_KEY must be exactly 32 bytes (256 bits). ` +
                `Current length: ${keyBuffer.length}`,
        )
    }

    return keyBuffer
}

export interface EncryptedData {
    encryptedData: string // Base64 编码的密文
    iv: string // Base64 编码的初始化向量
    authTag: string // Base64 编码的认证标签
}

/**
 * 加密敏感数据（API Key）
 * 使用 AES-256-GCM 提供加密和完整性验证
 *
 * @param plaintext - 明文字符串
 * @returns 包含密文、IV 和 authTag 的对象
 */
export function encryptApiKey(plaintext: string): EncryptedData {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, "utf8", "base64")
    encrypted += cipher.final("base64")

    const authTag = cipher.getAuthTag()

    return {
        encryptedData: encrypted,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
    }
}

/**
 * 解密敏感数据
 * 验证完整性并返回明文
 *
 * @param data - 包含密文、IV 和 authTag 的对象
 * @returns 明文字符串
 * @throws 如果认证失败或密文被篡改
 */
export function decryptApiKey(data: EncryptedData): string {
    const key = getEncryptionKey()
    const iv = Buffer.from(data.iv, "base64")
    const authTag = Buffer.from(data.authTag, "base64")

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(data.encryptedData, "base64", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
}
