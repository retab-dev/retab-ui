"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type SchemaTypeMenuVariant = "row" | "form"

export interface SchemaTypeMenuValue {
  id: string
  label: string
  icon: React.ReactNode
}

export interface SchemaTypeMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  closeOnSelect?: boolean
  onSelect: () => void
}

export type SchemaTypeMenuSection =
  | {
      id: string
      kind: "items"
      items: SchemaTypeMenuItem[]
    }
  | {
      id: string
      kind: "submenu"
      label: string
      icon?: React.ReactNode
      items: SchemaTypeMenuItem[]
    }

export type SchemaTypeMenuTrailingContent = (context: {
  editable: boolean
}) => React.ReactNode

interface SchemaTypeMenuProps {
  ariaLabel?: string
  editable: boolean
  sections: SchemaTypeMenuSection[]
  trailingContent?: SchemaTypeMenuTrailingContent
  value: SchemaTypeMenuValue
  variant: SchemaTypeMenuVariant
}

export function SchemaTypeMenu({
  ariaLabel,
  editable,
  sections,
  trailingContent,
  value,
  variant,
}: SchemaTypeMenuProps) {
  const runMenuAction = (event: Event, item: SchemaTypeMenuItem) => {
    if (!editable) {
      event.preventDefault()
      return
    }
    if (item.closeOnSelect === false) {
      event.preventDefault()
    }
    item.onSelect()
  }

  if (!editable && variant === "row") {
    return <div className="ml-4 w-40 text-xs">{value.label || "string"}</div>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={ariaLabel ?? (variant === "row" ? value.id : undefined)}
          disabled={!editable}
          variant={variant === "row" ? "ghost" : "outline"}
          className={
            variant === "row"
              ? "w-40 justify-between pr-1 pl-2 text-xs font-normal text-muted-foreground"
              : "mt-2 w-full justify-between pr-1 pl-2"
          }
        >
          <div
            className={
              variant === "row"
                ? "flex min-w-0 items-center gap-2"
                : "flex items-center gap-2"
            }
          >
            {value.icon}
            <span className={variant === "row" ? "truncate" : ""}>
              {value.label}
            </span>
          </div>
          <ChevronDown
            className={
              variant === "row"
                ? "mr-1! h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover/row:opacity-100"
                : "mr-1! h-4 w-4"
            }
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={variant === "form" ? "w-full" : ""}>
        {sections.map((section) => {
          if (section.kind === "submenu") {
            return (
              <DropdownMenuSub key={section.id}>
                <DropdownMenuSubTrigger>
                  {section.icon}
                  {section.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {section.items.map((item) => (
                      <SchemaTypeMenuDropdownItem
                        key={item.id}
                        editable={editable}
                        item={item}
                        onSelect={runMenuAction}
                      />
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )
          }

          return section.items.map((item) => (
            <SchemaTypeMenuDropdownItem
              key={item.id}
              editable={editable}
              item={item}
              onSelect={runMenuAction}
            />
          ))
        })}
        {trailingContent?.({ editable })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SchemaTypeMenuDropdownItem({
  editable,
  item,
  onSelect,
}: {
  editable: boolean
  item: SchemaTypeMenuItem
  onSelect: (event: Event, item: SchemaTypeMenuItem) => void
}) {
  return (
    <DropdownMenuItem
      disabled={!editable}
      onSelect={(event) => onSelect(event, item)}
    >
      {item.icon}
      {item.label}
    </DropdownMenuItem>
  )
}
