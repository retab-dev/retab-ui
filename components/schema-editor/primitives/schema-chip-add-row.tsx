"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SchemaAddInputModel } from "@/components/schema-editor/primitives/schema-add-input-model";

export interface SchemaChipAddRowProps {
  addInput: SchemaAddInputModel;
  editable: boolean;
}

export function SchemaChipAddRow({
  addInput,
  editable,
}: SchemaChipAddRowProps) {
  const addInputRef = React.useRef<HTMLInputElement>(null);

  const submitAddRow = () => {
    if (!addInput.value.trim()) return;
    addInput.onSubmit();
    if (addInput.focusAfterSubmit) {
      addInputRef.current?.focus();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={addInput.inputLabel}
        ref={addInputRef}
        disabled={!editable}
        placeholder={addInput.placeholder}
        value={addInput.value}
        onChange={(event) => addInput.onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            submitAddRow();
          }
        }}
        className="w-40"
      />
      <Button
        disabled={!editable || !addInput.value.trim()}
        type="button"
        variant="outline"
        size="sm"
        onClick={submitAddRow}
      >
        <PlusIcon className="mr-1 h-4 w-4" />
        {addInput.submitLabel}
      </Button>
    </div>
  );
}
