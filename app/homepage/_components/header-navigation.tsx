"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { KeyedRunner } from "@/hooks/KeyedRunner";
import { cn } from "@/lib/utils";

import {
  type HeaderAction,
  type HeaderContent,
  type NavGroup,
} from "./homepage-types";
import {
  focusRing,
  getLinkAriaLabel,
  getLinkProps,
  MarketingButton,
  MarketingLinkLabel,
} from "./primitives";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}

function getMobileSectionId(groupId: string, sectionTitle: string) {
  return `homepage-mobile-${groupId}-${sectionTitle
    .toLowerCase()
    .replaceAll(" ", "-")}`;
}

function HeaderDropdown({ group }: { group: NavGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = `homepage-${group.id}-menu`;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => {
        if (rootRef.current?.contains(document.activeElement)) {
          return;
        }

        setIsOpen(false);
      }}
      onFocus={() => setIsOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      {isOpen ? (
        <KeyedRunner
          key={`${menuId}-open`}
          effect={() => {
            function onKeyDown(event: KeyboardEvent) {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsOpen(false);
                triggerRef.current?.focus();
              }
            }

            window.addEventListener("keydown", onKeyDown);
            return () => window.removeEventListener("keydown", onKeyDown);
          }}
        />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-neutral-700 transition-colors duration-150 ease-out hover:text-black focus-visible:text-black motion-reduce:transition-none",
          isOpen && "text-black",
          focusRing,
        )}
      >
        {group.label}
        <ChevronDown className="size-3 text-neutral-500" />
      </button>
      <div
        id={menuId}
        hidden={!isOpen}
        className="fixed inset-x-0 top-16 z-50 border-b border-neutral-200 bg-neutral-50 shadow-sm"
      >
        <div className="mx-auto flex w-full max-w-screen-2xl flex-nowrap gap-x-4 px-6 pt-8 pb-12">
          {group.sections.map((section) => (
            <div key={section.title} className="w-64 min-w-0">
              <h3 className="mb-3 font-mono text-xs leading-none font-medium text-neutral-500 uppercase">
                {section.title}
              </h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      aria-label={getLinkAriaLabel(item)}
                      {...getLinkProps(item)}
                      className={cn(
                        "inline-flex h-8 w-full max-w-full items-center gap-2 rounded-sm py-1 text-sm leading-5 text-neutral-900 transition-colors duration-150 ease-out hover:text-black focus-visible:text-black motion-reduce:transition-none",
                        focusRing,
                      )}
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
    </div>
  );
}

function HeaderActionButton({
  action,
  className,
  onClick,
  shape = "rounded",
  size = "compact",
}: {
  action: HeaderAction;
  className?: string;
  onClick?: () => void;
  shape?: "pill" | "rounded";
  size?: "default" | "compact";
}) {
  return (
    <MarketingButton
      href={action.href}
      aria-label={getLinkAriaLabel(action)}
      {...getLinkProps(action)}
      variant={action.variant}
      size={size}
      shape={shape}
      onClick={onClick}
      className={className}
    >
      {action.label}
    </MarketingButton>
  );
}

function MobileNavigation({ content }: { content: HeaderContent }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>("products");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = "homepage-mobile-menu";

  function closeMobileMenu() {
    setIsOpen(false);
    setOpenGroupId("products");
  }

  return (
    <div className="ml-auto lg:hidden">
      {isOpen ? (
        <KeyedRunner
          key="homepage-mobile-menu-open"
          effect={() => {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";

            const focusFrame = window.requestAnimationFrame(() => {
              menuRef.current?.focus();
            });

            function closeMenu() {
              closeMobileMenu();
              triggerRef.current?.focus();
            }

            function onKeyDown(event: KeyboardEvent) {
              if (event.key === "Escape") {
                event.preventDefault();
                closeMenu();
                return;
              }

              if (event.key !== "Tab") {
                return;
              }

              const focusableElements = getFocusableElements(menuRef.current);
              const firstElement = focusableElements[0];
              const lastElement = focusableElements.at(-1);

              if (!firstElement || !lastElement) {
                event.preventDefault();
                menuRef.current?.focus();
                return;
              }

              if (!menuRef.current?.contains(document.activeElement)) {
                event.preventDefault();
                firstElement.focus();
                return;
              }

              if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
                return;
              }

              if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
              }
            }

            window.addEventListener("keydown", onKeyDown);
            return () => {
              window.cancelAnimationFrame(focusFrame);
              document.body.style.overflow = originalOverflow;
              window.removeEventListener("keydown", onKeyDown);
            };
          }}
        />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex min-h-11 min-w-11 items-center justify-end rounded-md text-black transition-colors duration-150 ease-out focus-visible:bg-neutral-100 motion-reduce:transition-none",
          focusRing,
        )}
      >
        {isOpen ? (
          <X className="size-6 stroke-2" />
        ) : (
          <Menu className="size-6 stroke-2" />
        )}
      </button>

      <div
        ref={menuRef}
        id={menuId}
        hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
        className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto overscroll-contain bg-white px-6 py-6 shadow-none"
      >
        <nav aria-label="Mobile primary" className="grid gap-3">
          {content.navGroups.map((group) => (
            <div key={group.id}>
              <button
                type="button"
                aria-expanded={openGroupId === group.id}
                aria-controls={`homepage-mobile-${group.id}-panel`}
                onClick={() =>
                  setOpenGroupId((current) =>
                    current === group.id ? null : group.id,
                  )
                }
                className={cn(
                  "flex w-full items-center justify-between py-2 text-left text-2xl leading-tight font-normal text-black transition-colors hover:text-neutral-600 focus-visible:text-black motion-reduce:transition-none",
                  focusRing,
                )}
              >
                {group.label}
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform duration-150 ease-out motion-reduce:transition-none",
                    openGroupId === group.id && "rotate-180",
                  )}
                />
              </button>

              <div
                id={`homepage-mobile-${group.id}-panel`}
                hidden={openGroupId !== group.id}
                className="grid gap-6 py-4"
              >
                {group.sections.map((section) => {
                  const headingId = getMobileSectionId(group.id, section.title);

                  return (
                    <section
                      key={`${group.id}-${section.title}`}
                      aria-labelledby={headingId}
                      className="grid gap-3"
                    >
                      <h3
                        id={headingId}
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
                            onClick={closeMobileMenu}
                            className={cn(
                              "-mx-2 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xl font-normal text-neutral-900 transition-colors hover:bg-neutral-100 hover:text-black focus-visible:bg-neutral-100 focus-visible:text-black motion-reduce:transition-none",
                              focusRing,
                            )}
                          >
                            <MarketingLinkLabel item={item} />
                          </Link>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ))}

          {content.utilityLinks.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-label={getLinkAriaLabel(item)}
              {...getLinkProps(item)}
              onClick={closeMobileMenu}
              className={cn(
                "flex items-center py-2 text-2xl leading-tight font-normal text-black transition-colors hover:text-neutral-600 focus-visible:text-black motion-reduce:transition-none",
                focusRing,
              )}
            >
              {item.label}
            </Link>
          ))}

          <div className="grid gap-2 pt-5">
            {content.mobileActions.map((action) => (
              <HeaderActionButton
                key={action.label}
                action={action}
                className="w-full"
                onClick={closeMobileMenu}
                size="default"
              />
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function HeaderNavigation({ content }: { content: HeaderContent }) {
  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-2 lg:flex">
        {content.navGroups.map((group) => (
          <HeaderDropdown key={group.id} group={group} />
        ))}
        {content.utilityLinks.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-label={getLinkAriaLabel(item)}
            {...getLinkProps(item)}
            className={cn(
              "rounded-md px-2 py-1 text-sm text-neutral-700 transition-colors duration-150 ease-out hover:text-black focus-visible:text-black motion-reduce:transition-none",
              focusRing,
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto hidden items-center gap-2 lg:flex">
        {content.desktopActions.map((action) => (
          <HeaderActionButton key={action.label} action={action} />
        ))}
      </div>

      <MobileNavigation content={content} />
    </>
  );
}
