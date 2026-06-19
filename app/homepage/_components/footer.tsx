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
  "-mx-0.5 inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-sm px-0.5 py-0 text-left text-sm leading-5 text-neutral-600 transition-colors hover:text-black focus-visible:text-black motion-reduce:transition-none",
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
        className="mt-3 mb-4 font-mono text-xs leading-none font-medium tracking-normal text-neutral-950 uppercase"
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

function StatusLink({ status }: { status: FooterContent["status"] }) {
  return (
    <Link
      href={status.href}
      aria-label={getLinkAriaLabel(status)}
      {...getLinkProps(status)}
      className={cn(
        "inline-flex h-8 w-fit items-center rounded-md px-2 font-mono text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black motion-reduce:transition-none",
        focusRing,
      )}
    >
      {status.label}
    </Link>
  );
}

function FooterLogo() {
  return (
    <Link
      href="/homepage"
      aria-label="Vercel homepage"
      className={cn(
        "inline-flex h-8 w-full max-w-48 items-center rounded-sm text-black transition-colors hover:text-neutral-600 focus-visible:text-black motion-reduce:transition-none",
        focusRing,
      )}
    >
      <VercelMark className="size-5" />
    </Link>
  );
}

export function MarketingFooter({ content }: { content: FooterContent }) {
  return (
    <footer aria-labelledby="homepage-footer-heading" className="bg-gray-50">
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
          <StatusLink status={content.status} />
        </div>
      </MarketingContainer>
    </footer>
  );
}
