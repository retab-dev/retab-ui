import Link from "next/link"
import { Monitor, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  footerColumns,
  themeOptions,
  type LinkItem,
  type ThemeOption,
} from "./data"
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
      <h2 className="mb-3 text-sm font-semibold text-black">{title}</h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors hover:text-black"
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
        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
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
            <VercelMark className="border-x-[8px] border-b-[14px]" />
            <span className="text-sm font-medium text-black">Vercel</span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
            <Link
              href="https://vercel-status.com/"
              className="inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors hover:text-black"
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              All systems normal
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-500">
                Select a display theme:
              </span>
              <div
                aria-label="Display theme"
                className="inline-flex rounded-full border border-neutral-200 bg-white p-1"
                role="group"
              >
                {themeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === "system"}
                    className={cn(
                      "grid size-8 place-items-center rounded-full text-neutral-500 transition-colors hover:text-black",
                      option === "system" && "bg-neutral-100 text-black"
                    )}
                  >
                    <span className="sr-only">{option}</span>
                    <ThemeIcon option={option} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
