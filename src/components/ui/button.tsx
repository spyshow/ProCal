import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-orange-600 text-white shadow-lg shadow-orange-600/25 hover:bg-orange-500 hover:shadow-orange-600/40 border border-orange-500/50",
        destructive:
          "bg-rose-600 text-white shadow-sm hover:bg-rose-500 border border-rose-500/50",
        outline:
          "border border-[var(--border-color,#1f2937)] bg-[var(--card-bg,#0b0f19)]/80 backdrop-blur-md text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,#111827)] hover:border-orange-500/50 hover:text-orange-500",
        secondary:
          "bg-[var(--card-bg-subtle,#111827)] backdrop-blur-md text-[var(--foreground-color,#f8fafc)] shadow-sm hover:bg-[var(--card-bg,#0b0f19)] border border-[var(--border-color,#1f2937)]",
        ghost:
          "text-[var(--foreground-color,#f8fafc)] hover:bg-[var(--card-bg-subtle,rgba(17,24,39,0.8))] hover:text-orange-500",
        link:
          "text-orange-400 underline-offset-4 hover:underline",
        glow:
          "bg-gradient-to-r from-orange-600 to-amber-600 text-white font-semibold shadow-[0_0_20px_rgba(234,88,12,0.4)] hover:shadow-[0_0_30px_rgba(234,88,12,0.6)] border border-orange-400/40 hover:scale-[1.02]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
