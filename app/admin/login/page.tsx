"use client"

import { AlertCircle, Lock, Mail, Shield } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, useSession } from "next-auth/react"
import { Suspense, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
} from "@/lib/validation/phone"

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { status } = useSession()

    // 通用状态
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    // 邮箱密码登录状态
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    // 手机号登录状态
    const [phoneNumber, setPhoneNumber] = useState("")
    const [verificationCode, setVerificationCode] = useState("")
    const [countdown, setCountdown] = useState(0)
    const [isSendingCode, setIsSendingCode] = useState(false)
    const [codeMessage, setCodeMessage] = useState<string | null>(null)

    const callbackUrl = searchParams.get("callbackUrl") || "/admin"
    const errorParam = searchParams.get("error")

    // 倒计时逻辑
    useEffect(() => {
        if (!countdown) return
        const timer = setTimeout(() => {
            setCountdown((prev) => Math.max(prev - 1, 0))
        }, 1000)
        return () => clearTimeout(timer)
    }, [countdown])

    // If already logged in, redirect to admin
    if (status === "authenticated") {
        router.push(callbackUrl)
        return null
    }

    const handleGitHubLogin = async () => {
        setIsLoading(true)
        try {
            await signIn("github", {
                callbackUrl,
            })
        } catch (_err) {
            setError("GitHub 登录失败，请稍后重试")
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setIsLoading(true)
        try {
            await signIn("google", {
                callbackUrl,
            })
        } catch (_err) {
            setError("Google 登录失败，请稍后重试")
            setIsLoading(false)
        }
    }

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            })

            if (result?.error) {
                setError("登录失败，请检查邮箱和密码是否正确")
            } else if (result?.ok) {
                router.push(callbackUrl)
            }
        } catch (_err) {
            setError("登录过程中发生错误，请稍后重试")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSendCode = async () => {
        const phone = phoneNumber.trim()
        if (!phone) {
            setError("请输入手机号")
            return
        }
        const normalized = normalizePhoneNumber(phone)
        if (!isValidPhoneNumber(normalized)) {
            setError("手机号格式不正确")
            return
        }

        setIsSendingCode(true)
        setError("")
        setCodeMessage(null)
        try {
            const response = await fetch("/api/auth/phone/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                const code = result?.error ?? "UNKNOWN"
                if (code === "INVALID_PHONE") {
                    setError("手机号格式不正确")
                } else if (code === "USER_NOT_FOUND") {
                    setError("该手机号未注册管理员账号")
                } else {
                    setError("发送验证码失败，请稍后重试")
                }
                return
            }
            setCountdown(60)
            const debugCode = result?.debugCode
            setCodeMessage(
                debugCode
                    ? `验证码已发送（开发模式: ${debugCode}）`
                    : "验证码已发送，请查收",
            )
        } catch (error) {
            console.error("[admin][phone][send-code]", error)
            setError("发送验证码失败，请稍后重试")
        } finally {
            setIsSendingCode(false)
        }
    }

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const phone = phoneNumber.trim()
        const code = verificationCode.trim()

        if (!phone) {
            setError("请输入手机号")
            return
        }
        const normalized = normalizePhoneNumber(phone)
        if (!isValidPhoneNumber(normalized)) {
            setError("手机号格式不正确")
            return
        }
        if (!code) {
            setError("请输入验证码")
            return
        }

        setIsLoading(true)
        setError("")
        try {
            const result = await signIn("phone", {
                phone,
                code,
                redirect: false,
                callbackUrl,
            })

            if (result?.ok) {
                router.push(callbackUrl)
            } else {
                setError("验证码错误或已过期")
                setIsLoading(false)
            }
        } catch (error) {
            console.error("[admin][phone][submit]", error)
            setError("登录失败，请稍后重试")
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Shield className="h-6 w-6 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold">
                        管理员登录
                    </CardTitle>
                    <CardDescription>
                        使用您的管理员账户登录系统
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Security Warning */}
                    <Alert
                        variant="default"
                        className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
                    >
                        <Lock className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                            此页面仅供授权管理员使用。未经授权访问将被记录。
                        </AlertDescription>
                    </Alert>

                    {/* Error Message */}
                    {(error || errorParam) && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {error ||
                                    (errorParam === "CredentialsSignin"
                                        ? "登录失败，请检查您的凭据"
                                        : "登录失败")}
                            </AlertDescription>
                        </Alert>
                    )}

                    <Tabs defaultValue="oauth" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="oauth">OAuth</TabsTrigger>
                            <TabsTrigger value="phone">手机号</TabsTrigger>
                            <TabsTrigger value="email">邮箱</TabsTrigger>
                        </TabsList>

                        {/* OAuth Login */}
                        <TabsContent value="oauth" className="space-y-4 mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={handleGitHubLogin}
                                disabled={isLoading}
                            >
                                <svg
                                    className="mr-2 h-4 w-4"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    role="img"
                                    aria-label="GitHub"
                                >
                                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                </svg>
                                使用 GitHub 登录
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                            >
                                <svg
                                    className="mr-2 h-4 w-4"
                                    viewBox="0 0 24 24"
                                    role="img"
                                    aria-label="Google"
                                >
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                使用 Google 登录
                            </Button>
                        </TabsContent>

                        {/* Phone Login */}
                        <TabsContent value="phone" className="space-y-4 mt-4">
                            <form
                                onSubmit={handlePhoneSubmit}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="phone">手机号</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) =>
                                            setPhoneNumber(e.target.value)
                                        }
                                        placeholder="+1234567890"
                                        disabled={isLoading}
                                        autoComplete="tel"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="code">验证码</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="code"
                                            value={verificationCode}
                                            onChange={(e) =>
                                                setVerificationCode(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="123456"
                                            disabled={isLoading}
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleSendCode}
                                            disabled={
                                                isSendingCode ||
                                                countdown > 0 ||
                                                !phoneNumber.trim()
                                            }
                                            className="whitespace-nowrap"
                                        >
                                            {countdown > 0
                                                ? `${countdown}s`
                                                : isSendingCode
                                                  ? "发送中..."
                                                  : "发送验证码"}
                                        </Button>
                                    </div>
                                    {codeMessage && (
                                        <p className="text-xs text-muted-foreground">
                                            {codeMessage}
                                        </p>
                                    )}
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                                            登录中...
                                        </>
                                    ) : (
                                        "登录"
                                    )}
                                </Button>
                            </form>
                        </TabsContent>

                        {/* Email Login */}
                        <TabsContent value="email" className="space-y-4 mt-4">
                            <form
                                onSubmit={handleEmailSubmit}
                                className="space-y-4"
                            >
                                <div className="space-y-2">
                                    <Label htmlFor="email">邮箱地址</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="admin@example.com"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            required
                                            disabled={isLoading}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">密码</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) =>
                                                setPassword(e.target.value)
                                            }
                                            required
                                            disabled={isLoading}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                                            登录中...
                                        </>
                                    ) : (
                                        "登录"
                                    )}
                                </Button>
                            </form>
                        </TabsContent>
                    </Tabs>

                    <div className="text-center text-sm text-muted-foreground">
                        <a
                            href="/"
                            className="hover:text-primary underline underline-offset-4"
                        >
                            返回主页
                        </a>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <div className="absolute bottom-4 text-center w-full text-xs text-muted-foreground">
                <p>运维管理平台 v1.0 | 请妥善保管您的登录凭据</p>
            </div>
        </div>
    )
}

export default function AdminLoginPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
                        <p className="mt-4 text-sm text-muted-foreground">
                            加载中...
                        </p>
                    </div>
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    )
}
