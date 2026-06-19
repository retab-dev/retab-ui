"use client";

import * as React from "react";

import { EditViewerFieldPanel } from "./edit-viewer-field-panel";

export type EditViewerFieldsViewProps = React.ComponentProps<
  typeof EditViewerFieldPanel
>;

export function EditViewerFieldsView(props: EditViewerFieldsViewProps) {
  return <EditViewerFieldPanel {...props} />;
}
