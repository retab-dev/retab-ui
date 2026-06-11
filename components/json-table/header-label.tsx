import {
  Box,
  Calendar,
  CalendarClock,
  CheckSquare,
  Clock,
  Hash,
  List,
  Table,
  Type,
} from "lucide-react"

const headerLabelClass =
  "flex min-w-0 flex-row items-center gap-2 overflow-hidden truncate text-xs leading-none"

function renderHeaderIcon(type: string) {
  switch (type) {
    case "string":
      return <Type className="size-3" />
    case "boolean":
      return <CheckSquare className="size-3" />
    case "number":
    case "integer":
      return <Hash className="size-3" />
    case "object":
      return <Box className="size-3" />
    case "array":
      return <Table className="size-3" />
    case "date":
      return <Calendar className="size-3" />
    case "time":
      return <Clock className="size-3" />
    case "datetime":
      return <CalendarClock className="size-3" />
    case "enum":
      return <List className="size-3" />
    case "$ref":
      return <Box className="size-3" />
    default:
      return <Type className="size-3" />
  }
}

export function HeaderLabel({
  effectiveType,
  label,
  width,
}: {
  effectiveType: string
  label: string
  width: number
}) {
  return (
    <div
      className={headerLabelClass}
      style={{
        maxWidth: `${width}px`,
        minWidth: `${width}px`,
      }}
    >
      {renderHeaderIcon(effectiveType)}
      {label}
    </div>
  )
}
