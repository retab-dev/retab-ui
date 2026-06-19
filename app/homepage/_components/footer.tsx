import Link from "next/link"

import { cn } from "@/lib/utils"

import { FooterCookiePreferencesButton } from "./footer-cookie-preferences-button"
import { FooterThemeSelector } from "./footer-theme-selector"
import { type FooterContent, type LinkItem } from "./homepage-types"
import {
  focusRing,
  getLinkAriaLabel,
  getLinkProps,
  MarketingContainer,
  MarketingLinkLabel,
} from "./primitives"

const footerItemClass = cn(
  "-mx-1 inline-flex max-w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left text-sm leading-5 text-neutral-600 underline-offset-4 transition-colors hover:text-black hover:underline hover:decoration-neutral-400 focus-visible:text-black motion-reduce:transition-none",
  focusRing
)

function FooterColumn({
  id,
  title,
  links,
}: {
  id: string
  title: string
  links: readonly LinkItem[]
}) {
  const headingId = `homepage-footer-${id}`

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h2
        id={headingId}
        className="mb-3 font-mono text-xs leading-5 font-semibold tracking-normal text-neutral-950 uppercase"
      >
        {title}
      </h2>
      <ul className="grid gap-1.5">
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
  )
}

function StatusLink({ status }: { status: FooterContent["status"] }) {
  return (
    <Link
      href={status.href}
      aria-label={getLinkAriaLabel(status)}
      {...getLinkProps(status)}
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded px-1 py-0.5 text-sm text-neutral-600 transition-colors hover:text-black focus-visible:text-black motion-reduce:transition-none",
        focusRing
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-[rgb(0,179,89)] shadow-[0_0_0_3px_rgba(0,179,89,0.14)]"
      />
      {status.label}
    </Link>
  )
}

export function MarketingFooter({ content }: { content: FooterContent }) {
  return (
    <footer
      aria-labelledby="homepage-footer-heading"
      className="border-t border-neutral-200 bg-white"
    >
      <h2 id="homepage-footer-heading" className="sr-only">
        Footer
      </h2>
      <MarketingContainer className="py-10">
        <nav aria-label="Footer navigation">
          <div className="grid grid-cols-2 gap-x-7 gap-y-10 min-[520px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-9 xl:gap-x-12">
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

        <div
          role="group"
          aria-label="Footer status and preferences"
          className="mt-10 border-t border-neutral-200 pt-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <StatusLink status={content.status} />
            </div>

            <div className="shrink-0">
              <FooterThemeSelector options={content.themeOptions} />
            </div>
          </div>
        </div>
      </MarketingContainer>
    </footer>
  )
}
