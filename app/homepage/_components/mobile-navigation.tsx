"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { KeyedRunner } from "@/hooks/KeyedRunner";
import { cn } from "@/lib/utils";

import { HeaderActionButton } from "./header-action-button";
import { type HeaderContent } from "./homepage-types";
import {
  focusRing,
  getLinkAriaLabel,
  getLinkProps,
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

export function MobileNavigation({ content }: { content: HeaderContent }) {
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
          "text-foreground focus-visible:bg-accent flex min-h-11 min-w-11 items-center justify-end rounded-md transition-colors duration-150 ease-out motion-reduce:transition-none",
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
        className="bg-background fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto overscroll-contain px-6 py-6 shadow-none"
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
                  "text-foreground hover:text-muted-foreground focus-visible:text-foreground flex w-full items-center justify-between py-2 text-left text-2xl leading-tight font-normal transition-colors motion-reduce:transition-none",
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
                        className="text-muted-foreground font-mono text-xs leading-none font-semibold tracking-normal uppercase"
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
                              "text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground -mx-2 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xl font-normal transition-colors motion-reduce:transition-none",
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
                "text-foreground hover:text-muted-foreground focus-visible:text-foreground flex items-center py-2 text-2xl leading-tight font-normal transition-colors motion-reduce:transition-none",
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
