import { type ComponentProps } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { type LinkItem } from "./homepage-types";
import styles from "./homepage.module.css";

export const focusRing = styles.focusRing;

export function VercelMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-0.15238095238095237 -0.15238095238095237 0.30476190476190473 0.30476190476190473"
      className={cn(styles.vercelMark, className)}
    >
      <polygon points="0,-0.15238095238095237 -0.13196577581477162,0.07619047619047618 0.13196577581477162,0.07619047619047618" />
    </svg>
  );
}

export function MarketingContainer({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={cn(styles.container, className)} {...props} />;
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
      <span className={styles.linkLabel}>{item.label}</span>
      {item.badge ? (
        <span aria-hidden="true" className={styles.badge}>
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
        styles.button,
        focusRing,
        size === "compact" ? styles.buttonCompact : styles.buttonDefault,
        shape === "rounded" ? styles.buttonRounded : styles.buttonPill,
        variant === "primary" ? styles.buttonPrimary : styles.buttonSecondary,
        className,
      )}
      {...props}
    />
  );
}
