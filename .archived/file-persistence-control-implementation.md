# 控制文件保存实现方案

## 📋 需求分析

**目标**: 添加配置参数控制是否保存用户上传的文件到数据库
**默认值**: 不保存文件（节省存储空间）
**影响范围**: 图片 base64 数据（占总数据 48%）

## 🔍 当前文件处理流程分析

### 数据流路径

```
用户上传文件
    ↓
chat-panel.tsx: processFilesAndAppendContent()
    ├─ 图片 → FileReader.readAsDataURL() → base64 → parts[].url
    └─ PDF/文本 → 提取文本 → 合并到 userText
    ↓
onFormSubmit() → sendChatMessage()
    ↓
消息数组 messages[] (包含 file parts)
    ↓
use-local-conversations.ts: persistCurrentConversation()
    ↓
localStorage (ConversationPayload.messages)
    ↓
use-conversation-sync.ts: buildPushConversationInput()
    ↓
tRPC: conversation.push mutation
    ↓
PostgreSQL: Conversation.data (JSONB)
```

### 关键代码位置

1. **文件处理**: `features/chat/chat-panel.tsx:985-1021`
   - `processFilesAndAppendContent` 函数
   - 图片转 base64: line 1006-1016

2. **消息发送**: `features/chat/chat-panel.tsx:817-907`
   - `onFormSubmit` 函数
   - 构建 parts 数组: line 875-884

3. **本地持久化**: `features/chat/sessions/use-local-conversations.ts:242-318`
   - `persistCurrentConversation` 函数
   - 保存到 localStorage: line 282

4. **云端同步**: `features/chat/sync/use-conversation-sync.ts:120-144`
   - `buildPushConversationInput` 函数
   - 读取并推送到服务器: line 130-142

## 🎯 实现方案

### 方案选择

**推荐方案**: 在持久化前移除 file parts（而非在生成时控制）

