"use client"

import { FormItem } from "@/components/ui-retab/form"
import { Label } from "@/components/ui-retab/label"
import { Switch } from "@/components/ui-retab/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui-retab/tooltip"

export function NullableField({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <FormItem className="flex flex-row items-center space-y-0 space-x-2">
      <Switch
        id="nullable"
        disabled={disabled}
        checked={checked}
        onCheckedChange={onChange}
        className={disabled ? "disabled:opacity-100" : ""}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Label htmlFor="nullable" className="cursor-pointer">
            Nullable
          </Label>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>
            Nullable fields allow <code>null</code> as a value (the type is
            widened to include <code>null</code>).
          </p>
        </TooltipContent>
      </Tooltip>
    </FormItem>
  )
}
