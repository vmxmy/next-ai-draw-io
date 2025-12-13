import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16 // GCM 标准 IV 长度
const CURRENT_KEY_VERSION = 1 // 当前使用的密钥版本

/**
 * 多版本加密密钥配置
 * 支持密钥轮换：新数据使用最新版本，旧数据用旧版本解密
 */
const ENCRYPTION_KEYS: Record<number, string | undefined> = {
    1: process.env.ENCRYPTION_KEY,
    // 轮换密钥时添加新版本:
    // 2: process.env.ENCRYPTION_KEY_V2,
}

/**
 * 获取指定版本的加密密钥
 * @param version 密钥版本（默认使用当前版本）
 */
function getEncryptionKey(version: number = CURRENT_KEY_VERSION): Buffer {
    const key = ENCRYPTION_KEYS[version]
    if (!key) {
        throw new Error(
            `[encryption] ENCRYPTION_KEY for version ${version} not found. ` +
                "Generate one using: openssl rand -base64 32",
        )
    }

    // Base64 解码为 32 字节密钥
    const keyBuffer = Buffer.from(key, "base64")
    if (keyBuffer.length !== 32) {
        throw new Error(
            `[encryption] Key version ${version} must be exactly 32 bytes (256 bits). ` +
                `Current length: ${keyBuffer.length}`,
        )
    }

    return keyBuffer
}

/**
 * 验证所有配置的加密密钥
 * 应在服务器启动时调用，确保密钥配置正确
 */
export function validateEncryptionKeys(): void {
    try {
        // 至少验证当前版本的密钥
        getEncryptionKey(CURRENT_KEY_VERSION)
        console.log(
            `[encryption] Encryption keys validated successfully (current version: ${CURRENT_KEY_VERSION})`,
        )
    } catch (error) {
        console.error("[encryption] FATAL: Encryption key validation failed")
        throw error
    }
}

export interface EncryptedData {
    encryptedData: string // Base64 编码的密文
    iv: string // Base64 编码的初始化向量
    authTag: string // Base64 编码的认证标签
    keyVersion: number // 密钥版本
}

/**
 * 加密敏感数据（API Key）
 * 使用 AES-256-GCM 提供加密和完整性验证
 * 自动使用当前密钥版本
 *
 * @param plaintext - 明文字符串
 * @returns 包含密文、IV、authTag 和密钥版本的对象
 */
export function encryptApiKey(plaintext: string): EncryptedData {
    const key = getEncryptionKey(CURRENT_KEY_VERSION)
    const iv = randomBytes(IV_LENGTH)

    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, "utf8", "base64")
    encrypted += cipher.final("base64")

    const authTag = cipher.getAuthTag()

    return {
        encryptedData: encrypted,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        keyVersion: CURRENT_KEY_VERSION,
    }
}

/**
 * 解密敏感数据
 * 验证完整性并返回明文
 * 支持多版本密钥（自动使用数据中的密钥版本）
 *
 * @param data - 包含密文、IV、authTag 和密钥版本的对象
 * @returns 明文字符串
 * @throws 如果认证失败、密文被篡改或密钥版本不存在
 */
export function decryptApiKey(data: EncryptedData): string {
    const keyVersion = data.keyVersion || 1 // 向后兼容旧数据
    const key = getEncryptionKey(keyVersion)
    const iv = Buffer.from(data.iv, "base64")
    const authTag = Buffer.from(data.authTag, "base64")

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(data.encryptedData, "base64", "utf8")
    decrypted += decipher.final("utf8")

    return decrypted
}
