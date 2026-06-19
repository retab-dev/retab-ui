"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { KeyedRunner } from "@/hooks/KeyedRunner";
import { cn } from "@/lib/utils";

import { type NavGroup } from "./homepage-types";
import {
  focusRing,
  getLinkAriaLabel,
  getLinkProps,
  MarketingLinkLabel,
} from "./primitives";

export function HeaderDropdown({ group }: { group: NavGroup }) {
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
            function closeOnEscape(event: KeyboardEvent) {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsOpen(false);
                triggerRef.current?.focus();
              }
            }

            window.addEventListener("keydown", closeOnEscape);
            return () => window.removeEventListener("keydown", closeOnEscape);
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
          "text-muted-foreground hover:text-foreground focus-visible:text-foreground inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm transition-colors duration-150 ease-out motion-reduce:transition-none",
          isOpen && "text-foreground",
          focusRing,
        )}
      >
        {group.label}
        <ChevronDown className="text-muted-foreground size-3" />
      </button>
      <div
        id={menuId}
        hidden={!isOpen}
        className="bg-background/95 border-border fixed inset-x-0 top-16 z-50 border-b shadow-sm"
      >
        <div className="mx-auto flex w-full max-w-screen-2xl flex-nowrap gap-x-4 px-6 pt-8 pb-12">
          {group.sections.map((section) => (
            <div key={section.title} className="w-64 min-w-0">
              <h3 className="text-muted-foreground mb-3 font-mono text-xs leading-none font-medium uppercase">
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
                        "text-foreground hover:text-foreground focus-visible:text-foreground inline-flex h-8 w-full max-w-full items-center gap-2 rounded-sm py-1 text-sm leading-5 transition-colors duration-150 ease-out motion-reduce:transition-none",
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
