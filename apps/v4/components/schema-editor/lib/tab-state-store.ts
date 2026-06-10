// Decoupled from the dashboard. In the dashboard a Zustand store tracks which
// schema field is selected in a table view, so the editor can open the $defs
// accordion for it. The standalone editor has no external selection, so this is
// a no-op that keeps the original code path intact.
export function useTabStateStore(): { selectedFieldPath: string | null } {
  return { selectedFieldPath: null }
}
