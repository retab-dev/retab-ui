"use client"

import * as React from "react"

import { EditViewerFieldPanel } from "./edit-viewer-field-panel"
import { useEditViewerFields } from "./edit-viewer-provider"

export type EditViewerFieldsProps = React.ComponentProps<"div">

export function EditViewerFields(props: EditViewerFieldsProps) {
  const fields = useEditViewerFields()

  return (
    <EditViewerFieldPanel
      {...props}
      fieldGroups={fields.fieldGroups}
      fieldCount={fields.fieldCount}
      filledCount={fields.filledCount}
      visibleFieldCount={fields.visibleFieldCount}
      effectiveFieldKey={fields.activeFieldKey}
      selectedFieldKey={fields.selectedFieldKey}
      query={fields.query}
      onQueryChange={fields.setQuery}
      filter={fields.filter}
      onFilterChange={fields.setFilter}
      onFieldHover={fields.previewField}
      onFieldSelect={fields.selectField}
      showSearch={fields.canSearch}
      showFilters={fields.canFilter}
    />
  )
}
