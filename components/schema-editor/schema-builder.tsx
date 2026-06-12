"use client";

import * as React from "react";

import { DocumentSchemaEditor } from "@/components/schema-editor/document-schema-editor";
import type {
  ExtendedJSONSchema7,
  SchemaBuilderProps,
  SchemaBuilderView,
} from "@/components/schema-editor/schema-builder-types";
import { resolveSchemaBuilderFeatures } from "@/components/schema-editor/schema-builder-types";
import { useSchemaBuilderState } from "@/components/schema-editor/use-schema-builder-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LazyJsonModeEditor = React.lazy(() =>
  import("@/components/schema-editor/optional/json-mode/json-mode-editor").then(
    (module) => ({
      default: module.JsonModeEditor,
    }),
  ),
);

export function SchemaBuilder({
  value,
  onValueChange,
  className,
  readOnly = false,
  view,
  onViewChange,
  features,
}: SchemaBuilderProps) {
  const resolvedFeatures = React.useMemo(
    () => resolveSchemaBuilderFeatures(features),
    [features],
  );
  const state = useSchemaBuilderState({
    value,
    onValueChange,
    readOnly,
  });
  const [internalView, setInternalView] =
    React.useState<SchemaBuilderView>("fields");
  const activeView = resolvedFeatures.jsonMode
    ? (view ?? internalView)
    : "fields";

  const setView = React.useCallback(
    (nextView: SchemaBuilderView) => {
      if (nextView === "json" && !resolvedFeatures.jsonMode) return;
      setInternalView(nextView);
      onViewChange?.(nextView);
    },
    [onViewChange, resolvedFeatures.jsonMode],
  );

  return (
    <div data-slot="schema-builder" className={cn("w-full", className)}>
      {resolvedFeatures.jsonMode && (
        <div className="mb-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={activeView === "fields" ? "secondary" : "ghost"}
            onClick={() => setView("fields")}
          >
            Fields
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeView === "json" ? "secondary" : "ghost"}
            onClick={() => setView("json")}
          >
            JSON
          </Button>
        </div>
      )}

      {activeView === "json" ? (
        <React.Suspense fallback={null}>
          <LazyJsonModeEditor
            schema={state.schema}
            readOnly={readOnly}
            replaceSchema={state.replaceSchema}
          />
        </React.Suspense>
      ) : (
        <DocumentSchemaEditor
          doc={state.doc}
          schema={state.schema}
          validation={state.validation}
          dispatch={state.dispatch}
          editMode={readOnly ? "readOnly" : "editable"}
          features={resolvedFeatures}
        />
      )}
    </div>
  );
}

export type {
  ExtendedJSONSchema7,
  SchemaBuilderFeatures,
  SchemaBuilderProps,
  SchemaBuilderView,
} from "@/components/schema-editor/schema-builder-types";
