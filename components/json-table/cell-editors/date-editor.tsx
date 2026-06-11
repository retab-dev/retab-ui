import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { CellDisplay } from "@/components/json-table/cell-display"
import type { CellEditorProps } from "@/components/json-table/cell-editors/editor-types"
import { fieldFocusId } from "@/components/json-table/cell-editors/editor-types"
import {
  dateStringToFormat,
  getLocalDateString,
} from "@/components/json-table/lib/date-display-formatting"
import { parseDateStringAsLocal } from "@/components/json-table/lib/date-parsing"
import { Button } from "@/components/ui-retab/button"
import { Calendar } from "@/components/ui-retab/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-retab/popover"

function safeParseISO(dateString: string | null | undefined): Date | undefined {
  return parseDateStringAsLocal(dateString) ?? undefined
}

export function DateEditor({
  identity,
  field,
  textDraft,
  focus,
  overlays,
  commit,
}: CellEditorProps) {
  const focusId = fieldFocusId(identity)
  const date = safeParseISO(textDraft.activeTextValue)

  if (!overlays.showInput) {
    return (
      <CellDisplay className="items-center py-2">
        {date ? (
          format(date, "PP")
        ) : (
          <span className="text-muted-foreground">Pick a date</span>
        )}
      </CellDisplay>
    )
  }

  return (
    <Popover
      open={overlays.isDatePopoverOpen}
      onOpenChange={(open) => {
        overlays.setIsDatePopoverOpen(open)
        if (open) {
          textDraft.setDraftTextValue(textDraft.committedTextValue)
          focus.setFocusedField(focusId)
          focus.setIsInputFocused(true)
        } else {
          focus.setFocusedField(null)
          focus.setIsInputFocused(false)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={!field.isEditable}
          className={cn(
            "h-full w-full justify-start rounded-none border-0 px-2 py-0 text-left text-xs leading-none font-normal text-inherit shadow-none hover:bg-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0",
            !field.effectiveValue && "text-muted-foreground",
            "disabled:opacity-100",
            focus.focusedField === focusId &&
              "absolute top-0 left-0 z-10 shadow-md"
          )}
          onClick={() => {
            focus.setFocusedField(focusId)
            focus.setIsInputFocused(true)
          }}
        >
          {date ? (
            format(date, "PP")
          ) : (
            <span className="text-muted-foreground">Pick a date</span>
          )}
          <CalendarIcon className="ml-auto size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-50 w-auto p-0"
        align="start"
        side="bottom"
        sideOffset={0}
        avoidCollisions={false}
        updatePositionStrategy="always"
      >
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(picked) => {
            if (picked) {
              const convertedDate = dateStringToFormat(
                getLocalDateString(picked),
                "2000-01-01"
              )
              textDraft.setDraftTextValue(convertedDate || "")
              commit.onCommit(convertedDate || null)
            } else {
              textDraft.setDraftTextValue("")
              commit.onCommit(null)
            }
          }}
          onDayClick={(picked) => {
            if (!picked) return
            const convertedDate = dateStringToFormat(
              getLocalDateString(picked),
              "2000-01-01"
            )
            textDraft.setDraftTextValue(convertedDate || "")
            commit.onCommit(convertedDate || null)
            overlays.setIsDatePopoverOpen(false)
            focus.setFocusedField(null)
            focus.setIsInputFocused(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
