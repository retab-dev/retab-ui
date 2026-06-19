import Link from "next/link"
import { ChevronDown, Menu } from "lucide-react"

import { mobileNavLinks, navGroups } from "./homepage-content"
import { type LinkItem, type NavGroup } from "./homepage-types"
import { MarketingButton, MarketingContainer, VercelMark } from "./primitives"

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"

function LinkLabel({ item }: { item: LinkItem }) {
  return (
    <>
      {item.label}
      {item.badge ? (
        <span
          aria-hidden="true"
          className="rounded-[2px] border border-black px-1 text-[9px] leading-3 font-semibold text-black"
        >
          {item.badge}
        </span>
      ) : null}
    </>
  )
}

function HeaderDropdown({
  label,
  sections,
}: {
  label: string
  sections: NavGroup["sections"]
}) {
  const menuId = `homepage-${label.toLowerCase()}-menu`

  return (
    <div className="group relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-controls={menuId}
        className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-neutral-700 transition-colors hover:text-black ${focusRing}`}
      >
        {label}
        <ChevronDown className="size-3" />
      </button>
      <div
        id={menuId}
        className="pointer-events-none invisible absolute top-9 left-0 z-20 grid w-[620px] grid-cols-3 gap-6 rounded-md border border-neutral-200 bg-white p-5 opacity-0 shadow-xl shadow-black/5 transition-opacity group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 motion-reduce:transition-none"
      >
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-xs font-medium text-neutral-500">
              {section.title}
            </h3>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-label={
                      item.badge ? `${item.label} ${item.badge}` : item.label
                    }
                    className={`inline-flex items-center gap-2 rounded-sm text-sm text-neutral-700 transition-colors hover:text-black ${focusRing}`}
                  >
                    <LinkLabel item={item} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <MarketingContainer className="flex h-16 items-center gap-6">
        <Link
          href="/homepage"
          className="inline-flex size-8 items-center justify-center"
          aria-label="Vercel homepage"
        >
          <VercelMark />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-2 min-[961px]:flex"
        >
          {navGroups.map((group) => (
            <HeaderDropdown
              key={group.label}
              label={group.label}
              sections={group.sections}
            />
          ))}
          <Link
            href="https://vercel.com/enterprise"
            className={`rounded-md px-2 text-sm text-neutral-700 hover:text-black ${focusRing}`}
          >
            Enterprise
          </Link>
          <Link
            href="https://vercel.com/pricing"
            className={`rounded-md px-2 text-sm text-neutral-700 hover:text-black ${focusRing}`}
          >
            Pricing
          </Link>
        </nav>

        <div className="ml-auto hidden items-center gap-2 min-[961px]:flex">
          <MarketingButton
            href="https://vercel.com/contact/sales/demo"
            variant="secondary"
            size="compact"
            shape="rounded"
          >
            Get a Demo
          </MarketingButton>
          <MarketingButton
            href="https://vercel.com/login"
            variant="secondary"
            size="compact"
            shape="rounded"
          >
            Log In
          </MarketingButton>
          <MarketingButton
            href="https://vercel.com/signup"
            size="compact"
            shape="rounded"
          >
            Sign Up
          </MarketingButton>
        </div>

        <details className="group relative ml-auto min-[961px]:hidden">
          <summary
            aria-label="Open navigation"
            className={`flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-transparent text-black marker:hidden [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <Menu className="size-5" />
          </summary>
          <div className="absolute top-12 right-0 hidden w-[min(360px,calc(100vw-3rem))] rounded-md border border-neutral-200 bg-white px-5 py-5 shadow-xl shadow-black/5 group-open:block">
            <nav aria-label="Mobile primary" className="grid gap-5">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <div className="text-2xl leading-none font-medium text-black">
                    {group.label}
                  </div>
                  <div className="mt-4 grid gap-3">
                    {group.sections.flatMap((section) =>
                      section.items.slice(0, 3).map((item) => (
                        <Link
                          key={`${group.label}-${item.label}`}
                          href={item.href}
                          aria-label={
                            item.badge
                              ? `${item.label} ${item.badge}`
                              : item.label
                          }
                          className={`inline-flex items-center gap-2 text-base text-neutral-600 ${focusRing}`}
                        >
                          <LinkLabel item={item} />
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ))}
              <div className="grid gap-3 border-t border-neutral-200 pt-5">
                {mobileNavLinks.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`text-base font-medium text-neutral-900 ${focusRing}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <MarketingButton
                  href="https://vercel.com/login"
                  variant="secondary"
                  size="compact"
                  shape="rounded"
                >
                  Log In
                </MarketingButton>
                <MarketingButton
                  href="https://vercel.com/signup"
                  size="compact"
                  shape="rounded"
                >
                  Sign Up
                </MarketingButton>
              </div>
            </nav>
          </div>
        </details>
      </MarketingContainer>
    </header>
  )
}
