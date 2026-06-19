"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  type HeaderAction,
  type HeaderContent,
  type NavGroup,
} from "./homepage-types"
import {
  focusRing,
  getLinkAriaLabel,
  getLinkProps,
  MarketingButton,
  MarketingLinkLabel,
} from "./primitives"

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",")

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
}

function HeaderDropdown({ group }: { group: NavGroup }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = `homepage-${group.id}-menu`

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        setIsOpen(false)
        triggerRef.current?.focus()
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
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-neutral-700 transition-[background-color,color] duration-150 ease-out hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black motion-reduce:transition-none",
          isOpen && "bg-neutral-100 text-black",
          focusRing
        )}
      >
        {group.label}
        <ChevronDown
          className={`size-3 transition-transform duration-150 ease-out motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={menuId}
        hidden={!isOpen}
        className="absolute top-8 left-0 z-20 grid w-[620px] grid-cols-3 gap-6 rounded-md border border-neutral-200 bg-white p-5 shadow-xl shadow-black/5"
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
                    {...getLinkProps(item)}
                    className={`inline-flex items-center gap-2 rounded-sm text-sm text-neutral-700 underline-offset-4 transition-colors duration-150 ease-out hover:text-black hover:underline hover:decoration-neutral-400 focus-visible:text-black focus-visible:underline focus-visible:decoration-neutral-400 motion-reduce:transition-none ${focusRing}`}
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

function HeaderActionButton({
  action,
  onClick,
}: {
  action: HeaderAction
  onClick?: () => void
}) {
  return (
    <MarketingButton
      href={action.href}
      aria-label={getLinkAriaLabel(action)}
      {...getLinkProps(action)}
      variant={action.variant}
      size="compact"
      shape="rounded"
      onClick={onClick}
    >
      {action.label}
    </MarketingButton>
  )
}

function MobileNavigation({ content }: { content: HeaderContent }) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = "homepage-mobile-menu"

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    window.requestAnimationFrame(() => {
      const [firstFocusable] = getFocusableElements(menuRef.current)
      ;(firstFocusable ?? menuRef.current)?.focus()
    })

    function closeMenu() {
      setIsOpen(false)
      triggerRef.current?.focus()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault()
        closeMenu()
        return
      }

      if (event.key !== "Tab") {
        return
      }

      const focusableElements = getFocusableElements(menuRef.current)
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)

      if (!firstElement || !lastElement) {
        event.preventDefault()
        menuRef.current?.focus()
        return
      }

      if (!menuRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        firstElement.focus()
        return
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
        return
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  return (
    <div className="ml-auto min-[961px]:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex size-11 items-center justify-center rounded-full border border-transparent text-black transition-[background-color,transform] duration-150 ease-out hover:bg-neutral-100 focus-visible:bg-neutral-100 active:scale-95 motion-reduce:transform-none motion-reduce:transition-none ${focusRing}`}
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <div
        ref={menuRef}
        id={menuId}
        hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        tabIndex={-1}
        className="fixed inset-x-3 top-[72px] z-40 max-h-[calc(100svh-5rem)] overflow-y-auto overscroll-contain rounded-md border border-neutral-200 bg-white px-5 py-5 shadow-xl shadow-black/5"
      >
        <nav aria-label="Mobile primary" className="grid gap-7">
          {content.navGroups.map((group) => (
            <div key={group.id} className="grid gap-5">
              <h2 className="text-2xl leading-none font-medium text-black">
                {group.label}
              </h2>
              {group.sections.map((section) => (
                <section
                  key={`${group.id}-${section.title}`}
                  aria-labelledby={`homepage-mobile-${group.id}-${section.title.toLowerCase().replaceAll(" ", "-")}`}
                  className="grid gap-3"
                >
                  <h3
                    id={`homepage-mobile-${group.id}-${section.title.toLowerCase().replaceAll(" ", "-")}`}
                    className="font-mono text-xs leading-none font-semibold tracking-normal text-neutral-500 uppercase"
                  >
                    {section.title}
                  </h3>
                  <div className="grid gap-3">
                    {section.items.map((item) => (
                      <Link
                        key={`${group.id}-${section.title}-${item.label}`}
                        href={item.href}
                        aria-label={getLinkAriaLabel(item)}
                        {...getLinkProps(item)}
                        onClick={() => setIsOpen(false)}
                        className={`-mx-2 inline-flex items-center gap-2 rounded-md px-2 py-1 text-base text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black motion-reduce:transition-none ${focusRing}`}
                      >
                        <MarketingLinkLabel item={item} />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ))}

          <div className="grid gap-3 border-t border-neutral-200 pt-5">
            {content.utilityLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-label={getLinkAriaLabel(item)}
                {...getLinkProps(item)}
                onClick={() => setIsOpen(false)}
                className={`-mx-2 rounded-md px-2 py-1 text-base font-medium text-neutral-900 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black motion-reduce:transition-none ${focusRing}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            {content.mobileActions.map((action) => (
              <HeaderActionButton
                key={action.label}
                action={action}
                onClick={() => setIsOpen(false)}
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}

export function HeaderNavigation({ content }: { content: HeaderContent }) {
  return (
    <>
      <nav
        aria-label="Primary"
        className="hidden items-center gap-2 min-[961px]:flex"
      >
        {content.navGroups.map((group) => (
          <HeaderDropdown key={group.id} group={group} />
        ))}
        {content.utilityLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-label={getLinkAriaLabel(item)}
            {...getLinkProps(item)}
            className={`rounded-md px-2 py-1 text-sm text-neutral-700 transition-[background-color,color] duration-150 ease-out hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black motion-reduce:transition-none ${focusRing}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto hidden items-center gap-2 min-[961px]:flex">
        {content.desktopActions.map((action) => (
          <HeaderActionButton key={action.label} action={action} />
        ))}
      </div>

      <MobileNavigation content={content} />
    </>
  )
}
