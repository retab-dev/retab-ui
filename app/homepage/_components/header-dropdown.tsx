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
