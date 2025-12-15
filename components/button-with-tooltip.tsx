import type { VariantProps } from "class-variance-authority"
import type React from "react"
import { memo } from "react"
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

export const ButtonWithTooltip = memo(function ButtonWithTooltip({
    tooltipContent,
    children,
    asChild = false,
    ...buttonProps
}: ButtonWithTooltipProps) {
    const isDisabled = buttonProps.disabled === true

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {isDisabled ? (
                    <span className="inline-flex outline-none" tabIndex={0}>
                        <Button {...buttonProps} asChild={false} tabIndex={-1}>
                            {children}
                        </Button>
                    </span>
                ) : (
                    <Button {...buttonProps} asChild={asChild}>
                        {children}
                    </Button>
                )}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-wrap">
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    )
})
