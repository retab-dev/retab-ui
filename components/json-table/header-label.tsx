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
  "flex min-w-0 max-w-full flex-row items-center gap-2 overflow-hidden text-xs leading-none"
const headerIconClass = "size-3 shrink-0 !mx-0 overflow-visible"

function renderHeaderIcon(type: string) {
  switch (type) {
    case "string":
      return <Type className={headerIconClass} />
    case "boolean":
      return <CheckSquare className={headerIconClass} />
    case "number":
    case "integer":
      return <Hash className={headerIconClass} />
    case "object":
      return <Box className={headerIconClass} />
    case "array":
      return <Table className={headerIconClass} />
    case "date":
      return <Calendar className={headerIconClass} />
    case "time":
      return <Clock className={headerIconClass} />
    case "datetime":
      return <CalendarClock className={headerIconClass} />
    case "enum":
      return <List className={headerIconClass} />
    case "$ref":
      return <Box className={headerIconClass} />
    default:
      return <Type className={headerIconClass} />
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
      <span className="min-w-0 truncate">{label}</span>
    </div>
  )
}
