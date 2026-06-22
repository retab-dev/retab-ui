import Link from "next/link";

import { cn } from "@/lib/utils";

import { HeaderNavigation } from "./header-navigation";
import { type HeaderContent } from "./homepage-types";
import { focusRing, MarketingContainer, RetabMark } from "./primitives";

export function MarketingHeader({ content }: { content: HeaderContent }) {
  return (
    <header className="bg-background fixed inset-x-0 top-0 z-50">
      <MarketingContainer className="flex h-16 items-center gap-5">
        <Link
          href={content.homeHref}
          className={cn(
            "hover:bg-accent focus-visible:bg-accent -ml-2 inline-flex size-9 items-center justify-center rounded-md transition-colors motion-reduce:transition-none",
            focusRing,
          )}
          aria-label="Retab"
        >
          <RetabMark />
        </Link>
        <HeaderNavigation content={content} />
      </MarketingContainer>
    </header>
  );
}
