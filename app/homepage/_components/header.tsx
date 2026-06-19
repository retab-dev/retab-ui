"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, Menu, X } from "lucide-react"

import { navGroups, utilityNavLinks } from "./homepage-content"
import { type NavGroup } from "./homepage-types"
import {
  getLinkAriaLabel,
  MarketingButton,
  MarketingContainer,
  MarketingLinkLabel,
  VercelMark,
} from "./primitives"

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none"

function HeaderDropdown({ group }: { group: NavGroup }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = `homepage-${group.id}-menu`

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen])

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-neutral-700 transition-colors hover:text-black ${focusRing}`}
      >
        {group.label}
        <ChevronDown className="size-3" />
      </button>
      <div
        id={menuId}
        hidden={!isOpen}
        className="absolute top-9 left-0 z-20 grid w-[620px] grid-cols-3 gap-6 rounded-md border border-neutral-200 bg-white p-5 shadow-xl shadow-black/5"
      >
        {group.sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-xs font-medium text-neutral-500">
              {section.title}
            </h3>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-label={getLinkAriaLabel(item)}
                    className={`inline-flex items-center gap-2 rounded-sm text-sm text-neutral-700 transition-colors hover:text-black ${focusRing}`}
                  >
                    <MarketingLinkLabel item={item} />
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

function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false)
  const menuId = "homepage-mobile-menu"

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen])

  return (
    <div className="ml-auto min-[961px]:hidden">
      <button
        type="button"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex size-11 items-center justify-center rounded-full border border-transparent text-black ${focusRing}`}
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <div
        id={menuId}
        hidden={!isOpen}
        className="fixed inset-x-3 top-[72px] z-40 max-h-[calc(100svh-5rem)] overflow-y-auto overscroll-contain rounded-md border border-neutral-200 bg-white px-5 py-5 shadow-xl shadow-black/5"
      >
        <nav aria-label="Mobile primary" className="grid gap-6">
          {navGroups.map((group) => (
            <div key={group.id}>
              <div className="text-2xl leading-none font-medium text-black">
                {group.label}
              </div>
              {group.sections.map((section) => (
                <div key={section.title} className="mt-5">
                  <div className="mb-3 font-mono text-xs text-neutral-500 uppercase">
                    {section.title}
                  </div>
                  <div className="grid gap-3">
                    {section.items.map((item) => (
                      <Link
                        key={`${group.id}-${section.title}-${item.label}`}
                        href={item.href}
                        aria-label={getLinkAriaLabel(item)}
                        onClick={() => setIsOpen(false)}
                        className={`inline-flex items-center gap-2 text-base text-neutral-600 ${focusRing}`}
                      >
                        <MarketingLinkLabel item={item} />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="grid gap-3 border-t border-neutral-200 pt-5">
            {utilityNavLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`text-base font-medium text-neutral-900 ${focusRing}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <MarketingButton
              href="https://vercel.com/login"
              variant="secondary"
              size="compact"
              shape="rounded"
              onClick={() => setIsOpen(false)}
            >
              Log In
            </MarketingButton>
            <MarketingButton
              href="https://vercel.com/signup"
              size="compact"
              shape="rounded"
              onClick={() => setIsOpen(false)}
            >
              Sign Up
            </MarketingButton>
          </div>
        </nav>
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
            <HeaderDropdown key={group.id} group={group} />
          ))}
          {utilityNavLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-md px-2 text-sm text-neutral-700 hover:text-black ${focusRing}`}
            >
              {item.label}
            </Link>
          ))}
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

        <MobileNavigation />
      </MarketingContainer>
    </header>
  )
}
