import Link from "next/link";

import { cn } from "@/lib/utils";

import { HeaderActionButton } from "./header-action-button";
import { HeaderDropdown } from "./header-dropdown";
import { type HeaderContent } from "./homepage-types";
import { MobileNavigation } from "./mobile-navigation";
import { focusRing, getLinkAriaLabel, getLinkProps } from "./primitives";

export function HeaderNavigation({ content }: { content: HeaderContent }) {
  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex">
        {content.navGroups.map((group) => (
          <HeaderDropdown key={group.id} group={group} />
        ))}
        {content.utilityLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-label={getLinkAriaLabel(item)}
            {...getLinkProps(item)}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:text-foreground rounded-md px-2 py-1 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none",
              focusRing,
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto hidden items-center gap-2 lg:flex">
        {content.desktopActions.map((action) => (
          <HeaderActionButton key={action.label} action={action} />
        ))}
      </div>

      <MobileNavigation content={content} />
    </>
  );
}
