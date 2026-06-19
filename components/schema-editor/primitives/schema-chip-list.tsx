"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface SchemaChipItem {
  id: string;
  inputLabel: string;
  removeLabel: string;
  value: string;
}

export interface SchemaChipListProps {
  editable: boolean;
  items: SchemaChipItem[];
  onRemove: (id: string) => void;
  onReplace: (id: string, value: string) => void;
}

export function SchemaChipList({
  editable,
  items,
  onRemove,
  onReplace,
}: SchemaChipListProps) {
  return (
    <div data-slot="schema-chip-list" className="space-y-2">
      {items.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {items.map((item) => {
            return (
              <div
                key={item.id}
                data-slot="schema-chip"
                className="border-border bg-muted flex items-center gap-1 rounded-md border px-1 shadow-none"
              >
                <input
                  aria-label={item.inputLabel}
                  data-slot="schema-chip-input"
                  disabled={!editable}
                  value={item.value}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    onReplace(item.id, event.target.value);
                  }}
                  onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                    }
                  }}
                  className="h-6 w-24 min-w-0 rounded-[inherit] border-0 bg-transparent px-1 text-sm leading-6 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-64"
                />
                <Button
                  type="button"
                  disabled={!editable}
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-sm border-0 bg-transparent p-0 shadow-none hover:bg-transparent data-pressed:bg-transparent"
                  aria-label={item.removeLabel}
                  onClick={() => onRemove(item.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
