import type * as React from "react"

import type { SchemaDocument } from "@/components/schema-editor/document/types"
import type { DocumentNodeView } from "@/components/schema-editor/document/view-model"
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types"
import type {
  ResolvedSchemaBuilderFeatures,
  SchemaDispatch,
} from "@/components/schema-editor/schema-builder-types"
import type { SchemaEditorMode } from "@/components/schema-editor/schema-editor-mode"

export type { SchemaEditorMode }

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
  mode?: SchemaEditorMode
  hidePencilButton?: boolean
  isRequired?: boolean
  onRequiredChange?: (required: boolean) => void
  siblingNames?: string[]
  features?: ResolvedSchemaBuilderFeatures
}

export type RenderDocumentNodeEditor = (
  props: DocumentSchemaNodeEditorProps
) => React.ReactNode
