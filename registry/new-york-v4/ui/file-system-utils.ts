import { formatFileSize } from "@/components/ui/file-size-format"

export function formatFileSystemSize(size: number | undefined) {
  return typeof size === "number" ? formatFileSize(size) : ""
}

export function formatFileSystemDate(value: string | undefined) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
