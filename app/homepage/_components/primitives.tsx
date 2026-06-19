import { type ComponentProps } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function VercelMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block size-0 border-x-[10px] border-b-[18px] border-x-transparent border-b-black",
        className
      )}
    />
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
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary"
}) {
  return (
    <Link
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
        variant === "primary"
          ? "border-black bg-black text-white hover:bg-neutral-800"
          : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50",
        className
      )}
      {...props}
    />
  )
}
