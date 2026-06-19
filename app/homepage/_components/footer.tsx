"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Github,
  Instagram,
  Linkedin,
  Monitor,
  Moon,
  Sun,
  Youtube,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

import { footerColumns, statusLink, themeOptions } from "./homepage-content"
import { type LinkItem, type ThemeValue } from "./homepage-types"
import { getLinkAriaLabel, MarketingLinkLabel, VercelMark } from "./primitives"

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"

const socialLinks =
  footerColumns.find((column) => column.id === "social")?.links ?? []

const navigationColumns = footerColumns.filter(
  (column) => column.id !== "social"
)

const socialIcons: Partial<Record<string, LucideIcon>> = {
  GitHub: Github,
  Instagram,
  LinkedIn: Linkedin,
  YouTube: Youtube,
}

function isThemeValue(value: string | undefined): value is ThemeValue {
  return themeOptions.some((option) => option.value === value)
}

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
    <nav aria-labelledby={headingId} className="min-w-0">
      <h2
        id={headingId}
        className="mb-3 font-mono text-xs leading-5 font-semibold tracking-normal text-black uppercase"
      >
        {title}
      </h2>
      <ul className="grid gap-1.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-label={getLinkAriaLabel(link)}
              className={cn(
                "-mx-1 inline-flex max-w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-sm leading-5 text-neutral-600 transition-colors hover:text-black focus-visible:text-black motion-reduce:transition-none",
                focusRing
              )}
            >
              <MarketingLinkLabel item={link} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SocialIcon({ label }: { label: string }) {
  if (label === "X") {
    return (
      <span aria-hidden="true" className="text-[13px] leading-none font-bold">
        X
      </span>
    )
  }

  const Icon = socialIcons[label]

  if (!Icon) {
    return (
      <span aria-hidden="true" className="text-xs leading-none font-semibold">
        {label.slice(0, 1)}
      </span>
    )
  }

  return <Icon aria-hidden="true" className="size-4" strokeWidth={1.8} />
}

function SocialLinks() {
  return (
    <nav aria-label="Social links">
      <ul className="flex flex-wrap items-center gap-1">
        {socialLinks.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-label={link.label}
              title={link.label}
              className={cn(
                "grid size-8 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:text-black motion-reduce:transition-none",
                focusRing
              )}
            >
              <SocialIcon label={link.label} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function ThemeIcon({ value }: { value: ThemeValue }) {
  if (value === "light") {
    return <Sun aria-hidden="true" className="size-4" />
  }

  if (value === "dark") {
    return <Moon aria-hidden="true" className="size-4" />
  }

  return <Monitor aria-hidden="true" className="size-4" />
}

function ThemeSelector() {
  const [isMounted, setIsMounted] = useState(false)
  const { setTheme, theme } = useTheme()
  const selectedTheme: ThemeValue =
    isMounted && isThemeValue(theme) ? theme : "system"

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <div
      role="group"
      aria-label="Display theme"
      className="inline-flex rounded-full border border-neutral-200 bg-white p-1 shadow-[0_1px_1px_rgba(0,0,0,0.03)]"
    >
      {themeOptions.map((option) => {
        const isSelected = selectedTheme === option.value

        return (
          <button
            key={option.value}
            type="button"
            aria-label={`Use ${option.label.toLowerCase()} theme`}
            aria-pressed={isSelected}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "grid size-8 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:z-10 motion-reduce:transition-none",
              focusRing,
              isSelected &&
                "bg-black text-white hover:bg-black hover:text-white"
            )}
          >
            <ThemeIcon value={option.value} />
          </button>
        )
      })}
    </div>
  )
}

function StatusLink() {
  return (
    <Link
      href={statusLink.href}
      aria-label={statusLink.label}
      className={cn(
        "inline-flex items-center gap-2 rounded px-1 py-0.5 text-sm text-neutral-600 transition-colors hover:text-black focus-visible:text-black motion-reduce:transition-none",
        focusRing
      )}
    >
      <span
        aria-hidden="true"
        className="size-2 rounded-full bg-[rgb(0,179,89)] shadow-[0_0_0_3px_rgba(0,179,89,0.14)]"
      />
      All systems normal
    </Link>
  )
}

export function MarketingFooter() {
  return (
    <footer
      aria-labelledby="homepage-footer-heading"
      className="border-t border-neutral-200 bg-white"
    >
      <h2 id="homepage-footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto w-[calc(100%-48px)] max-w-[1400px] py-12 sm:py-14">
        <div className="grid grid-cols-2 gap-x-7 gap-y-10 min-[520px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-9 xl:gap-x-12">
          {navigationColumns.map((column) => (
            <FooterColumn
              key={column.id}
              id={column.id}
              title={column.title}
              links={column.links}
            />
          ))}
        </div>

        <div className="mt-12 border-t border-neutral-200 pt-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
              <Link
                href="/homepage"
                aria-label="Vercel homepage"
                className={cn(
                  "-mx-1 inline-flex w-fit items-center gap-3 rounded px-1 py-0.5 text-black",
                  focusRing
                )}
              >
                <VercelMark className="h-[14px] w-4" />
                <span className="text-sm font-medium">Vercel</span>
              </Link>
              <span className="text-sm text-neutral-500">
                &copy; 2026 Vercel Inc.
              </span>
              <StatusLink />
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:justify-between lg:justify-end">
              <SocialLinks />
              <ThemeSelector />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
