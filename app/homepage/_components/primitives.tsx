import { type ComponentProps } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function VercelMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 116 100"
      className={cn("block h-[18px] w-[20px] fill-black", className)}
    >
      <path d="M58 0 116 100H0z" />
    </svg>
  )
}

export function MarketingContainer({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1400px] px-6", className)}
      {...props}
    />
  )
}

export function MarketingButton({
  variant = "primary",
  size = "default",
  shape = "pill",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary"
  size?: "default" | "compact"
  shape?: "pill" | "rounded"
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center border text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
        size === "compact" ? "h-8 px-3" : "h-10 px-4",
        shape === "rounded" ? "rounded-md" : "rounded-full",
        variant === "primary"
          ? "border-black bg-black text-white hover:bg-neutral-800"
          : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50",
        className
      )}
      {...props}
    />
  )
}
