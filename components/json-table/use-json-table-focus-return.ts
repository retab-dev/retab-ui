import * as React from "react";

import type {
  JsonTablePrimitiveActiveCell,
  JsonTableStructuredEditSession,
} from "@/components/json-table/json-table-edit-session";
import { useKeyedLayoutEffect } from "@/hooks/use-keyed-layout-effect";
import { joinEffectKey } from "@/lib/effect-key";

function jsonTableFocusReturnTarget(shell: HTMLTableCellElement | null) {
  return shell?.querySelector<HTMLElement>('[data-slot="data-cell"]') ?? shell;
}

export function useJsonTableFocusReturn({
  shellRef,
  isCellEditing,
  primitiveActiveCell,
  structuredEditSession,
}: {
  shellRef: React.RefObject<HTMLTableCellElement | null>;
  isCellEditing: boolean;
  primitiveActiveCell: JsonTablePrimitiveActiveCell | null;
  structuredEditSession: JsonTableStructuredEditSession | null;
}) {
  const wasEditingRef = React.useRef(isCellEditing);

  useKeyedLayoutEffect(
    joinEffectKey([
      isCellEditing,
      primitiveActiveCell,
      shellRef,
      structuredEditSession,
    ]),
    () => {
      if (
        wasEditingRef.current &&
        !isCellEditing &&
        !primitiveActiveCell &&
        !structuredEditSession
      ) {
        jsonTableFocusReturnTarget(shellRef.current)?.focus({
          preventScroll: true,
        });
      }
      wasEditingRef.current = isCellEditing;
    },
  );
}
