import type * as React from "react"

import type {
  DocumentNodeView,
  SchemaDocument,
} from "@/components/schema-editor/document"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type {
  ResolvedSchemaBuilderFeatures,
  SchemaDispatch,
} from "@/components/schema-editor/schema-builder-types"

export type SchemaEditorMode = "descriptionOnly" | "readOnly" | "editable"

export interface DocumentSchemaNodeEditorProps {
  dispatch: SchemaDispatch
  doc: SchemaDocument
  name: string
  nodeId: string
  nodeView: DocumentNodeView
  path: string
  canDelete?: boolean
  onDelete?: () => void
  onNameChange?: (newName: string, updatedNode?: ExtendedJSONSchema7) => void
  setDefsAccordionOpen: (open: boolean) => void
  draggedParentRef: React.RefObject<string | null>
  draggedPropertyRef: React.RefObject<string | null>
  editMode?: SchemaEditorMode
  hidePencilButton?: boolean
  isRequired?: boolean
  onRequiredChange?: (required: boolean) => void
  siblingNames?: string[]
  features?: ResolvedSchemaBuilderFeatures
}

export type RenderDocumentNodeEditor = (
  props: DocumentSchemaNodeEditorProps
) => React.ReactNode
