"use client"

import * as React from "react"
import type { JSONSchema7 } from "json-schema"
import {
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react"

import {
  addDefinition,
  addEnumValue,
  addProperty,
  getEffectiveKind,
  getEnumBaseType,
  isDanglingRef,
  isNullable,
  moveProperty,
  removeDefinition,
  removeEnumValue,
  removeProperty,
  renameDefinition,
  renameProperty,
  resolveRef,
  setNodeType,
  setNullable,
  setRef,
  setRequired,
  updateEnumValue,
  updateNode,
  type DocumentNode,
  type PropertyEntry,
  type SchemaDocument,
  type SchemaKind,
} from "@/components/schema-editor/document"
import {
  useSchemaDocument,
  type UseSchemaDocumentOptions,
} from "@/components/schema-editor/editor/use-schema-document"
import {
  ARRAY_ITEM_TYPES,
  SCALAR_TYPES,
  TYPE_META,
  type EditorType,
} from "@/components/schema-editor/editor/type-meta"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/** A single stable dispatcher threaded through the tree (extend's lifted-state
 *  pattern — no schema state in context, just the update function + live doc). */
type Update = (fn: (doc: SchemaDocument) => SchemaDocument) => void

interface NodeContext {
  doc: SchemaDocument
  update: Update
}

// ---------------------------------------------------------------------------
// Type presentation
// ---------------------------------------------------------------------------

function TypeBadge({
  kind,
  className,
}: {
  kind: SchemaKind | "ref"
  className?: string
}) {
  const meta = TYPE_META[kind] ?? TYPE_META.any
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.badge,
        className
      )}
    >
      <Icon className="size-3.5" />
      <span className="truncate">{meta.label}</span>
    </span>
  )
}

function TypeMenuItem({
  kind,
  onSelect,
}: {
  kind: SchemaKind | "ref"
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onClick={onSelect}>
      <TypeBadge kind={kind} />
    </DropdownMenuItem>
  )
}

/** Picks a node's type. Scalars + enum + object + array, plus a "Reference"
 *  submenu listing the document's definitions (sets a $ref by id). */
