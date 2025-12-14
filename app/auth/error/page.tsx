"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"

function AuthErrorContent() {
    const searchParams = useSearchParams()
    const error = searchParams?.get("error")

    const getErrorMessage = (error: string | null) => {
        switch (error) {
            case "Configuration":
                return {
                    title: "Server Configuration Error",
                    description:
                        "There is a problem with the server configuration. Please contact support.",
                }
            case "AccessDenied":
                return {
                    title: "Access Denied",
                    description:
                        "You do not have permission to sign in. Please contact support if you believe this is an error.",
                }
            case "Verification":
                return {
                    title: "Verification Failed",
                    description:
                        "The verification token has expired or has already been used. Please try signing in again.",
                }
            case "OAuthSignin":
            case "OAuthCallback":
            case "OAuthCreateAccount":
            case "EmailCreateAccount":
            case "Callback":
                return {
                    title: "Authentication Error",
                    description:
                        "An error occurred during the authentication process. Please try again.",
                }
            case "OAuthAccountNotLinked":
                return {
                    title: "Account Already Exists",
                    description:
                        "An account with this email already exists using a different sign-in method. Please sign in using your original method.",
                }
            case "EmailSignin":
                return {
                    title: "Email Sign-in Error",
                    description:
                        "Could not send the sign-in email. Please try again or use a different sign-in method.",
                }
            case "CredentialsSignin":
                return {
                    title: "Sign-in Failed",
                    description:
                        "The provided credentials are incorrect. Please check your credentials and try again.",
                }
            case "SessionRequired":
                return {
                    title: "Session Required",
                    description:
                        "You must be signed in to access this page. Please sign in to continue.",
                }
            default:
                return {
                    title: "Unknown Error",
                    description:
                        "An unexpected error occurred. Please try again or contact support if the problem persists.",
                }
        }
    }

    const errorInfo = getErrorMessage(error)

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-destructive/5 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-destructive/5 rounded-full blur-3xl" />
            </div>

            {/* Error card */}
            <div className="relative w-full max-w-md">
                <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
                    {/* Error icon */}
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                            <svg
                                className="w-8 h-8 text-destructive"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                role="img"
                                aria-label="Error alert icon"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Error message */}
                    <div className="text-center space-y-2">
                        <h1 className="text-2xl font-bold">
                            {errorInfo.title}
                        </h1>
                        <p className="text-muted-foreground">
                            {errorInfo.description}
                        </p>
                        {error && (
                            <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1 rounded-md inline-block">
                                Error code: {error}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <Button asChild className="w-full h-12 text-base">
                            <Link href="/auth/signin">Try Again</Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            className="w-full h-12 text-base"
                        >
                            <Link href="/">Go to Home</Link>
                        </Button>
                    </div>

                    {/* Help text */}
                    <div className="text-center text-sm text-muted-foreground">
                        <p>
                            Need help?{" "}
                            <a
                                href="mailto:support@example.com"
                                className="underline hover:text-foreground transition-colors"
                            >
                                Contact Support
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AuthErrorPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    Loading...
                </div>
            }
        >
            <AuthErrorContent />
        </Suspense>
    )
}
