"use client"

import { Button } from "@/components/ui-retab/button"
import { DialogFooter } from "@/components/ui-retab/dialog"

export function PropertyFormFooter({
  canDelete,
  isSubmitting,
  isSubmitDisabled,
  submitLabel,
  onCancel,
  onDelete,
}: {
  canDelete: boolean
  isSubmitting: boolean
  isSubmitDisabled: boolean
  submitLabel: string
  onCancel?: () => void
  onDelete?: () => void
}) {
  return (
    <DialogFooter className="mx-0 mb-0 flex-row justify-between sm:justify-between">
      <div>
        {onDelete && canDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            Delete Property
          </Button>
        )}
      </div>

      <div className="flex space-x-2">
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          className="px-3"
          disabled={isSubmitting || isSubmitDisabled}
        >
          {submitLabel}
        </Button>
      </div>
    </DialogFooter>
  )
}
