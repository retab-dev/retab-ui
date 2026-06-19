import { type HeaderAction } from "./homepage-types";
import { getLinkAriaLabel, getLinkProps, MarketingButton } from "./primitives";

export function HeaderActionButton({
  action,
  className,
  onClick,
  shape = "rounded",
  size = "compact",
}: {
  action: HeaderAction;
  className?: string;
  onClick?: () => void;
  shape?: "pill" | "rounded";
  size?: "default" | "compact";
}) {
  return (
    <MarketingButton
      href={action.href}
      aria-label={getLinkAriaLabel(action)}
      {...getLinkProps(action)}
      variant={action.variant}
      size={size}
      shape={shape}
      onClick={onClick}
      className={className}
    >
      {action.label}
    </MarketingButton>
  );
}
