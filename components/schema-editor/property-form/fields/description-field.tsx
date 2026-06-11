"use client"

import { FormItem } from "@/components/ui-retab/form"
import { Label } from "@/components/ui-retab/label"
import { Textarea } from "@/components/ui-retab/textarea"

export function DescriptionField({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (description: string) => void
}) {
  return (
    <FormItem className="group">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={disabled ? "disabled:opacity-100" : ""}
      />
    </FormItem>
  )
}
