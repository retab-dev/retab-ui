import Link from "next/link";

import { cn } from "@/lib/utils";

import { HeaderNavigation } from "./header-navigation";
import { type HeaderContent } from "./homepage-types";
import { focusRing, MarketingContainer, VercelMark } from "./primitives";

export function MarketingHeader({ content }: { content: HeaderContent }) {
  return (
    <header className="bg-background/50 fixed inset-x-0 top-0 z-50 backdrop-blur">
      <MarketingContainer className="flex h-16 items-center gap-5">
        <Link
          href={content.homeHref}
          className={cn(
            "hover:bg-accent focus-visible:bg-accent -ml-2 inline-flex size-9 items-center justify-center rounded-md transition-colors motion-reduce:transition-none",
            focusRing,
          )}
          aria-label="Retab"
        >
          <VercelMark />
        </Link>
        <HeaderNavigation content={content} />
      </MarketingContainer>
    </header>
  );
}
