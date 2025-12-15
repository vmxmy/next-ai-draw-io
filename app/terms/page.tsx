"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/contexts/i18n-context"

export default function TermsPage() {
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
                                用户服务协议
                            </h1>

                            <div className="text-sm text-muted-foreground mb-8">
                                最后更新日期：2025年1月
                            </div>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    1. 协议接受
                                </h2>
                                <p className="mb-4">
                                    欢迎使用 Next AI
                                    Draw.io（以下简称"本服务"）。通过访问或使用本服务，您同意接受本用户服务协议（以下简称"本协议"）的约束。如果您不同意本协议的任何条款，请勿使用本服务。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    2. 服务说明
                                </h2>
                                <p className="mb-4">
                                    本服务是一个基于人工智能的在线图表生成工具，允许用户通过自然语言描述创建、编辑和分析流程图、架构图等各类图表。
                                </p>
                                <p className="mb-4">服务功能包括但不限于：</p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>AI 驱动的图表生成</li>
                                    <li>图表编辑和修改</li>
                                    <li>图表历史版本管理</li>
                                    <li>会话历史保存（登录用户）</li>
                                    <li>云端同步功能（登录用户）</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    3. 账户注册与安全
                                </h2>
                                <p className="mb-4">
                                    3.1
                                    您可以选择匿名使用本服务或通过手机号、Google、GitHub
                                    等方式注册账户。
                                </p>
                                <p className="mb-4">
                                    3.2
                                    您有责任维护账户信息的保密性，并对账户下的所有活动负责。
                                </p>
                                <p className="mb-4">
                                    3.3
                                    如发现账户被未经授权使用，您应立即通知我们。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    4. 使用规则
                                </h2>
                                <p className="mb-4">在使用本服务时，您同意：</p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        不得使用本服务进行任何非法、有害或违反公序良俗的活动
                                    </li>
                                    <li>
                                        不得滥用本服务，包括但不限于恶意请求、自动化攻击等
                                    </li>
                                    <li>
                                        不得上传或生成包含非法、淫秽、暴力、仇恨言论等违法内容
                                    </li>
                                    <li>
                                        不得侵犯他人的知识产权、隐私权或其他合法权益
                                    </li>
                                    <li>遵守所有适用的法律法规</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    5. 配额与限制
                                </h2>
                                <p className="mb-4">
                                    5.1 匿名用户每天可免费使用有限的请求次数和
                                    Token 额度。
                                </p>
                                <p className="mb-4">
                                    5.2 注册用户享有更高的每日请求和 Token
                                    配额。
                                </p>
                                <p className="mb-4">
                                    5.3 我们保留根据实际情况调整配额限制的权利。
                                </p>
                                <p className="mb-4">
                                    5.4
                                    如需更高额度，请联系我们或考虑自行部署开源版本。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    6. 知识产权
                                </h2>
                                <p className="mb-4">
                                    6.1
                                    本服务的所有代码、设计、商标等知识产权归项目所有者所有。
                                </p>
                                <p className="mb-4">
                                    6.2
                                    您通过本服务创建的图表内容的知识产权归您所有。
                                </p>
                                <p className="mb-4">
                                    6.3
                                    您授予我们使用、存储和处理您创建的内容的权利，以便提供和改进本服务。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    7. 免责声明
                                </h2>
                                <p className="mb-4">
                                    7.1
                                    本服务"按原样"提供，不提供任何明示或暗示的保证。
                                </p>
                                <p className="mb-4">
                                    7.2
                                    我们不对服务的准确性、可靠性、可用性或适用性作出任何保证。
                                </p>
                                <p className="mb-4">
                                    7.3 AI
                                    生成的内容仅供参考，我们不对其准确性、完整性或适用性负责。
                                </p>
                                <p className="mb-4">
                                    7.4
                                    我们不对因使用或无法使用本服务而导致的任何直接、间接、偶然或后果性损害负责。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    8. 数据与隐私
                                </h2>
                                <p className="mb-4">
                                    8.1
                                    我们重视您的隐私。详细的数据收集和使用政策请参阅
                                    <Link
                                        href="/privacy"
                                        className="text-primary hover:underline"
                                    >
                                        《隐私政策》
                                    </Link>
                                    。
                                </p>
                                <p className="mb-4">
                                    8.2 匿名用户的会话数据仅存储在本地浏览器中。
                                </p>
                                <p className="mb-4">
                                    8.3
                                    登录用户的会话数据会同步到云端服务器，以便跨设备访问。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    9. 服务变更与终止
                                </h2>
                                <p className="mb-4">
                                    9.1
                                    我们保留随时修改、暂停或终止本服务的全部或部分功能的权利。
                                </p>
                                <p className="mb-4">
                                    9.2
                                    我们可能会定期更新本协议，更新后的协议将在服务中公布。
                                </p>
                                <p className="mb-4">
                                    9.3
                                    如果您违反本协议，我们有权暂停或终止您的账户。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    10. 开源与自托管
                                </h2>
                                <p className="mb-4">
                                    10.1
                                    本项目基于开源协议发布，您可以查看源代码或自行部署。
                                </p>
                                <p className="mb-4">
                                    10.2
                                    自托管版本不受本协议中配额限制的约束，但您需要自行承担运营成本和法律责任。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    11. 适用法律
                                </h2>
                                <p className="mb-4">
                                    本协议受中华人民共和国法律管辖。因本协议引起的任何争议，双方应友好协商解决；协商不成的，任何一方均可向有管辖权的人民法院提起诉讼。
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    12. 联系我们
                                </h2>
                                <p className="mb-4">
                                    如对本协议有任何疑问，请通过 GitHub Issues
                                    联系我们。
                                </p>
                            </section>

                            <div className="mt-12 p-6 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                    通过使用本服务，您确认已阅读、理解并同意受本协议的约束。
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <h1 className="text-4xl font-bold mb-8">
                                Terms of Service
                            </h1>

                            <div className="text-sm text-muted-foreground mb-8">
                                Last Updated: January 2025
                            </div>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    1. Acceptance of Terms
                                </h2>
                                <p className="mb-4">
                                    Welcome to Next AI Draw.io (the "Service").
                                    By accessing or using the Service, you agree
                                    to be bound by these Terms of Service (the
                                    "Terms"). If you do not agree to these
                                    Terms, please do not use the Service.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    2. Service Description
                                </h2>
                                <p className="mb-4">
                                    The Service is an AI-powered online diagram
                                    generation tool that allows users to create,
                                    edit, and analyze various diagrams through
                                    natural language descriptions.
                                </p>
                                <p className="mb-4">Features include:</p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>AI-driven diagram generation</li>
                                    <li>Diagram editing and modification</li>
                                    <li>Diagram version history</li>
                                    <li>
                                        Session history (for logged-in users)
                                    </li>
                                    <li>Cloud sync (for logged-in users)</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    3. Account Registration & Security
                                </h2>
                                <p className="mb-4">
                                    3.1 You may use the Service anonymously or
                                    register an account via phone, Google, or
                                    GitHub.
                                </p>
                                <p className="mb-4">
                                    3.2 You are responsible for maintaining the
                                    confidentiality of your account and all
                                    activities under it.
                                </p>
                                <p className="mb-4">
                                    3.3 Notify us immediately if you detect
                                    unauthorized use of your account.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    4. Usage Rules
                                </h2>
                                <p className="mb-4">
                                    When using the Service, you agree to:
                                </p>
                                <ul className="list-disc pl-6 mb-4">
                                    <li>
                                        Not use the Service for any illegal,
                                        harmful, or unethical activities
                                    </li>
                                    <li>
                                        Not abuse the Service, including
                                        malicious requests or automated attacks
                                    </li>
                                    <li>
                                        Not upload or generate illegal, obscene,
                                        violent, or hateful content
                                    </li>
                                    <li>
                                        Not infringe on intellectual property or
                                        privacy rights
                                    </li>
                                    <li>Comply with all applicable laws</li>
                                </ul>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    5. Quotas & Limits
                                </h2>
                                <p className="mb-4">
                                    5.1 Anonymous users have limited daily
                                    requests and token quotas.
                                </p>
                                <p className="mb-4">
                                    5.2 Registered users enjoy higher daily
                                    quotas.
                                </p>
                                <p className="mb-4">
                                    5.3 We reserve the right to adjust quotas as
                                    needed.
                                </p>
                                <p className="mb-4">
                                    5.4 For higher quotas, contact us or
                                    consider self-hosting the open-source
                                    version.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    6. Intellectual Property
                                </h2>
                                <p className="mb-4">
                                    6.1 All code, designs, and trademarks of the
                                    Service are owned by the project owners.
                                </p>
                                <p className="mb-4">
                                    6.2 You own the intellectual property of
                                    diagrams you create.
                                </p>
                                <p className="mb-4">
                                    6.3 You grant us the right to use, store,
                                    and process your content to provide and
                                    improve the Service.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    7. Disclaimer
                                </h2>
                                <p className="mb-4">
                                    7.1 The Service is provided "as is" without
                                    warranties of any kind.
                                </p>
                                <p className="mb-4">
                                    7.2 We make no guarantees about accuracy,
                                    reliability, or availability.
                                </p>
                                <p className="mb-4">
                                    7.3 AI-generated content is for reference
                                    only; we are not liable for its accuracy.
                                </p>
                                <p className="mb-4">
                                    7.4 We are not liable for any damages
                                    resulting from use or inability to use the
                                    Service.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    8. Data & Privacy
                                </h2>
                                <p className="mb-4">
                                    8.1 We value your privacy. See our{" "}
                                    <Link
                                        href="/privacy"
                                        className="text-primary hover:underline"
                                    >
                                        Privacy Policy
                                    </Link>{" "}
                                    for details.
                                </p>
                                <p className="mb-4">
                                    8.2 Anonymous user sessions are stored
                                    locally in the browser.
                                </p>
                                <p className="mb-4">
                                    8.3 Logged-in user sessions are synced to
                                    the cloud for cross-device access.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    9. Service Changes & Termination
                                </h2>
                                <p className="mb-4">
                                    9.1 We reserve the right to modify, suspend,
                                    or terminate the Service at any time.
                                </p>
                                <p className="mb-4">
                                    9.2 We may update these Terms periodically.
                                </p>
                                <p className="mb-4">
                                    9.3 We may suspend or terminate your account
                                    if you violate these Terms.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    10. Open Source & Self-Hosting
                                </h2>
                                <p className="mb-4">
                                    10.1 This project is released under an
                                    open-source license.
                                </p>
                                <p className="mb-4">
                                    10.2 Self-hosted versions are not subject to
                                    quota limits but require you to assume
                                    operational costs and legal
                                    responsibilities.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    11. Governing Law
                                </h2>
                                <p className="mb-4">
                                    These Terms are governed by the laws of the
                                    People's Republic of China. Disputes shall
                                    be resolved amicably; if unsuccessful,
                                    either party may bring a lawsuit in a court
                                    with jurisdiction.
                                </p>
                            </section>

                            <section className="mb-8">
                                <h2 className="text-2xl font-semibold mb-4">
                                    12. Contact Us
                                </h2>
                                <p className="mb-4">
                                    For questions about these Terms, please
                                    contact us via GitHub Issues.
                                </p>
                            </section>

                            <div className="mt-12 p-6 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                    By using the Service, you confirm that you
                                    have read, understood, and agree to be bound
                                    by these Terms.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
