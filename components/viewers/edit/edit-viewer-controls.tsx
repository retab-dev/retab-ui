import { FileText } from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { EditViewerStatusBadge } from "./edit-viewer-states"
import type { EditViewerMode, EditViewerStatus } from "./edit-viewer-types"

const MODE_LABELS: Record<EditViewerMode, string> = {
  source: "Source",
  preview: "Preview",
  filled: "Filled",
}

export function EditViewerControls({
  modes,
  mode,
  onModeChange,
  status,
}: {
  modes: readonly EditViewerMode[]
  mode: EditViewerMode | null
  onModeChange: (mode: EditViewerMode) => void
  status: Exclude<EditViewerStatus, { state: "idle" }> | null
}) {
  if (modes.length === 0) return null

  return (
    <div className="flex h-full min-w-0 items-center gap-3">
      {modes.length > 1 && mode ? (
        <Tabs
          value={mode}
          onValueChange={(value) => onModeChange(value as EditViewerMode)}
        >
          <TabsList variant="line" className="py-0">
            {modes.map((availableMode) => (
              <TabsTrigger
                key={availableMode}
                value={availableMode}
                className="h-9 text-xs sm:text-xs"
                aria-label={`${MODE_LABELS[availableMode]} view`}
              >
                {MODE_LABELS[availableMode]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : (
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="size-4 text-muted-foreground" />
          {mode ? MODE_LABELS[mode] : "Edit output"}
        </div>
      )}
      {status ? <EditViewerStatusBadge status={status} /> : null}
    </div>
  )
}
