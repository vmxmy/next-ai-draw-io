"use client"

import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { Suspense, useState } from "react"
import { FaGithub, FaGoogle } from "react-icons/fa"
import { Button } from "@/components/ui/button"

function SignInContent() {
    const searchParams = useSearchParams()
    const callbackUrl = searchParams?.get("callbackUrl") || "/"
    const error = searchParams?.get("error")
    const [isLoading, setIsLoading] = useState<string | null>(null)

    const handleSignIn = async (provider: string) => {
        setIsLoading(provider)
        try {
            await signIn(provider, { callbackUrl })
        } catch (error) {
            console.error("Sign in error:", error)
            setIsLoading(null)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
            </div>

            {/* Sign in card */}
            <div className="relative w-full max-w-md">
                <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
                    {/* Logo and title */}
                    <div className="text-center space-y-2">
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
                        <h1 className="text-3xl font-bold tracking-tight">
                            Welcome to AI Draw.io
                        </h1>
                        <p className="text-muted-foreground">
                            Sign in to access your diagrams and continue
                            creating
                        </p>
                    </div>

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
                                            : error === "OAuthAccountNotLinked"
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
                            <span className="bg-card px-2 text-muted-foreground">
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
                </div>

                {/* Powered by */}
                <div className="mt-6 text-center text-sm text-muted-foreground">
                    <p>
                        Powered by{" "}
                        <a
                            href="https://next-auth.js.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground transition-colors"
                        >
                            NextAuth.js
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default function SignInPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    Loading...
                </div>
            }
        >
            <SignInContent />
        </Suspense>
    )
}
