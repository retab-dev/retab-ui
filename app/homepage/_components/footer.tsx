import Link from "next/link";

import { cn } from "@/lib/utils";

import { FooterCookiePreferencesButton } from "./footer-cookie-preferences-button";
import { type FooterContent, type LinkItem } from "./homepage-types";
import {
  focusRing,
  getLinkAriaLabel,
  getLinkProps,
  MarketingContainer,
  MarketingLinkLabel,
  VercelMark,
} from "./primitives";

const footerItemClass = cn(
  "-mx-0.5 inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-sm px-0.5 py-0 text-left text-sm leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground motion-reduce:transition-none",
  focusRing,
);

function FooterColumn({
  id,
  title,
  links,
}: {
  id: string;
  title: string;
  links: readonly LinkItem[];
}) {
  const headingId = `homepage-footer-${id}`;

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h2
        id={headingId}
        className="text-foreground mt-3 mb-4 font-mono text-xs leading-none font-medium tracking-normal uppercase"
      >
        {title}
      </h2>
      <ul className="grid gap-1">
        {links.map((link) => (
          <li key={link.label}>
            {link.action === "cookie-preferences" ? (
              <FooterCookiePreferencesButton
                ariaLabel={getLinkAriaLabel(link)}
                className={footerItemClass}
                item={link}
              />
            ) : (
              <Link
                href={link.href}
                aria-label={getLinkAriaLabel(link)}
                {...getLinkProps(link)}
                className={footerItemClass}
              >
                <MarketingLinkLabel item={link} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusIndicator({ status }: { status: FooterContent["status"] }) {
  return (
    <div
      aria-label={status.ariaLabel}
      className="text-muted-foreground inline-flex h-8 w-fit items-center rounded-md px-2 font-mono text-sm"
    >
      {status.label}
    </div>
  );
}

function FooterLogo() {
  return (
    <Link
      href="/"
      aria-label="Retab homepage"
      className={cn(
        "text-foreground hover:text-muted-foreground focus-visible:text-foreground inline-flex h-8 w-full max-w-48 items-center rounded-sm transition-colors motion-reduce:transition-none",
        focusRing,
      )}
    >
      <VercelMark className="size-5" />
    </Link>
  );
}

export function MarketingFooter({ content }: { content: FooterContent }) {
  return (
    <footer aria-labelledby="homepage-footer-heading" className="bg-muted/30">
      <h2 id="homepage-footer-heading" className="sr-only">
        Footer
      </h2>
      <MarketingContainer className="py-10">
        <nav aria-label="Footer navigation">
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-2 lg:gap-y-8">
            {content.columns.map((column) => (
              <FooterColumn
                key={column.id}
                id={column.id}
                title={column.title}
                links={column.links}
              />
            ))}
          </div>
        </nav>

        <div className="mt-12">
          <FooterLogo />
        </div>

        <div className="mt-6 flex min-h-8 flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <StatusIndicator status={content.status} />
        </div>
      </MarketingContainer>
    </footer>
  );
}