**理由**:
1. 文件内容在当前会话中仍可用（用于 AI 分析）
2. 不影响实时对话体验
3. 只影响长期存储，节省空间
4. 实现简单，改动集中

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│  SystemConfig 表                                         │
│  key: "chat.persistUploadedFiles"                       │
│  value: { enabled: false }                              │
│  category: "general"                                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  /api/config 接口                                        │
│  返回: { persistUploadedFiles: boolean }                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  chat-panel.tsx                                          │
│  - 读取配置: persistUploadedFiles                        │
│  - 传递给 useLocalConversations                         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│  use-local-conversations.ts                              │
│  - persistCurrentConversation() 修改                     │
│  - 如果 !persistUploadedFiles:                          │
│    stripFilePartsFromMessages(messages)                 │
└─────────────────────────────────────────────────────────┘
```

## 📝 详细实现步骤

### Step 1: 数据库配置初始化

**文件**: `prisma/seed-system-config.ts`

```typescript
// 添加新配置项
await prisma.systemConfig.upsert({
  where: { key: "chat.persistUploadedFiles" },
  update: {},
  create: {
    key: "chat.persistUploadedFiles",
    value: { enabled: false }, // 默认不保存
    category: "general",
    description: "是否将用户上传的文件（图片 base64）保存到数据库。关闭可节省约 48% 存储空间",
  },
})
```

**执行**: `npm run db:seed` 或手动 SQL:
```sql
INSERT INTO "SystemConfig" (key, value, category, description, "createdAt", "updatedAt")
VALUES (
  'chat.persistUploadedFiles',
  '{"enabled": false}'::jsonb,
  'general',
  '是否将用户上传的文件（图片 base64）保存到数据库。关闭可节省约 48% 存储空间',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
```

### Step 2: API 接口返回配置

**文件**: `app/api/config/route.ts`

**位置**: 现有配置读取处（约 line 20-50）

```typescript
// 添加读取文件持久化配置
const persistFilesConfig = await prisma.systemConfig.findUnique({
  where: { key: "chat.persistUploadedFiles" },
})

const persistUploadedFiles =
  (persistFilesConfig?.value as { enabled?: boolean })?.enabled ?? false

// 在返回 JSON 中添加
return NextResponse.json({
  // ... 现有配置
  persistUploadedFiles,  // 新增
})
```

### Step 3: 前端读取配置

**文件**: `features/chat/chat-panel.tsx`

**位置**: `useEffect` 读取配置处（约 line 186-196）

```typescript
// 添加状态
const [persistUploadedFiles, setPersistUploadedFiles] = useState(false)

// 在现有 fetch("/api/config") useEffect 中添加
useEffect(() => {
  fetch("/api/config")
    .then((res) => res.json())
    .then((data) => {
      // ... 现有代码
      setPersistUploadedFiles(data.persistUploadedFiles ?? false)  // 新增
    })
    .catch(() => {
      // ... 错误处理
      setPersistUploadedFiles(false)  // 默认不保存
    })
}, [])
```

**传递给子组件**: `useLocalConversations` hook 调用处（约 line 400+）

```typescript
const {
  conversations,
  // ... 其他返回值
} = useLocalConversations({
  // ... 现有参数
  persistUploadedFiles,  // 新增传递
})
```

### Step 4: 实现文件 parts 移除逻辑

**文件**: `features/chat/sessions/use-local-conversations.ts`

**新增工具函数** (文件顶部):

```typescript
/**
 * 移除消息中的文件 parts（type: "file"），保留文本和其他 parts
 * @param messages 原始消息数组
 * @returns 移除文件后的新消息数组
 */
function stripFilePartsFromMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    const parts = (msg as any)?.parts
    if (!Array.isArray(parts)) return msg

    const keptParts = parts.filter((p: any) => p?.type !== "file")

    // 如果没有移除任何 parts，返回原消息（避免不必要的对象创建）
    if (keptParts.length === parts.length) return msg

    return { ...msg, parts: keptParts }
  })
}
```

**修改 `persistCurrentConversation` 函数** (约 line 242-318):

```typescript
const persistCurrentConversation = useCallback(
  (overrides: Partial<ConversationPayload>) => {
    if (!currentConversationId) return
    try {
      const existing = readConversationPayloadFromStorage(/* ... */)

      // 获取要保存的消息（可能来自 overrides 或 existing）
      let messagesToSave =
        overrides.messages ?? existing.messages ?? ([] as any)

      // 🔥 新增：如果不保存文件，移除 file parts
      if (!persistUploadedFiles) {
        messagesToSave = stripFilePartsFromMessages(messagesToSave)
      }

      const merged: ConversationPayload = {
        messages: messagesToSave,  // 使用处理后的消息
        xml: overrides.xml ?? existing.xml ?? "",
        // ... 其他字段
      }

      writeConversationPayloadToStorage(userId, currentConversationId, merged)
      // ... 其余逻辑不变
    } catch (error) {
      console.error("Failed to persist current conversation:", error)
    }
  },
  [
    currentConversationId,
    deriveConversationTitle,
    queuePushConversation,
    sessionId,
    userId,
    persistUploadedFiles,  // 🔥 新增依赖
  ],
)
```

**添加 hook 参数** (约 line 35-73):

```typescript
export function useLocalConversations({
  // ... 现有参数
  persistUploadedFiles,  // 🔥 新增
}: {
  // ... 现有类型
  persistUploadedFiles: boolean  // 🔥 新增类型
}) {
  // ... 函数体
}
```

### Step 5: 管理后台界面

**文件**: `app/admin/system-config/page.tsx`

在系统配置页面添加开关（如果有管理界面的话）:

```typescript
<div className="space-y-2">
  <Label>文件持久化</Label>
  <Switch
    checked={configs["chat.persistUploadedFiles"]?.enabled}
    onCheckedChange={async (checked) => {
      await updateConfig("chat.persistUploadedFiles", { enabled: checked })
    }}
  />
  <p className="text-sm text-muted-foreground">
    保存用户上传的文件到数据库。关闭可节省约 48% 存储空间（约 3-6 MB/用户）
  </p>