function TypeMenu({
  ctx,
  node,
  allowRef = true,
}: {
  ctx: NodeContext
  node: DocumentNode
  allowRef?: boolean
}) {
  const kind = getEffectiveKind(node)
  const pickType = (type: EditorType) =>
    ctx.update((d) => setNodeType(d, node.id, type as never))
  const pickRef = (defId: string) =>
    ctx.update((d) => setRef(d, node.id, defId))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-full min-w-0 justify-start overflow-hidden rounded-md px-2"
        >
          <TypeBadge kind={node.ref ? "ref" : kind} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>JSON types</DropdownMenuLabel>
          {SCALAR_TYPES.map((type) => (
            <TypeMenuItem
              key={type}
              kind={type}
              onSelect={() => pickType(type)}
            />
          ))}
          <TypeMenuItem kind="enum" onSelect={() => pickType("enum")} />
          <TypeMenuItem kind="object" onSelect={() => pickType("object")} />
          <TypeMenuItem kind="array" onSelect={() => pickType("array")} />
        </DropdownMenuGroup>
        {allowRef && ctx.doc.defs.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <TypeBadge kind="ref" />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuLabel>Definitions</DropdownMenuLabel>
                {ctx.doc.defs.map((def) => (
                  <DropdownMenuItem
                    key={def.id}
                    onClick={() => pickRef(def.id)}
                  >
                    <Link2Label name={def.name} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Link2Label({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <span className="text-muted-foreground">#/$defs/</span>
      {name}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Inline text input
// ---------------------------------------------------------------------------

function InlineInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:bg-background",
        className
      )}
      {...props}
    />
  )
}

/** Small toggle chip used for the nullable / required flags. */
function ToggleChip({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Object property table
// ---------------------------------------------------------------------------

function ObjectTable({
  ctx,
  node,
  depth,
}: {
  ctx: NodeContext
  node: DocumentNode
  depth: number
}) {
  const properties = node.properties ?? []
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)

  const handleDrop = (index: number) => {
    if (dragId) ctx.update((d) => moveProperty(d, dragId, node.id, index))
    setDragId(null)
    setOverIndex(null)
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/55 text-xs text-muted-foreground">
            <th className="w-[26%] px-3 py-2 text-left font-medium">
              Property key
            </th>
            <th className="w-[30%] border-l px-3 py-2 text-left font-medium">
              Type
            </th>
            <th className="border-l px-3 py-2 text-left font-medium">
              Description
            </th>
            <th className="w-9 border-l" />
          </tr>
        </thead>
        <tbody>
          {properties.map((entry, index) => (
            <PropertyRow
              key={entry.node.id}
              ctx={ctx}
              parentId={node.id}
              entry={entry}
              index={index}
              depth={depth}
              isDragTarget={overIndex === index}
              onDragStart={() => setDragId(entry.node.id)}
              onDragOver={() => setOverIndex(index)}
              onDrop={() => handleDrop(index)}
            />
          ))}
          <tr>
            <td colSpan={4} className="p-0">
              <button
                type="button"
                className="flex h-9 w-full items-center justify-center gap-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/55 hover:text-foreground"
                onClick={() => ctx.update((d) => addProperty(d, node.id))}
              >
                <Plus className="size-4" />
                Add property
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function PropertyRow({
  ctx,
  parentId,
  entry,
  index,
  depth,
  isDragTarget,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  ctx: NodeContext
  parentId: string
  entry: PropertyEntry
  index: number
  depth: number
  isDragTarget: boolean
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
}) {
  const node = entry.node
  const nested = hasNestedEditor(node)
  const [open, setOpen] = React.useState(true)
  const dangling = isDanglingRef(ctx.doc, node)

  return (
    <>
      <tr
        className={cn(
          "group/row border-b",
          nested && "bg-muted/20",
          isDragTarget && "outline outline-1 outline-primary/40"
        )}
        onDragOver={(e) => {
          e.preventDefault()
          onDragOver()
        }}
        onDrop={(e) => {
          e.preventDefault()
          onDrop()
        }}
      >
        <td className="relative p-0 align-top">
          <div className="flex items-center">
            <span
              draggable
              onDragStart={onDragStart}
              className="grid size-6 shrink-0 cursor-grab place-items-center text-muted-foreground/50 opacity-0 transition-opacity group-hover/row:opacity-100 active:cursor-grabbing"
              aria-label="Drag to reorder"
            >
              <GripVertical className="size-3.5" />
            </span>
            <InlineInput
              value={entry.key}
              placeholder={depth ? "nested_key" : "property_key"}
              spellCheck={false}
              className="font-mono"
              onChange={(e) =>
                ctx.update((d) => renameProperty(d, node.id, e.target.value))
              }
            />
          </div>
        </td>
        <td className="border-l p-1 align-top">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <TypeMenu ctx={ctx} node={node} />
            </div>
            <ToggleChip
              active={isNullable(node)}
              title="Nullable"
              onClick={() =>
                ctx.update((d) => setNullable(d, node.id, !isNullable(node)))
              }
            >
              ?
            </ToggleChip>
            <ToggleChip
              active={entry.required}
              title="Required"
              onClick={() =>
                ctx.update((d) =>
                  setRequired(d, node.id, !entry.required)
                )
              }
            >
              req
            </ToggleChip>
          </div>
          {dangling ? (
            <p className="px-2 pt-1 text-[10px] text-destructive">
              Reference target was deleted.
            </p>
          ) : null}
        </td>
        <td className="border-l p-0 align-top">
          <InlineInput
            value={node.description ?? ""}
            placeholder="Describe what this field should extract."
            onChange={(e) =>
              ctx.update((d) =>
                updateNode(d, node.id, (n) => ({
                  ...n,
                  description: e.target.value,
                }))
              )
            }
          />
        </td>
        <td className="border-l p-0 align-top">
          <button
            type="button"
            aria-label="Delete property"
            className="grid size-9 place-items-center text-muted-foreground/60 outline-none transition-colors hover:text-destructive"
            onClick={() => ctx.update((d) => removeProperty(d, node.id))}
          >
            <Trash2 className="size-4" />
          </button>
        </td>
      </tr>
      {nested ? (
        <tr className="border-b bg-muted/20">
          <td colSpan={4} className="p-0">
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger className="flex h-8 w-full items-center gap-2 px-3 text-left text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground">
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 transition-transform",
                    !open && "-rotate-90"
                  )}
                />
                <span className="truncate">{nestedLabel(node, entry.key)}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div
                  className="p-2"
                  style={{
                    paddingLeft: `${0.5 + Math.min(depth, 4) * 0.75}rem`,
                  }}
                >
                  <NestedEditor ctx={ctx} node={node} depth={depth} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </td>
        </tr>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------------------
// Nested editors (object / array / enum)
// ---------------------------------------------------------------------------

function hasNestedEditor(node: DocumentNode): boolean {
  if (node.ref) return false
  const kind = getEffectiveKind(node)
  return kind === "object" || kind === "array" || kind === "enum"
}

function nestedLabel(node: DocumentNode, key: string): string {
  const kind = getEffectiveKind(node)
  const what = kind === "enum" ? "Configure enum" : "Configure schema"
  return `${what} for ${key || "property"}`
}

function NestedEditor({
  ctx,
  node,
  depth,
}: {
  ctx: NodeContext
  node: DocumentNode
  depth: number
}) {
  const kind = getEffectiveKind(node)

  if (kind === "enum") {
    return <EnumEditor ctx={ctx} node={node} />
  }
  if (kind === "object") {
    return <ObjectTable ctx={ctx} node={node} depth={depth + 1} />
  }
  if (kind === "array") {
    return <ArrayItemsEditor ctx={ctx} node={node} depth={depth} />
  }
  return null
}

function ArrayItemsEditor({
  ctx,
  node,
  depth,
}: {
  ctx: NodeContext
  node: DocumentNode
  depth: number
}) {
  const items = node.items
  if (!items) return null
  const itemKind = getEffectiveKind(items)

  // The item node is reachable from the root via `updateNode` (it recurses into
  // `items`), so we can re-type it by id directly.
  const setItemType = (type: EditorType) =>
    ctx.update((d) => setNodeType(d, items.id, type as never))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Items
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2">
              <TypeBadge kind={items.ref ? "ref" : itemKind} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Item type</DropdownMenuLabel>
            {ARRAY_ITEM_TYPES.filter((t) => t !== "ref").map((type) => (
              <TypeMenuItem
                key={type}
                kind={type as SchemaKind}
                onSelect={() => setItemType(type)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {itemKind === "object" ? (
        <ObjectTable ctx={ctx} node={items} depth={depth + 1} />
      ) : itemKind === "enum" ? (
        <EnumEditor ctx={ctx} node={items} />
      ) : null}
    </div>
  )
}

function EnumEditor({ ctx, node }: { ctx: NodeContext; node: DocumentNode }) {
  const values = node.enum ?? []
  const baseType = getEnumBaseType(node)

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/55 text-xs text-muted-foreground">
            <th className="w-[34%] px-3 py-2 text-left font-medium">Value</th>
            <th className="border-l px-3 py-2 text-left font-medium">
              Description
            </th>
            <th className="w-9 border-l" />
          </tr>
        </thead>
        <tbody>
          {values.map((value) => (
            <tr key={value.id} className="border-b">
              <td className="p-0 align-top">
                <InlineInput
                  value={String(value.value ?? "")}
                  placeholder={baseType === "string" ? "approved" : "1"}
                  className="font-mono"
                  onChange={(e) =>
                    ctx.update((d) =>
                      updateEnumValue(d, node.id, value.id, {
                        value: coerceEnum(e.target.value, baseType),
                      })
                    )
                  }
                />
              </td>
              <td className="border-l p-0 align-top">
                <InlineInput
                  value={value.description ?? ""}
                  placeholder="When the reviewer accepts this value."
                  onChange={(e) =>
                    ctx.update((d) =>
                      updateEnumValue(d, node.id, value.id, {
                        description: e.target.value,
                      })
                    )
                  }
                />
              </td>
              <td className="border-l p-0 align-top">
                <button
                  type="button"
                  aria-label="Delete enum value"
                  className="grid size-9 place-items-center text-muted-foreground/60 transition-colors hover:text-destructive"
                  onClick={() =>
                    ctx.update((d) => removeEnumValue(d, node.id, value.id))
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="p-0">
              <button
                type="button"
                className="flex h-9 w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:bg-muted/55 hover:text-foreground"
                onClick={() => ctx.update((d) => addEnumValue(d, node.id))}
              >
                <Plus className="size-4" />
                Add enum value
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function coerceEnum(raw: string, baseType: string) {
  if (baseType === "number" || baseType === "integer") {
    const n = Number(raw)
    return raw.trim() === "" || Number.isNaN(n) ? raw : n
  }
  if (baseType === "boolean") return raw === "true"
  return raw
}

// ---------------------------------------------------------------------------
// Definitions ($defs) section
// ---------------------------------------------------------------------------

function DefinitionsSection({ ctx }: { ctx: NodeContext }) {
  const { defs } = ctx.doc
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Definitions
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5"
          onClick={() => ctx.update((d) => addDefinition(d).doc)}
        >
          <Plus className="size-3.5" />
          Add definition
        </Button>
      </div>
      {defs.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Reusable subschemas. Add one, then pick{" "}
          <span className="font-medium">Ref</span> as a property type to point at
          it. References survive renames.
        </p>
      ) : (
        defs.map((def) => (
          <Collapsible
            key={def.id}
            defaultOpen
            className="rounded-lg border bg-background"
          >
            <div className="flex items-center gap-2 border-b px-2 py-1.5">
              <CollapsibleTrigger className="text-muted-foreground hover:text-foreground">
                <ChevronDown className="size-4" />
              </CollapsibleTrigger>
              <span className="font-mono text-xs text-muted-foreground">
                #/$defs/
              </span>
              <InlineInput
                value={def.name}
                spellCheck={false}
                className="h-7 flex-1 font-mono"
                onChange={(e) =>
                  ctx.update((d) =>
                    renameDefinition(d, def.id, e.target.value)
                  )
                }
              />
              <div className="w-40 shrink-0">
                <TypeMenu ctx={ctx} node={def.node} allowRef={false} />
              </div>
              <button
                type="button"
                aria-label="Delete definition"
                className="grid size-7 place-items-center text-muted-foreground/60 transition-colors hover:text-destructive"
                onClick={() => ctx.update((d) => removeDefinition(d, def.id))}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <CollapsibleContent>
              <div className="p-2">
                {hasNestedEditor(def.node) ? (
                  <NestedEditor ctx={ctx} node={def.node} depth={0} />
                ) : (
                  <p className="px-1 py-2 text-xs text-muted-foreground">
                    {TYPE_META[getEffectiveKind(def.node)]?.label} definition.
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface SchemaBuilderProps extends UseSchemaDocumentOptions {
  className?: string
}

/**
 * Vanilla-`JSONSchema7` schema editor built on the Document model. Controlled or
 * uncontrolled via `value` / `defaultValue` + `onValueChange`; identity-stable,
 * lossless, with editable `$defs`/`$ref`.
 */
export function SchemaBuilder({
  className,
  ...options
}: SchemaBuilderProps) {
  const controller = useSchemaDocument(options)
  const ctx: NodeContext = { doc: controller.doc, update: controller.update }

  return (
    <Tabs
      defaultValue="form"
      className={cn("flex flex-col gap-0 bg-background", className)}
      data-slot="schema-builder"
    >
      <div className="flex min-h-12 items-center justify-between border-b px-3">
        <TabsList className="h-8">
          <TabsTrigger value="form" className="h-7">
            Form
          </TabsTrigger>
          <TabsTrigger value="json" className="h-7">
            JSON
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="form" className="space-y-4 p-3">
        <ObjectTable ctx={ctx} node={controller.doc.root} depth={0} />
        <DefinitionsSection ctx={ctx} />
      </TabsContent>
      <TabsContent value="json" className="p-0">
        <pre className="max-h-[560px] overflow-auto bg-muted/40 p-4 font-mono text-xs">
          {JSON.stringify(controller.schema, null, 2)}
        </pre>
      </TabsContent>
    </Tabs>
  )
}

export type { JSONSchema7 }
