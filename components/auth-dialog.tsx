"use client"

import { signIn } from "next-auth/react"
import { useEffect, useState } from "react"
import { FaGithub, FaGoogle } from "react-icons/fa"
import { Button } from "@/components/ui/button"
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
    const [mode, setMode] = useState<"oauth" | "phone">("oauth")
    const [phoneMode, setPhoneMode] = useState<"login" | "register">("login")
    const [isLoading, setIsLoading] = useState<string | null>(null)
    const [phoneNumber, setPhoneNumber] = useState("")
    const [verificationCode, setVerificationCode] = useState("")
    const [userName, setUserName] = useState("")
    const [phoneError, setPhoneError] = useState<string | null>(null)
    const [countdown, setCountdown] = useState(0)
    const [isSendingCode, setIsSendingCode] = useState(false)
    const [codeMessage, setCodeMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!countdown) return
        const timer = setTimeout(() => {
            setCountdown((prev) => Math.max(prev - 1, 0))
        }, 1000)
        return () => clearTimeout(timer)
    }, [countdown])

    const handleSignIn = async (provider: string) => {
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
            setPhoneError("Please enter your phone number")
            return
        }
        const normalized = normalizePhoneNumber(phone)
        if (!isValidPhoneNumber(normalized)) {
            setPhoneError("Invalid phone number format")
            return
        }

        setIsSendingCode(true)
        setPhoneError(null)
        setCodeMessage(null)
        try {
            const endpoint =
                phoneMode === "register"
                    ? "/api/auth/phone/register/send-code"
                    : "/api/auth/phone/send-code"

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone }),
            })
            const result = await response.json().catch(() => null)
            if (!response.ok) {
                const code = result?.error ?? "UNKNOWN"
                if (code === "INVALID_PHONE") {
                    setPhoneError("Invalid phone number")
                } else if (code === "USER_NOT_FOUND") {
                    setPhoneError("Phone number not registered")
                } else if (code === "PHONE_IN_USE") {
                    setPhoneError("Phone number already registered")
                } else {
                    setPhoneError("Failed to send verification code")
                }
                return
            }
            setCountdown(60)
            const debugCode = result?.debugCode
            setCodeMessage(
                debugCode
                    ? `Verification code sent! (Dev: ${debugCode})`
                    : "Verification code sent to your phone",
            )
        } catch (error) {
            console.error("[auth][phone][send-code]", error)
            setPhoneError("Failed to send verification code")
        } finally {
            setIsSendingCode(false)
        }
    }

    const handlePhoneSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const phone = phoneNumber.trim()
        const code = verificationCode.trim()
        const name = userName.trim()

        if (!phone) {
            setPhoneError("Please enter your phone number")
            return
        }
        const normalized = normalizePhoneNumber(phone)
        if (!isValidPhoneNumber(normalized)) {
            setPhoneError("Invalid phone number format")
            return
        }
        if (!code) {
            setPhoneError("Please enter verification code")
            return
        }

        setIsLoading("phone")
        setPhoneError(null)
        try {
            if (phoneMode === "register") {
                // 注册流程
                const response = await fetch("/api/auth/phone/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        phone,
                        code,
                        name: name || undefined,
                    }),
                })
                const result = await response.json().catch(() => null)

                if (!response.ok) {
                    const errorCode = result?.error ?? "UNKNOWN"
                    if (errorCode === "CODE_EXPIRED") {
                        setPhoneError("Verification code expired")
                    } else if (errorCode === "CODE_INVALID") {
                        setPhoneError("Invalid verification code")
                    } else if (errorCode === "CODE_USED") {
                        setPhoneError("Verification code already used")
                    } else if (errorCode === "PHONE_IN_USE") {
                        setPhoneError("Phone number already registered")
                    } else {
                        setPhoneError("Registration failed")
                    }
                    setIsLoading(null)
                    return
                }

                // 注册成功，自动登录
                const loginResult = await signIn("phone", {
                    phone,
                    code,
                    redirect: false,
                    callbackUrl: "/",
                })

                if (loginResult?.ok) {
                    window.location.href = loginResult.url ?? "/"
                } else {
                    // 注册成功但自动登录失败，提示用户手动登录
                    setCodeMessage("Registration successful! Please sign in.")
                    setPhoneMode("login")
                    setVerificationCode("")
                    setIsLoading(null)
                }
            } else {
                // 登录流程
                const result = await signIn("phone", {
                    phone,
                    code,
                    redirect: false,
                    callbackUrl: "/",
                })

                if (result?.ok) {
                    window.location.href = result.url ?? "/"
                } else {
                    setPhoneError("Invalid verification code")
                    setIsLoading(null)
                }
            }
        } catch (error) {
            console.error("[auth][phone][submit]", error)
            setPhoneError("Authentication failed")
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
                        Welcome to AI Draw.io
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Sign in to access your diagrams and continue creating
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
                        <TabsTrigger value="oauth">OAuth</TabsTrigger>
                        <TabsTrigger value="phone">Phone</TabsTrigger>
                    </TabsList>

                    <TabsContent value="oauth" className="space-y-4">
                        {/* Error message */}
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                                <p className="text-sm text-destructive text-center">
                                    {error === "OAuthSignin"
                                        ? "Error connecting to authentication provider"
                                        : error === "OAuthCallback"
                                          ? "Error during authentication callback"
                                          : error === "OAuthCreateAccount"
                                            ? "Could not create account"
                                            : error === "EmailCreateAccount"
                                              ? "Could not create account with email"
                                              : error === "Callback"
                                                ? "Error during callback"
                                                : error ===
                                                    "OAuthAccountNotLinked"
                                                  ? "Email already in use with different provider"
                                                  : error === "SessionRequired"
                                                    ? "Please sign in to access this page"
                                                    : "An error occurred during authentication"}
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
                                    <span>Continue with Google</span>
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
                                    <span>Continue with GitHub</span>
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
                                    Secure Authentication
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-sm text-muted-foreground">
                            <p>
                                By continuing, you agree to our{" "}
                                <a
                                    href="/terms"
                                    className="underline hover:text-foreground transition-colors"
                                >
                                    Terms of Service
                                </a>{" "}
                                and{" "}
                                <a
                                    href="/privacy"
                                    className="underline hover:text-foreground transition-colors"
                                >
                                    Privacy Policy
                                </a>
                            </p>
                        </div>
                    </TabsContent>

                    <TabsContent value="phone" className="space-y-4">
                        {/* 登录/注册切换 */}
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <button
                                type="button"
                                onClick={() => setPhoneMode("login")}
                                className={`px-3 py-1 rounded-md transition-colors ${
                                    phoneMode === "login"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Sign In
                            </button>
                            <span className="text-muted-foreground">|</span>
                            <button
                                type="button"
                                onClick={() => setPhoneMode("register")}
                                className={`px-3 py-1 rounded-md transition-colors ${
                                    phoneMode === "register"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                Sign Up
                            </button>
                        </div>

                        <form
                            onSubmit={handlePhoneSubmit}
                            className="space-y-4"
                        >
                            {phoneMode === "register" && (
                                <div className="space-y-2">
                                    <Label htmlFor="name">
                                        Name{" "}
                                        <span className="text-muted-foreground text-xs">
                                            (Optional)
                                        </span>
                                    </Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={userName}
                                        onChange={(e) =>
                                            setUserName(e.target.value)
                                        }
                                        placeholder="Your name"
                                        autoComplete="name"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
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
                                <Label htmlFor="code">Verification Code</Label>
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
                                              ? "Sending..."
                                              : "Send Code"}
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
                            <Button
                                type="submit"
                                className="w-full h-12"
                                disabled={isLoading === "phone"}
                            >
                                {isLoading === "phone"
                                    ? phoneMode === "register"
                                        ? "Signing up..."
                                        : "Signing in..."
                                    : phoneMode === "register"
                                      ? "Sign Up"
                                      : "Sign In"}
                            </Button>
                        </form>

                        {/* Footer */}
                        <div className="text-center text-sm text-muted-foreground">
                            <p>
                                By continuing, you agree to our{" "}
                                <a
                                    href="/terms"
                                    className="underline hover:text-foreground transition-colors"
                                >
                                    Terms of Service
                                </a>{" "}
                                and{" "}
                                <a
                                    href="/privacy"
                                    className="underline hover:text-foreground transition-colors"
                                >
                                    Privacy Policy
                                </a>
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