</div>
```

## 🧪 测试验证

### 测试用例

1. **关闭文件持久化（默认）**
   ```bash
   # 1. 确认配置为 false
   psql $DB_URL -c "SELECT value FROM \"SystemConfig\" WHERE key = 'chat.persistUploadedFiles';"

   # 2. 上传图片并发送消息
   # 3. 检查 localStorage
   # 4. 检查数据库
   psql $DB_URL -c "
   SELECT
     id,
     jsonb_array_length(data::jsonb->'messages'->0->'parts') as parts_count,
     data::jsonb->'messages'->0->'parts'->0->>'type' as first_part_type,
     data::jsonb->'messages'->0->'parts'->1->>'type' as second_part_type,
     LENGTH(data::text) as data_size
   FROM \"Conversation\"
   WHERE \"userId\" = 'YOUR_USER_ID'
   ORDER BY \"updatedAt\" DESC LIMIT 1;
   "

   # 预期：只有 text part，没有 file part
   ```

2. **开启文件持久化**
   ```sql
   UPDATE "SystemConfig"
   SET value = '{"enabled": true}'::jsonb
   WHERE key = 'chat.persistUploadedFiles';
   ```

   重复测试，预期：包含 file part (type: "file")

### 验证检查清单

- [ ] 配置默认值为 false
- [ ] /api/config 正确返回配置
- [ ] 前端正确读取配置
- [ ] 关闭时：file parts 不保存到 localStorage
- [ ] 关闭时：file parts 不同步到数据库
- [ ] 开启时：file parts 正常保存
- [ ] 当前会话：文件仍可用于 AI 分析（运行时内存）

## 📊 预期效果

### 存储空间节省

**当前（保存文件）**:
- 平均每用户 20 个活跃会话
- 总数据 6.1 MB
- 其中 file parts: 3.0 MB (48%)

**优化后（不保存文件）**:
- 平均每用户 20 个活跃会话
- 总数据 3.1 MB (-49%)
- 数据库容量节省: ~50%

### 成本估算

假设 10,000 活跃用户:
- **优化前**: 6.1 MB × 10,000 = 61 GB
- **优化后**: 3.1 MB × 10,000 = 31 GB
- **节省**: 30 GB 数据库存储

PostgreSQL 成本（以 AWS RDS 为例）:
- 每 GB 存储约 $0.115/月
- 节省: 30 GB × $0.115 = **$3.45/月**

## 🚀 部署步骤

1. **数据库迁移**
   ```bash
   # 添加配置项
   npm run db:seed
   # 或手动执行 SQL
   ```

2. **代码部署**
   - 合并代码到主分支
   - 部署到生产环境

3. **验证**
   - 检查 /api/config 返回
   - 测试新会话文件上传
   - 监控数据库存储增长

4. **通知**
   - 如需变更默认行为，提前通知管理员
   - 文档更新

## 🔄 回滚方案

如果出现问题，可以快速回滚：

```sql
-- 启用文件持久化（恢复旧行为）
UPDATE "SystemConfig"
SET value = '{"enabled": true}'::jsonb
WHERE key = 'chat.persistUploadedFiles';
```

或直接删除配置（代码会使用默认值 false）:
```sql
DELETE FROM "SystemConfig" WHERE key = 'chat.persistUploadedFiles';
```

## 📌 注意事项

1. **历史数据不受影响**: 已存储的文件不会被删除
2. **实时对话正常**: 文件内容在当前会话中仍可用
3. **跨设备同步**: 关闭持久化后，文件不会跨设备同步
4. **用户体验**: 用户无感知，仅影响后台存储

## 🔮 未来优化

1. **分级存储**
   - 最近 7 天：保存到数据库
   - 7 天以上：迁移到对象存储（S3/OSS）

2. **压缩优化**
   - 前端上传前自动压缩图片
   - 使用 WebP 格式（比 PNG 小 30-50%）

3. **按用户等级控制**
   - 免费用户：不保存文件
   - 付费用户：保存 30 天
   - 企业用户：永久保存

4. **用户可选**
   - 在设置中允许用户自主选择是否保存文件
   - 提示存储空间占用情况
