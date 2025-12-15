"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/contexts/i18n-context"

export default function PrivacyPage() {
    const { locale } = useI18n()

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="mb-8">
                    <Link href="/">
                        <Button variant="ghost">← 返回首页</Button>
                    </Link>
                </div>

                <div className="prose prose-slate dark:prose-invert max-w-none">
                    {locale === "zh-CN" ? (
                        <>
                            <h1 className="text-4xl font-bold mb-8">
                                隐私政策
                            </h1>

                            <div className="text-sm text-muted-foreground mb-8">
                                最后更新日期：2025年1月
                            </div>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    引言
                                </h2>
                                <p className="mb-4">
                                    Next AI
                                    Draw.io（以下简称"我们"或"本服务"）非常重视您的隐私。本隐私政策说明了我们如何收集、使用、存储和保护您的个人信息。
                                </p>
                                <p className="mb-4">
                                    使用本服务即表示您同意本隐私政策。如果您不同意，请勿使用本服务。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    1. 我们收集的信息
                                </h2>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    1.1 匿名用户
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>浏览器本地存储</strong>
                                        ：会话数据、聊天历史、图表内容仅存储在您的浏览器
                                        localStorage 中
                                    </li>
                                    <li>
                                        <strong>IP 地址</strong>
                                        ：用于防滥用和配额管理（经过 SHA-256
                                        哈希处理，不存储原始 IP）
                                    </li>
                                    <li>
                                        <strong>使用数据</strong>
                                        ：请求次数、Token 消耗量等匿名统计信息
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    1.2 注册用户
                                </h3>
                                <p className="mb-4">
                                    除上述匿名用户数据外，我们还会收集：
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>账户信息</strong>：
                                        <ul className="list-circle pl-6 mt-2">
                                            <li>
                                                手机号码（仅当您选择手机登录时）
                                            </li>
                                            <li>
                                                Google/GitHub
                                                账户信息（邮箱、头像、姓名）
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>会话数据</strong>
                                        ：聊天历史、图表内容、版本记录（存储在云端数据库）
                                    </li>
                                    <li>
                                        <strong>配额使用记录</strong>
                                        ：请求次数、Token 消耗、时间戳
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    1.3 自动收集的信息
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>设备类型和操作系统</li>
                                    <li>浏览器类型和版本</li>
                                    <li>访问时间和页面浏览记录</li>
                                    <li>错误日志和诊断信息</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    2. 信息使用方式
                                </h2>
                                <p className="mb-4">我们使用收集的信息用于：</p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>提供服务</strong>
                                        ：处理您的请求，生成和编辑图表
                                    </li>
                                    <li>
                                        <strong>账户管理</strong>
                                        ：创建和维护您的账户，实现云端同步
                                    </li>
                                    <li>
                                        <strong>配额管理</strong>
                                        ：跟踪和限制使用量，防止滥用
                                    </li>
                                    <li>
                                        <strong>服务改进</strong>
                                        ：分析使用模式，优化功能和性能
                                    </li>
                                    <li>
                                        <strong>安全保护</strong>
                                        ：检测和防止欺诈、滥用或违法行为
                                    </li>
                                    <li>
                                        <strong>技术支持</strong>
                                        ：诊断和解决技术问题
                                    </li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    3. 数据存储与安全
                                </h2>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    3.1 存储位置
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>匿名用户</strong>
                                        ：数据仅存储在您的浏览器本地，不上传到服务器
                                    </li>
                                    <li>
                                        <strong>登录用户</strong>
                                        ：数据存储在我们的云端数据库（PostgreSQL）
                                    </li>
                                    <li>
                                        <strong>AI 服务商</strong>
                                        ：您的聊天内容会发送至第三方 AI
                                        服务商（如 OpenAI、Anthropic
                                        等）进行处理
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    3.2 安全措施
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>使用 HTTPS 加密传输</li>
                                    <li>IP 地址经过 SHA-256 哈希处理</li>
                                    <li>数据库访问权限严格控制</li>
                                    <li>定期备份重要数据</li>
                                    <li>
                                        手机验证码采用时效性和一次性验证机制
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    3.3 数据保留
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        匿名用户：数据在浏览器中保留，直到您清除浏览器数据
                                    </li>
                                    <li>
                                        登录用户：会话数据永久保留，除非您主动删除或注销账户
                                    </li>
                                    <li>
                                        配额记录：保留最近 30
                                        天的详细记录，更早的记录会被聚合
                                    </li>
                                    <li>
                                        日志数据：保留最近 90 天用于故障排查
                                    </li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    4. 信息共享与披露
                                </h2>
                                <p className="mb-4">
                                    我们不会出售、出租或交易您的个人信息。我们可能在以下情况下共享信息：
                                </p>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    4.1 第三方服务商
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>AI 服务商</strong>
                                        ：OpenAI、Anthropic、Google
                                        等（处理您的聊天请求）
                                    </li>
                                    <li>
                                        <strong>云服务商</strong>
                                        ：用于托管数据库和应用服务器
                                    </li>
                                    <li>
                                        <strong>短信服务商</strong>
                                        ：发送手机验证码
                                    </li>
                                    <li>
                                        <strong>身份验证服务</strong>：Google
                                        OAuth、GitHub OAuth
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    4.2 法律要求
                                </h3>
                                <p className="mb-4">
                                    如法律要求或为保护我们的权利，我们可能披露您的信息：
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>遵守法律程序、法院命令或政府要求</li>
                                    <li>执行我们的服务条款</li>
                                    <li>保护我们或他人的权利、财产或安全</li>
                                    <li>防止或调查欺诈或非法活动</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    5. Cookie 与追踪技术
                                </h2>
                                <p className="mb-4">我们使用以下技术：</p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>必要 Cookie</strong>
                                        ：用于维持登录状态（NextAuth session）
                                    </li>
                                    <li>
                                        <strong>LocalStorage</strong>
                                        ：存储用户偏好、会话数据、图表历史
                                    </li>
                                    <li>
                                        <strong>分析工具</strong>
                                        ：我们目前未使用第三方分析工具（如
                                        Google Analytics）
                                    </li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    6. 您的权利
                                </h2>
                                <p className="mb-4">
                                    您对您的个人信息拥有以下权利：
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>访问权</strong>
                                        ：查看我们持有的您的个人信息
                                    </li>
                                    <li>
                                        <strong>更正权</strong>
                                        ：更新或修正不准确的信息
                                    </li>
                                    <li>
                                        <strong>删除权</strong>
                                        ：删除您的账户和相关数据（在用户中心可操作）
                                    </li>
                                    <li>
                                        <strong>导出权</strong>
                                        ：下载您的会话数据（Draw.io 格式）
                                    </li>
                                    <li>
                                        <strong>撤回同意</strong>
                                        ：随时停止使用本服务
                                    </li>
                                </ul>
                                <p className="mb-4">
                                    如需行使这些权利，请通过 GitHub Issues
                                    联系我们。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    7. 儿童隐私
                                </h2>
                                <p className="mb-4">
                                    本服务不面向 13
                                    岁以下儿童。我们不会故意收集儿童的个人信息。如果您发现我们收集了儿童的信息，请联系我们，我们将立即删除。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    8. 国际数据传输
                                </h2>
                                <p className="mb-4">
                                    您的数据可能被传输到您所在国家/地区以外的服务器进行处理和存储。我们会采取合理措施确保数据在传输过程中的安全。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    9. 隐私政策更新
                                </h2>
                                <p className="mb-4">
                                    我们可能会不时更新本隐私政策。更新后的政策将在本页面发布，并注明"最后更新日期"。重大变更时，我们会在服务中显著位置通知您。
                                </p>
                                <p className="mb-4">
                                    继续使用本服务即表示您接受更新后的隐私政策。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    10. 开源与自托管
                                </h2>
                                <p className="mb-4">
                                    本项目是开源的，您可以查看源代码了解我们如何处理数据。如果您选择自行部署，您将完全控制您的数据，本隐私政策将不适用于您的自托管实例。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    11. 联系我们
                                </h2>
                                <p className="mb-4">
                                    如对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>GitHub Issues</li>
                                    <li>项目仓库：github.com/your-repo</li>
                                </ul>
                            </section>

                            <div className="mt-12 p-6 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                    我们承诺保护您的隐私和数据安全。如有任何疑虑，请随时与我们联系。
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <h1 className="text-4xl font-bold mb-8">
                                Privacy Policy
                            </h1>

                            <div className="text-sm text-muted-foreground mb-8">
                                Last Updated: January 2025
                            </div>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    Introduction
                                </h2>
                                <p className="mb-4">
                                    Next AI Draw.io ("we" or "the Service")
                                    values your privacy. This Privacy Policy
                                    explains how we collect, use, store, and
                                    protect your personal information.
                                </p>
                                <p className="mb-4">
                                    By using the Service, you agree to this
                                    Privacy Policy. If you do not agree, please
                                    do not use the Service.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    1. Information We Collect
                                </h2>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    1.1 Anonymous Users
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>Browser Local Storage</strong>:
                                        Session data, chat history, and diagrams
                                        stored in your browser's localStorage
                                    </li>
                                    <li>
                                        <strong>IP Address</strong>: Used for
                                        abuse prevention and quota management
                                        (SHA-256 hashed, original IP not stored)
                                    </li>
                                    <li>
                                        <strong>Usage Data</strong>: Request
                                        counts, token consumption (anonymous
                                        statistics)
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    1.2 Registered Users
                                </h3>
                                <p className="mb-4">
                                    In addition to anonymous user data:
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>Account Information</strong>:
                                        <ul className="list-circle pl-6 mt-2">
                                            <li>
                                                Phone number (if phone login
                                                used)
                                            </li>
                                            <li>
                                                Google/GitHub account info
                                                (email, avatar, name)
                                            </li>
                                        </ul>
                                    </li>
                                    <li>
                                        <strong>Session Data</strong>: Chat
                                        history, diagrams, version history
                                        (stored in cloud database)
                                    </li>
                                    <li>
                                        <strong>Quota Usage</strong>: Request
                                        counts, token consumption, timestamps
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    1.3 Automatically Collected Information
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>Device type and operating system</li>
                                    <li>Browser type and version</li>
                                    <li>Access times and page views</li>
                                    <li>Error logs and diagnostics</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    2. How We Use Information
                                </h2>
                                <p className="mb-4">
                                    We use collected information to:
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>Provide Services</strong>:
                                        Process requests, generate and edit
                                        diagrams
                                    </li>
                                    <li>
                                        <strong>Account Management</strong>:
                                        Create and maintain accounts, enable
                                        cloud sync
                                    </li>
                                    <li>
                                        <strong>Quota Management</strong>: Track
                                        and limit usage, prevent abuse
                                    </li>
                                    <li>
                                        <strong>Service Improvement</strong>:
                                        Analyze usage patterns, optimize
                                        features
                                    </li>
                                    <li>
                                        <strong>Security</strong>: Detect and
                                        prevent fraud, abuse, or illegal
                                        activities
                                    </li>
                                    <li>
                                        <strong>Technical Support</strong>:
                                        Diagnose and resolve issues
                                    </li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    3. Data Storage & Security
                                </h2>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    3.1 Storage Location
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>Anonymous Users</strong>: Data
                                        stored locally in your browser only
                                    </li>
                                    <li>
                                        <strong>Logged-in Users</strong>: Data
                                        stored in our cloud database
                                        (PostgreSQL)
                                    </li>
                                    <li>
                                        <strong>AI Providers</strong>: Chat
                                        content sent to third-party AI providers
                                        (OpenAI, Anthropic, etc.)
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    3.2 Security Measures
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        HTTPS encryption for data transmission
                                    </li>
                                    <li>IP addresses SHA-256 hashed</li>
                                    <li>Strict database access controls</li>
                                    <li>Regular data backups</li>
                                    <li>
                                        Time-limited, one-time verification
                                        codes
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    3.3 Data Retention
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        Anonymous users: Data retained until you
                                        clear browser data
                                    </li>
                                    <li>
                                        Logged-in users: Session data retained
                                        permanently unless deleted or account
                                        closed
                                    </li>
                                    <li>
                                        Quota records: Detailed records kept for
                                        30 days
                                    </li>
                                    <li>
                                        Logs: Kept for 90 days for
                                        troubleshooting
                                    </li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    4. Information Sharing & Disclosure
                                </h2>
                                <p className="mb-4">
                                    We do not sell, rent, or trade your personal
                                    information. We may share information in the
                                    following circumstances:
                                </p>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    4.1 Third-Party Service Providers
                                </h3>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>AI Providers</strong>: OpenAI,
                                        Anthropic, Google (process chat
                                        requests)
                                    </li>
                                    <li>
                                        <strong>Cloud Providers</strong>: Host
                                        databases and application servers
                                    </li>
                                    <li>
                                        <strong>SMS Providers</strong>: Send
                                        verification codes
                                    </li>
                                    <li>
                                        <strong>Authentication</strong>: Google
                                        OAuth, GitHub OAuth
                                    </li>
                                </ul>

                                <h3 className="text-xl font-semibold mb-3 mt-6">
                                    4.2 Legal Requirements
                                </h3>
                                <p className="mb-4">
                                    We may disclose information if required by
                                    law or to protect our rights:
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        Comply with legal processes, court
                                        orders, or government requests
                                    </li>
                                    <li>Enforce our Terms of Service</li>
                                    <li>
                                        Protect rights, property, or safety of
                                        us or others
                                    </li>
                                    <li>
                                        Prevent or investigate fraud or illegal
                                        activities
                                    </li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    5. Cookies & Tracking Technologies
                                </h2>
                                <p className="mb-4">
                                    We use the following technologies:
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>Essential Cookies</strong>:
                                        Maintain login sessions (NextAuth)
                                    </li>
                                    <li>
                                        <strong>LocalStorage</strong>: Store
                                        user preferences, session data, diagram
                                        history
                                    </li>
                                    <li>
                                        <strong>Analytics</strong>: We currently
                                        do not use third-party analytics (e.g.,
                                        Google Analytics)
                                    </li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    6. Your Rights
                                </h2>
                                <p className="mb-4">
                                    You have the following rights regarding your
                                    personal information:
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        <strong>Access</strong>: View your
                                        personal information we hold
                                    </li>
                                    <li>
                                        <strong>Correction</strong>: Update or
                                        correct inaccurate information
                                    </li>
                                    <li>
                                        <strong>Deletion</strong>: Delete your
                                        account and related data (available in
                                        user center)
                                    </li>
                                    <li>
                                        <strong>Export</strong>: Download your
                                        session data (Draw.io format)
                                    </li>
                                    <li>
                                        <strong>Withdraw Consent</strong>: Stop
                                        using the Service at any time
                                    </li>
                                </ul>
                                <p className="mb-4">
                                    To exercise these rights, contact us via
                                    GitHub Issues.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    7. Children's Privacy
                                </h2>
                                <p className="mb-4">
                                    The Service is not intended for children
                                    under 13. We do not knowingly collect
                                    children's personal information. If you
                                    discover we have collected such information,
                                    contact us and we will delete it
                                    immediately.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    8. International Data Transfers
                                </h2>
                                <p className="mb-4">
                                    Your data may be transferred to servers
                                    outside your country for processing and
                                    storage. We take reasonable measures to
                                    ensure data security during transfer.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    9. Privacy Policy Updates
                                </h2>
                                <p className="mb-4">
                                    We may update this Privacy Policy from time
                                    to time. Updated policies will be posted on
                                    this page with a "Last Updated" date. For
                                    significant changes, we will notify you
                                    prominently in the Service.
                                </p>
                                <p className="mb-4">
                                    Continued use of the Service indicates
                                    acceptance of the updated policy.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    10. Open Source & Self-Hosting
                                </h2>
                                <p className="mb-4">
                                    This project is open-source. You can review
                                    the source code to understand how we handle
                                    data. If you self-host, you have full
                                    control of your data, and this Privacy
                                    Policy will not apply to your self-hosted
                                    instance.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    11. Contact Us
                                </h2>
                                <p className="mb-4">
                                    For questions or suggestions about this
                                    Privacy Policy, contact us via:
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>GitHub Issues</li>
                                    <li>
                                        Project Repository: github.com/your-repo
                                    </li>
                                </ul>
                            </section>

                            <div className="mt-12 p-6 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                    We are committed to protecting your privacy
                                    and data security. If you have any concerns,
                                    please feel free to contact us.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
