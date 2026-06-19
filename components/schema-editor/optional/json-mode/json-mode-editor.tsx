"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";

import type { ExtendedJSONSchema7 } from "@/components/schema-editor/schema-builder-types";
import { Button } from "@/components/ui/button";

type JsonModeState =
  | { status: "synced"; text: string }
  | { status: "dirty-valid"; text: string; parsed: ExtendedJSONSchema7 }
  | { status: "dirty-invalid"; text: string; error: string };

export function JsonModeEditor({
  schema,
  readOnly,
  replaceSchema,
}: {
  schema: ExtendedJSONSchema7;
  readOnly: boolean;
  replaceSchema: (schema: ExtendedJSONSchema7) => void | Promise<void>;
}) {
  const schemaText = React.useMemo(
    () => JSON.stringify(schema, null, 2),
    [schema],
  );
  const [jsonState, setJsonState] = React.useState<JsonModeState>({
    status: "synced",
    text: schemaText,
  });

  React.useEffect(() => {
    setJsonState((current) =>
      current.status === "synced"
        ? { status: "synced", text: schemaText }
        : current,
    );
  }, [schemaText]);

  const handleJsonChange = React.useCallback((text: string) => {
    try {
      const parsed = JSON.parse(text) as ExtendedJSONSchema7;
      setJsonState({ status: "dirty-valid", text, parsed });
    } catch (error) {
      setJsonState({
        status: "dirty-invalid",
        text,
        error: error instanceof Error ? error.message : "Invalid JSON",
      });
    }
  }, []);

  const applyJson = React.useCallback(() => {
    if (readOnly || jsonState.status !== "dirty-valid") return;
    void replaceSchema(jsonState.parsed);
    setJsonState({
      status: "synced",
      text: JSON.stringify(jsonState.parsed, null, 2),
    });
  }, [jsonState, readOnly, replaceSchema]);

  const discardJson = React.useCallback(() => {
    setJsonState({ status: "synced", text: schemaText });
  }, [schemaText]);

  return (
    <div className="flex min-h-[420px] flex-col gap-3">
      <textarea
        spellCheck={false}
        readOnly={readOnly}
        className="bg-muted/30 focus-visible:ring-ring min-h-0 flex-1 resize-none overflow-auto rounded-lg border p-3 font-mono text-xs outline-none focus-visible:ring-2"
        value={jsonState.text}
        onChange={(event) => handleJsonChange(event.target.value)}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-destructive min-h-5 text-sm">
          {jsonState.status === "dirty-invalid" ? jsonState.error : null}
        </p>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={discardJson}
              disabled={jsonState.status === "synced"}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={applyJson}
              disabled={jsonState.status !== "dirty-valid"}
            >
              Apply
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
