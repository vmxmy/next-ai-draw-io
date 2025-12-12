import type { VariantProps } from "class-variance-authority"
import type React from "react"
import { Button, type buttonVariants } from "@/components/ui/button"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface ButtonWithTooltipProps
    extends React.ComponentProps<"button">,
        VariantProps<typeof buttonVariants> {
    tooltipContent: string
    children: React.ReactNode
    asChild?: boolean
}

export function ButtonWithTooltip({
    tooltipContent,
    children,
    ...buttonProps
}: ButtonWithTooltipProps) {
    const trigger =
        buttonProps.disabled === true ? (
            // Radix Tooltip 需要可接收 ref 的触发节点；禁用按钮无法触发 hover/focus，
            // 因此仅在 disabled 场景下用外层 span 作为 trigger。
            <span className="inline-flex outline-none" tabIndex={0}>
                <Button {...buttonProps} tabIndex={-1}>
                    {children}
                </Button>
            </span>
        ) : (
            <Button {...buttonProps}>{children}</Button>
        )

    return (
        <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent className="max-w-xs text-wrap">
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    )
}
