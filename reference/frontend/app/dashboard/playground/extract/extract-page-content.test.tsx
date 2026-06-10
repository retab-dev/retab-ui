import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const source = readFileSync(
  new URL("./extract-page-content.tsx", import.meta.url),
  "utf8",
);
const historyDialogSource = readFileSync(
  new URL("./components/history-dialog.tsx", import.meta.url),
  "utf8",
);

describe("extract page content source", () => {
  test("does not use a top-level useEffect to mirror config into persisted state", () => {
    expect(source).not.toContain("useEffect(() => {");
    expect(source).not.toContain("useState, useCallback, useEffect");
  });

  test("guards URL history hydration so the same extraction id is only applied once", () => {
    expect(source).toContain("loadedUrlExtractionIdRef");
    expect(source).toContain("handleUrlExtractionLoad");
    expect(source).toContain(
      "loadedUrlExtractionIdRef.current === extraction.id",
    );
    expect(source).not.toContain("onLoad={handleHistorySelection}");
  });

  test("memoizes the header slot so Radix trigger refs are stable during history hydration", () => {
    expect(source).toContain("const headerSlot = useMemo(");
    expect(source).toContain("<SubscriptionPopover />");
    expect(source).toContain("handleShowHistoryDialog,");
  });

  test("opens history without invalidating the active extraction detail", () => {
    expect(source).not.toContain("useInvalidateExtractions");
    expect(source).not.toContain("invalidateExtractions.all()");
    expect(source).toContain(
      "const handleShowHistoryDialog = useCallback(() => {",
    );
    expect(source).toContain("setShowHistoryDialog(true)");
  });

  test("keeps the history dialog mounted without fetching while closed", () => {
    expect(source).toContain(
      'import { HistoryDialog } from "@/app/dashboard/playground/extract/components/history-dialog"',
    );
    expect(source).not.toContain("const HistoryDialog = dynamic(");
    expect(source).toContain("open={showHistoryDialog}");
    expect(source).not.toContain(
      "{showHistoryDialog && (\n                <HistoryDialog",
    );
    expect(source).not.toContain("open={true}");
    expect(historyDialogSource).toContain("enabled: open === true");
    expect(historyDialogSource).toContain("HistoryDialog render");
  });

  test("loads history entries through a keyed playground session", () => {
    expect(source).toContain("type ExtractPlaygroundSession = {");
    expect(source).toMatch(
      /const\s+\[\s*playgroundSession,\s*setPlaygroundSession\s*\]\s*=\s*useState/,
    );
    expect(source).toContain("key={playgroundSession.key}");
    expect(source).toContain(
      "initialInputStates={playgroundSession.initialInputStates}",
    );
    expect(source).toContain("initialResult={playgroundSession.initialResult}");
    expect(source).toContain("setPlaygroundSession({");
    expect(source).not.toContain(
      "const [initialInputStates, setInitialInputStates]",
    );
    expect(source).not.toContain("const [initialResult, setInitialResult]");
    expect(source).not.toContain("setInitialInputStates([inputState])");
    expect(source).not.toContain("setInitialResult(result)");
  });

  test("applies history selections atomically after file hydration", () => {
    expect(source).toContain("const historySelectionRequestRef = useRef(0)");
    expect(source).toContain(
      "const requestId = historySelectionRequestRef.current + 1",
    );
    expect(source).toContain("historySelectionRequestRef.current = requestId");
    expect(source).toContain("history selection skipped stale request");
    expect(source).toContain(
      "if (historySelectionRequestRef.current !== requestId) {",
    );
    expect(source).toContain("let successMessage =");
    expect(source).toContain("toast.success(successMessage)");

    const staleGuardIndex = source.indexOf(
      "if (historySelectionRequestRef.current !== requestId) {",
    );
    const applySchemaIndex = source.indexOf(
      'logExtractFlow("history selection apply schema"',
    );
    const applyConfigIndex = source.indexOf(
      'logExtractFlow("history selection apply config"',
    );
    const sessionIndex = source.indexOf("setPlaygroundSession({");

    expect(staleGuardIndex).toBeGreaterThan(-1);
    expect(applySchemaIndex).toBeGreaterThan(staleGuardIndex);
    expect(applyConfigIndex).toBeGreaterThan(staleGuardIndex);
    expect(sessionIndex).toBeGreaterThan(applyConfigIndex);
  });
});
