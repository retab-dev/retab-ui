import Link from "next/link"
import { Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

import { footerColumns, themeOptions } from "./homepage-content"
import { type LinkItem, type ThemeOption } from "./homepage-types"
import { VercelMark } from "./primitives"

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly LinkItem[]
}) {
  return (
    <div>
      <h2 className="mb-3 font-mono text-xs font-semibold text-black uppercase">
        {title}
      </h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-label={
                link.badge ? `${link.label} ${link.badge}` : link.label
              }
              className="inline-flex items-center gap-2 rounded-sm text-sm text-neutral-600 transition-colors hover:text-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              <FooterLinkLabel link={link} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FooterLinkLabel({ link }: { link: LinkItem }) {
  return (
    <>
      {link.label}
      {link.badge ? (
        <span
          aria-hidden="true"
          className="rounded-[2px] border border-black px-1 text-[9px] leading-3 font-semibold text-black"
        >
          {link.badge}
        </span>
      ) : null}
    </>
  )
}

function ThemeIcon({ option }: { option: ThemeOption }) {
  if (option === "light") {
    return <Sun className="size-4" />
  }

  if (option === "dark") {
    return <Moon className="size-4" />
  }

  return <Monitor className="size-4" />
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-200 py-12">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {footerColumns.map((column) => (
            <FooterColumn
              key={column.title}
              title={column.title}
              links={column.links}
            />
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-neutral-200 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <VercelMark className="h-[14px] w-4" />
            <span className="text-sm font-medium text-black">Vercel</span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
            <Link
              href="https://vercel-status.com/"
              className="inline-flex items-center gap-2 rounded-sm font-mono text-xs text-neutral-600 uppercase transition-colors hover:text-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              <span className="size-2 rounded-full bg-neutral-500" />
              Loading status...
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-500">Display theme:</span>
              <div
                aria-hidden="true"
                className="inline-flex rounded-full border border-neutral-200 bg-white p-1"
              >
                {themeOptions.map((option) => (
                  <span
                    key={option}
                    className={cn(
                      "grid size-8 place-items-center rounded-full text-neutral-500",
                      option === "system" && "bg-neutral-100 text-black"
                    )}
                  >
                    <ThemeIcon option={option} />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
