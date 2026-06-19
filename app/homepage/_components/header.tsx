import Link from "next/link";

import { HeaderNavigation } from "./header-navigation";
import { type HeaderContent } from "./homepage-types";
import { focusRing, MarketingContainer, VercelMark } from "./primitives";

export function MarketingHeader({ content }: { content: HeaderContent }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gray-50/90 backdrop-blur">
      <MarketingContainer className="flex h-16 items-center gap-5">
        <Link
          href={content.homeHref}
          className={`-ml-2 inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100 motion-reduce:transition-none ${focusRing}`}
          aria-label="Vercel"
        >
          <VercelMark />
        </Link>
        <HeaderNavigation content={content} />
      </MarketingContainer>
    </header>
  );
}
