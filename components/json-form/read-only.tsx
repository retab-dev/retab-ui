"use client";

import * as React from "react";

/**
 * Read-only mode for a whole form subtree.
 *
 * Viewer surfaces mount the form purely to display a result: nothing there is
 * submitted, so an editable control silently discards whatever the user types.
 * Read-only mode keeps the same layout, labels, and source links, but makes
 * every control inert — scalars render with the native `readOnly` flag (still
 * selectable and copyable), controls with no native read-only state are
 * disabled, and the array add/remove affordances disappear entirely.
 */
const JsonFormReadOnlyContext = React.createContext(false);

export function JsonFormReadOnlyProvider({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  return (
    <JsonFormReadOnlyContext.Provider value={readOnly}>
      {children}
    </JsonFormReadOnlyContext.Provider>
  );
}

export function useJsonFormReadOnly(): boolean {
  return React.useContext(JsonFormReadOnlyContext);
}
