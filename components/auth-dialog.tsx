"use client"

import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import { FaGithub, FaGoogle } from "react-icons/fa"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/contexts/i18n-context"
import {
    isValidPhoneNumber,
    normalizePhoneNumber,
} from "@/lib/validation/phone"

interface AuthDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    error?: string | null
}

export function AuthDialog({ open, onOpenChange, error }: AuthDialogProps) {
    const { t } = useI18n()
    const [mode, setMode] = useState<"oauth" | "phone">("phone")
    const [isLoading, setIsLoading] = useState<string | null>(null)
    const [phoneNumber, setPhoneNumber] = useState("")
    const [verificationCode, setVerificationCode] = useState("")
    const [phoneError, setPhoneError] = useState<string | null>(null)
    const [countdown, setCountdown] = useState(0)
    const [isSendingCode, setIsSendingCode] = useState(false)
    const [codeMessage, setCodeMessage] = useState<string | null>(null)
    const [agreedToTerms, setAgreedToTerms] = useState(false)

    useEffect(() => {
        if (!countdown) return
        const timer = setTimeout(() => {
            setCountdown((prev) => Math.max(prev - 1, 0))
        }, 1000)
        return () => clearTimeout(timer)
    }, [countdown])

    const handleSignIn = async (provider: string) => {
        if (!agreedToTerms) {
            setPhoneError(t("auth.error.mustAgreeToTerms"))
            return
        }
        setIsLoading(provider)
        try {
            await signIn(provider, { callbackUrl: "/" })
        } catch (error) {
            console.error("Sign in error:", error)
            setIsLoading(null)
        }
    }

    const handleSendCode = async () => {
        const phone = phoneNumber.trim()
        if (!phone) {
            setPhoneError(t("auth.error.enterPhone"))
            return
        }
        const normalized = normalizePhoneNumber(phone)
        if (!isValidPhoneNumber(normalized)) {
            setPhoneError(t("auth.error.invalidPhone"))
            return
        }

        setIsSendingCode(true)
        setPhoneError(null)
        setCodeMessage(null)
        try {
            // 统一使用登录验证码 API（支持自动注册）
            const response = await fetch("/api/auth/phone/send-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                const code = result?.error ?? "UNKNOWN"
                if (code === "INVALID_PHONE") {
                    setPhoneError(t("auth.error.invalidPhone"))
                } else {
                    setPhoneError(t("auth.error.sendCodeFailed"))
                }
                return
            }
            setCountdown(60)
            const debugCode = result?.debugCode
            setCodeMessage(
                debugCode
                    ? t("auth.phone.codeSentDev", { code: debugCode })
                    : t("auth.phone.codeSent"),
            )
        } catch (error) {
            console.error("[auth][phone][send-code]", error)
            setPhoneError(t("auth.error.sendCodeFailed"))
        } finally {
            setIsSendingCode(false)
        }
    }

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const phone = phoneNumber.trim()
        const code = verificationCode.trim()

        if (!agreedToTerms) {
            setPhoneError(t("auth.error.mustAgreeToTerms"))
            return
        }
        if (!phone) {
            setPhoneError(t("auth.error.enterPhone"))
            return
        }
        const normalized = normalizePhoneNumber(phone)
        if (!isValidPhoneNumber(normalized)) {
            setPhoneError(t("auth.error.invalidPhone"))
            return
        }
        if (!code) {
            setPhoneError(t("auth.error.enterCode"))
            return
        }

        setIsLoading("phone")
        setPhoneError(null)
        try {
            // 统一使用登录流程（支持自动注册）
            const result = await signIn("phone", {
                phone,
                code,
                redirect: false,
                callbackUrl: "/",
            })

            if (result?.ok) {
                window.location.href = result.url ?? "/"
            } else {
                setPhoneError(t("auth.error.codeInvalid"))
                setIsLoading(null)
            }
        } catch (error) {
            console.error("[auth][phone][submit]", error)
            setPhoneError(t("auth.error.authFailed"))
            setIsLoading(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center shadow-lg">
                            <svg
                                className="w-10 h-10 text-primary-foreground"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                role="img"
                                aria-label="AI Draw.io logo"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                        </div>
                    </div>
                    <DialogTitle className="text-2xl text-center">
                        {t("auth.dialog.title")}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {t("auth.dialog.description")}
                    </DialogDescription>
                </DialogHeader>

                <Tabs
                    value={mode}
                    onValueChange={(value) =>
                        setMode(value as "oauth" | "phone")
                    }
                    className="space-y-4 pt-4"
                >
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="oauth">
                            {t("auth.dialog.oauth")}
                        </TabsTrigger>
                        <TabsTrigger value="phone">
                            {t("auth.dialog.phone")}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="oauth" className="space-y-4">
                        {/* Error message */}
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                                <p className="text-sm text-destructive text-center">
                                    {error === "OAuthSignin"
                                        ? t("auth.error.oauthSignin")
                                        : error === "OAuthCallback"
                                          ? t("auth.error.oauthCallback")
                                          : error === "OAuthCreateAccount"
                                            ? t("auth.error.oauthCreateAccount")
                                            : error === "EmailCreateAccount"
                                              ? t(
                                                    "auth.error.emailCreateAccount",
                                                )
                                              : error === "Callback"
                                                ? t("auth.error.callback")
                                                : error ===
                                                    "OAuthAccountNotLinked"
                                                  ? t(
                                                        "auth.error.oauthAccountNotLinked",
                                                    )
                                                  : error === "SessionRequired"
                                                    ? t(
                                                          "auth.error.sessionRequired",
                                                      )
                                                    : t(
                                                          "auth.error.unknownError",
                                                      )}
                                </p>
                            </div>
                        )}

                        {/* Agreement checkbox */}
                        <div className="flex items-start space-x-2">
                            <Checkbox
                                id="terms-oauth"
                                checked={agreedToTerms}
                                onCheckedChange={(checked) =>
                                    setAgreedToTerms(checked === true)
                                }
                            />
                            <label
                                htmlFor="terms-oauth"
                                className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {t("auth.dialog.byContining")}{" "}
                                <a
                                    href="/terms"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-foreground transition-colors"
                                >
                                    {t("auth.dialog.terms")}
                                </a>{" "}
                                {t("auth.dialog.and")}{" "}
                                <a
                                    href="/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-foreground transition-colors"
                                >
                                    {t("auth.dialog.privacy")}
                                </a>
                            </label>
                        </div>

                        {/* Error message for terms */}
                        {phoneError && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                                <p className="text-sm text-destructive text-center">
                                    {phoneError}
                                </p>
                            </div>
                        )}

                        {/* Sign in buttons */}
                        <div className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full h-12 text-base relative overflow-hidden group"
                                onClick={() => handleSignIn("google")}
                                disabled={isLoading !== null}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/10 group-hover:to-primary/5 transition-all duration-300" />
                                <div className="relative flex items-center justify-center gap-3">
                                    {isLoading === "google" ? (
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FaGoogle className="w-5 h-5 text-[#4285F4]" />
                                    )}
                                    <span>
                                        {t("auth.dialog.continueWithGoogle")}
                                    </span>
                                </div>
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full h-12 text-base relative overflow-hidden group"
                                onClick={() => handleSignIn("github")}
                                disabled={isLoading !== null}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 group-hover:from-primary/5 group-hover:via-primary/10 group-hover:to-primary/5 transition-all duration-300" />
                                <div className="relative flex items-center justify-center gap-3">
                                    {isLoading === "github" ? (
                                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <FaGithub className="w-5 h-5" />
                                    )}
                                    <span>
                                        {t("auth.dialog.continueWithGithub")}
                                    </span>
                                </div>
                            </Button>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    {t("auth.dialog.secureAuth")}
                                </span>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="phone" className="space-y-4">
                        <form
                            onSubmit={handlePhoneSubmit}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="phone">
                                    {t("auth.phone.phoneNumber")}
                                </Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) =>
                                        setPhoneNumber(e.target.value)
                                    }
                                    placeholder="+1234567890"
                                    autoComplete="tel"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">
                                    {t("auth.phone.verificationCode")}
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="code"
                                        value={verificationCode}
                                        onChange={(e) =>
                                            setVerificationCode(e.target.value)
                                        }
                                        placeholder="123456"
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
                                              ? t("auth.phone.sending")
                                              : t("auth.phone.sendCode")}
                                    </Button>
                                </div>
                                {codeMessage && (
                                    <p className="text-xs text-muted-foreground">
                                        {codeMessage}
                                    </p>
                                )}
                            </div>
                            {phoneError && (
                                <p
                                    className="text-sm text-destructive"
                                    role="alert"
                                >
                                    {phoneError}
                                </p>
                            )}
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="terms-phone"
                                    checked={agreedToTerms}
                                    onCheckedChange={(checked) =>
                                        setAgreedToTerms(checked === true)
                                    }
                                />
                                <label
                                    htmlFor="terms-phone"
                                    className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {t("auth.dialog.byContining")}{" "}
                                    <a
                                        href="/terms"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-foreground transition-colors"
                                    >
                                        {t("auth.dialog.terms")}
                                    </a>{" "}
                                    {t("auth.dialog.and")}{" "}
                                    <a
                                        href="/privacy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-foreground transition-colors"
                                    >
                                        {t("auth.dialog.privacy")}
                                    </a>
                                </label>
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-12"
                                disabled={isLoading === "phone"}
                            >
                                {isLoading === "phone"
                                    ? t("auth.phone.signingIn")
                                    : t("auth.phone.signIn")}
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
