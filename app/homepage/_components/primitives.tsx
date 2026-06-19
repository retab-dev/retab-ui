import { type ComponentProps } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { type LinkItem } from "./homepage-types";

export const focusRing =
  "focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none";

export function VercelMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-0.15238095238095237 -0.15238095238095237 0.30476190476190473 0.30476190476190473"
      className={cn("block size-5 fill-black", className)}
      style={{ overflow: "visible" }}
    >
      <polygon points="0,-0.15238095238095237 -0.13196577581477162,0.07619047619047618 0.13196577581477162,0.07619047619047618" />
    </svg>
  );
}

export function MarketingContainer({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-screen-2xl px-6", className)}
      {...props}
    />
  );
}

export function getLinkAriaLabel(item: LinkItem) {
  const label =
    item.ariaLabel ?? (item.badge ? `${item.label} ${item.badge}` : item.label);

  return item.isExternal ? `${label} (opens in a new tab)` : label;
}

export function getLinkProps(item: LinkItem) {
  if (!item.isExternal) {
    return {};
  }

  return {
    rel: "noopener noreferrer",
    target: "_blank",
  };
}

export function MarketingLinkLabel({ item }: { item: LinkItem }) {
  return (
    <>
      <span className="min-w-0 break-words">{item.label}</span>
      {item.badge ? (
        <span
          aria-hidden="true"
          className="shrink-0 rounded-sm border border-black px-1 text-[10px] leading-3 font-semibold text-black"
        >
          {item.badge}
        </span>
      ) : null}
    </>
  );
}

export function MarketingButton({
  variant = "primary",
  size = "default",
  shape = "pill",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary";
  size?: "default" | "compact";
  shape?: "pill" | "rounded";
}) {
  return (
    <Link
      className={cn(
        "inline-flex max-w-full min-w-0 items-center justify-center overflow-hidden border text-sm font-medium text-ellipsis whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 ease-in-out focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none",
        size === "compact" ? "h-8 px-3" : "h-10 px-4",
        shape === "rounded" ? "rounded-md" : "rounded-full",
        variant === "primary"
          ? "border-black bg-black text-white hover:border-neutral-800 hover:bg-neutral-800 focus-visible:border-neutral-800 focus-visible:bg-neutral-800"
          : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50 focus-visible:border-neutral-300 focus-visible:bg-neutral-50",
        className,
      )}
      {...props}
    />
  );
}
