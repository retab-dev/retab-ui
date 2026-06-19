import { type ComponentProps } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

import { type LinkItem } from "./homepage-types"

export const focusRing =
  "focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"

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
      className={cn("mx-auto w-[calc(100%-48px)] max-w-[1400px]", className)}
      {...props}
    />
  )
}

export function getLinkAriaLabel(item: LinkItem) {
  const label =
    item.ariaLabel ?? (item.badge ? `${item.label} ${item.badge}` : item.label)

  return item.isExternal ? `${label} (opens in a new tab)` : label
}

export function getLinkProps(item: LinkItem) {
  if (!item.isExternal) {
    return {}
  }

  return {
    rel: "noopener noreferrer",
    target: "_blank",
  }
}

export function MarketingLinkLabel({ item }: { item: LinkItem }) {
  return (
    <>
      <span className="min-w-0 break-words">{item.label}</span>
      {item.badge ? (
        <span
          aria-hidden="true"
          className="shrink-0 rounded-[2px] border border-black px-1 text-[9px] leading-3 font-semibold text-black"
        >
          {item.badge}
        </span>
      ) : null}
    </>
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
        "inline-flex items-center justify-center border text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none active:translate-y-0 active:shadow-none motion-reduce:transform-none motion-reduce:transition-none",
        size === "compact" ? "h-8 px-3" : "h-10 px-4",
        shape === "rounded" ? "rounded-md" : "rounded-full",
        variant === "primary"
          ? "border-black bg-black text-white hover:bg-neutral-900 hover:shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
          : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)]",
        className
      )}
      {...props}
    />
  )
}
