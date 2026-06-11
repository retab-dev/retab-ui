import {
  Asterisk,
  Braces,
  Brackets,
  Hash,
  Link2,
  List,
  ToggleLeft,
  Type,
  CircleSlash,
  type LucideIcon,
} from "lucide-react"

import type { SchemaKind } from "@/components/schema-editor/document"

/** The picker-level type a user chooses (scalars + the modeled compound kinds). */
export type EditorType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null"
  | "enum"
  | "object"
  | "array"
  | "ref"

export const SCALAR_TYPES: EditorType[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "null",
]

/** Item types valid inside an array (no nested array for v1). */
export const ARRAY_ITEM_TYPES: EditorType[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "object",
  "enum",
  "ref",
]

export const TYPE_META: Record<
  SchemaKind | "ref",
  { label: string; icon: LucideIcon; badge: string }
> = {
  string: {
    label: "String",
    icon: Type,
    badge: "bg-blue-50 text-blue-600 dark:bg-blue-300/10 dark:text-blue-300",
  },
  number: {
    label: "Number",
    icon: Hash,
    badge:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-300/10 dark:text-emerald-300",
  },
  integer: {
    label: "Integer",
    icon: Hash,
    badge: "bg-teal-50 text-teal-600 dark:bg-teal-300/10 dark:text-teal-300",
  },
  boolean: {
    label: "Boolean",
    icon: ToggleLeft,
    badge: "bg-amber-50 text-amber-600 dark:bg-amber-300/10 dark:text-amber-300",
  },
  null: {
    label: "Null",
    icon: CircleSlash,
    badge: "bg-zinc-50 text-zinc-600 dark:bg-zinc-300/10 dark:text-zinc-300",
  },
  object: {
    label: "Object",
    icon: Braces,
    badge:
      "bg-violet-50 text-violet-600 dark:bg-violet-300/10 dark:text-violet-300",
  },
  array: {
    label: "Array",
    icon: Brackets,
    badge: "bg-cyan-50 text-cyan-600 dark:bg-cyan-300/10 dark:text-cyan-300",
  },
  enum: {
    label: "Enum",
    icon: List,
    badge: "bg-rose-50 text-rose-600 dark:bg-rose-300/10 dark:text-rose-300",
  },
  ref: {
    label: "Ref",
    icon: Link2,
    badge:
      "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-300/10 dark:text-fuchsia-300",
  },
  union: {
    label: "Union",
    icon: Asterisk,
    badge: "bg-slate-50 text-slate-600 dark:bg-slate-300/10 dark:text-slate-300",
  },
  any: {
    label: "Any",
    icon: Asterisk,
    badge: "bg-slate-50 text-slate-600 dark:bg-slate-300/10 dark:text-slate-300",
  },
}

export const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_META).map(([key, meta]) => [key, meta.label])
)
