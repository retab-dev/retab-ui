import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const parseSource = readFileSync(
  new URL("./parse-playground.tsx", import.meta.url),
  "utf8",
);
const partitionSource = readFileSync(
  new URL("./partition-playground.tsx", import.meta.url),
  "utf8",
);
const executeSource = readFileSync(
  new URL("./execute-playground.tsx", import.meta.url),
  "utf8",
);
const extractSource = readFileSync(
  new URL("./extract-playground.tsx", import.meta.url),
  "utf8",
);
const agentEditSource = readFileSync(
  new URL("./agent-edit-playground.tsx", import.meta.url),
  "utf8",
);
const templateEditSource = readFileSync(
  new URL("./template-edit-playground.tsx", import.meta.url),
  "utf8",
);
const editPageSource = readFileSync(
  new URL("../../../../playground/edit/edit-page-content.tsx", import.meta.url),
  "utf8",
);

describe("playground reset patterns", () => {
  test("keeps parse output controls aligned without a duplicate title header", () => {
    expect(executeSource).toContain("const primitiveViewerHeaderAccessory =");
    expect(executeSource).toContain('blockType === "parse" && hasOutput');
    expect(executeSource).toContain("<AnimatedTabs");
    expect(executeSource).toContain(
      "accessory={primitiveViewerHeaderAccessory}",
    );
    expect(parseSource).toContain('aria-label="Previous page"');
    expect(parseSource).toContain('aria-label="Next page"');
    expect(parseSource).toContain(
      "Page {currentPage + 1} / {resolvedPages.length}",
    );
    expect(parseSource).toContain(
      'className="absolute top-4 right-4 z-20 flex items-center gap-1"',
    );
    expect(parseSource).not.toContain("<AnimatedTabs");
    expect(parseSource).not.toContain("Parsed Output");
    expect(parseSource).not.toContain("Copy page");
    expect(parseSource).not.toContain("handleCopy");
    expect(parseSource).not.toContain("handleDownload");
    expect(parseSource).not.toContain(
      'className="flex min-h-[52px] flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4"',
    );
    expect(parseSource).not.toContain(
      "items-center justify-center gap-2 border-b border-gray-100 bg-gray-50/50",
    );
  });

  test("keeps extract output controls without a duplicate title header", () => {
    expect(extractSource).toContain(
      'className="flex min-h-[52px] flex-shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4"',
    );
    expect(extractSource).not.toContain("Extracted Output");
  });

  test("keeps partition output body without a duplicate result header", () => {
    expect(partitionSource).toContain("<PartitionWaterfall");
    expect(partitionSource).not.toContain("Partition Result");
    expect(partitionSource).not.toContain("No chunks yet");
    expect(partitionSource).not.toContain("handleCopyToClipboard");
    expect(partitionSource).not.toContain("handleDownload");
  });

  test("keeps edit downloads in the shared primitive menu only", () => {
    expect(executeSource).toContain('blockType === "edit"');
    expect(executeSource).toContain("getEditPrimitiveViewerState");
    expect(executeSource).toContain('label: "Original"');
    expect(executeSource).toContain('label: "Filled"');
    expect(executeSource).toContain('label: "Template"');
    expect(agentEditSource).not.toContain("<AnimatedTabs");
    expect(agentEditSource).not.toContain("handleDownload");
    expect(agentEditSource).not.toContain("Download original document");
    expect(agentEditSource).not.toContain("Download filled document");
    expect(agentEditSource).not.toContain("border-b border-gray-100");
    expect(templateEditSource).not.toContain("Template Edit Output");
    expect(templateEditSource).not.toContain("No output yet");
    expect(templateEditSource).not.toContain("Download editable template");
    expect(templateEditSource).not.toContain("Download filled document");
    expect(templateEditSource).not.toContain("border-b border-gray-100");
  });

  test("bridges selected template preview data into template edit outputs", () => {
    expect(templateEditSource).toContain(
      "export interface TemplateEditTemplatePreviewState",
    );
    expect(templateEditSource).toContain("onTemplatePreviewChange?:");
    expect(templateEditSource).toContain("onTemplatePreviewChange?.(null);");
    expect(templateEditSource).toContain("onTemplatePreviewChange?.({");
    expect(templateEditSource).toContain(
      "async function fetchTemplateEmptyFormBuffer(",
    );
    expect(templateEditSource).toContain(
      "`/v1/edits/templates/${templateId}/empty-form`",
    );
    expect(templateEditSource).toContain(
      "templatePdfBuffer: emptyTemplateBuffer || buffer,",
    );
    expect(templateEditSource).toContain("templateFields,");
    expect(templateEditSource).toContain("createTemplateEditSections({");
    expect(templateEditSource).toContain(
      "onTemplatePreviewChange: setSelectedTemplatePreview",
    );
    expect(templateEditSource).toContain(
      "selectedTemplatePreview?.templatePdfBuffer",
    );
    expect(templateEditSource).toContain("const runResult = externalOnRun");
    expect(templateEditSource).toContain(
      "runResult.templatePdfBuffer || fallbackTemplatePdfBuffer",
    );
    expect(templateEditSource).toContain(
      "const runResult = await runHandler(inputStates, cfg);",
    );
    expect(templateEditSource).toContain("renderOutput={renderOutput}");
    expect(templateEditSource).not.toContain(
      "renderOutput={TemplateEditOutputRenderer}",
    );
  });

  test("keeps agent edit template view backed by the original document buffer", () => {
    expect(agentEditSource).toContain(
      "originalBuffer: documentState.fileBuffer,",
    );
    expect(agentEditSource).toContain(
      "editResult?.originalBuffer || documentInput?.fileBuffer || null",
    );
    expect(agentEditSource).toContain(
      "options?: PlaygroundOutputRenderOptions,",
    );
    expect(editPageSource).toMatch(
      /outputState\.originalBuffer \|\|\s*playgroundSession\.currentFile\?\.buffer \|\|\s*null/,
    );
    expect(editPageSource).toContain(
      "originalBuffer: playgroundSession.currentFile?.buffer || null,",
    );
    expect(editPageSource).toContain(
      "AgentEditOutputRenderer(\n        mergedResult,\n        inputStates,\n        isProcessing,\n        renderOptions,",
    );
  });

  test("hydrates history-loaded template edits with template preview data for tabs", () => {
    expect(editPageSource).toContain(
      "async function fetchTemplateEditPreviewForHistory(",
    );
    expect(editPageSource).toContain(
      "async function fetchTemplateEmptyFormBufferForHistory(",
    );
    expect(editPageSource).toContain(
      '"/v1/edits/templates/{template_id}/empty-form"',
    );
    expect(editPageSource).toContain(
      "const templatePreview = await fetchTemplateEditPreviewForHistory(",
    );
    expect(editPageSource).toContain(
      "templatePdfBuffer: templatePreview?.templatePdfBuffer ?? null,",
    );
    expect(editPageSource).toContain(
      "templateFields: templatePreview?.templateFields ?? [],",
    );
    expect(editPageSource).toContain(
      "renderOptions?: PlaygroundOutputRenderOptions,",
    );
    expect(editPageSource).toContain(
      "TemplateEditOutputRenderer(\n        mergedResult,\n        inputStates,\n        isProcessing,\n        renderOptions,",
    );
    expect(editPageSource).not.toContain(
      "templatePdfBuffer: null,\n              templateFields: [],",
    );
  });

  test("resets parse and partition output viewers through keyed bodies", () => {
    expect(parseSource).toContain(
      'const parseViewerKey = `${parseResult?.document?.id ?? "empty"}\\u0000${resolvedPages.length}\\u0000${resolvedText.length}\\u0000${resolvedFilePreview ? "file" : "no-file"}`;',
    );
    expect(parseSource).toContain("<ParseOutputRendererContent");
    expect(parseSource).toContain("key={parseViewerKey}");
    expect(parseSource).toContain("function ParseOutputRendererContent({");
    expect(parseSource).toContain(
      "const [currentPage, setCurrentPage] = useState(0);",
    );
    expect(parseSource).not.toContain(
      "const parseResultBaselineRef = useRef(parseResult);",
    );

    expect(partitionSource).toContain(
      'const outputResetKey = `${documentInput?.fileBuffer ? "1" : "0"}\\u0000${partitionResult?.output.length ?? 0}`',
    );
    expect(partitionSource).toContain("<PartitionOutputRendererContent");
    expect(partitionSource).toContain("key={outputResetKey}");
    expect(partitionSource).toContain(
      "function PartitionOutputRendererContent({",
    );
    expect(partitionSource).toContain(
      "const [currentPdfPage, setCurrentPdfPage] = useState(1)",
    );
    expect(partitionSource).toContain(
      "const [scrollProgress, setScrollProgress] = useState(0)",
    );
    expect(partitionSource).not.toContain(
      'const outputResetBaselineRef = useRef("")',
    );
  });

  test("reseeds execute playground config on open through a keyed mount runner", () => {
    expect(executeSource).toContain(
      "function ExecuteDialogConfigResetRunner({",
    );
    expect(executeSource).toContain("const dialogOpenResetKey = useMemo(");
    expect(executeSource).toContain(
      "() => (open ? JSON.stringify(config) : null)",
    );
    expect(executeSource).toContain("<ExecuteDialogConfigResetRunner");
    expect(executeSource).toContain("key={dialogOpenResetKey}");
    expect(executeSource).toContain("setLocalConfig(config);");
    expect(executeSource).toContain("setLoadedInputStates(undefined);");
    expect(executeSource).not.toContain(
      'const dialogOpenBaselineRef = useRef("")',
    );
  });

  test("wraps playground outputs in the shared primitive viewer system", () => {
    expect(executeSource).toContain("PrimitiveViewerShell");
    expect(executeSource).toContain("primitiveOperationFromBlockType");
    expect(executeSource).toContain(
      'return blockType === "classifier" ? "classify" : blockType;',
    );
    expect(executeSource).toContain(
      "function buildPrimitiveViewerDownloadActions({",
    );
    expect(executeSource).toContain("<PrimitiveViewerShell");
    expect(executeSource).toContain("operation={primitiveViewerOperation}");
    expect(executeSource).toContain("contextText={primitiveViewerContextText}");
    expect(executeSource).toContain("actions={primitiveViewerDownloadActions}");
    expect(executeSource).not.toContain("shouldWrapPrimitiveViewerOutput");
    expect(executeSource).not.toContain("result === null &&");
  });

  test("wires operation-specific primitive viewer downloads for playgrounds", () => {
    expect(executeSource).toContain('if (operation === "parse") {');
    expect(executeSource).toContain("Download parsed Markdown");
    expect(executeSource).toContain('if (operation === "extract") {');
    expect(executeSource).toContain("Download schema JSON");
    expect(executeSource).toContain("Download extraction JSON");
    expect(executeSource).toContain("Download likelihoods JSON");
    expect(executeSource).toContain('if (operation === "edit") {');
    expect(executeSource).toContain("Download input document");
    expect(executeSource).toContain("Download template");
    expect(executeSource).toContain("Download filled output");
    expect(executeSource).toContain('if (operation === "split") {');
    expect(executeSource).toContain("Download full document");
    expect(executeSource).toContain('if (operation === "partition") {');
    expect(executeSource).toContain("Download partition document");
    expect(executeSource).toContain("Download document");
  });

  test("keeps execute playground initialization in state initializers instead of prop adoption effects", () => {
    expect(executeSource).toContain("function PlaygroundInputShapeRunner({");
    expect(executeSource).toContain("const inputShapeSyncKey = useMemo(");
    expect(executeSource).toContain("<PlaygroundInputShapeRunner");
    expect(executeSource).toContain(
      "return areInputStatesEqual(prev, next) ? prev : next;",
    );

    expect(executeSource).toContain("function createInitialInputStates(");
    expect(executeSource).toContain("const initialStateById = new Map(");
    expect(executeSource).toContain(
      "createInitialInputStates(inputs, config, initialInputStates),",
    );
    expect(executeSource).toContain(
      "useState<unknown>(() => initialResult ?? null);",
    );
    expect(executeSource).toContain("key={playgroundCanvasKey}");
    expect(executeSource).not.toContain(
      "function PlaygroundInitialInputStatesRunner({",
    );
    expect(executeSource).not.toContain(
      "function PlaygroundInitialResultRunner({",
    );
    expect(executeSource).not.toContain(
      "function PlaygroundConfigSyncRunner({",
    );
    expect(executeSource).not.toContain("<PlaygroundInitialInputStatesRunner");
    expect(executeSource).not.toContain("<PlaygroundInitialResultRunner");
    expect(executeSource).not.toContain("<PlaygroundConfigSyncRunner");
    expect(executeSource).not.toContain("setResult(initialResult);");
    expect(executeSource).toContain("if (!inputOutRefs.current[input.id]) {");
    expect(executeSource).toContain(
      "if (!processingInRefs.current[input.id]) {",
    );
    expect(executeSource).toContain(
      "function PlaygroundRunStateChangeRunner({",
    );
    expect(executeSource).toContain("const runStateRelayRef = useRef({");
    expect(executeSource).toContain("runStateRelayRef.current.version + 1");
    expect(executeSource).toContain("<PlaygroundRunStateChangeRunner");
    expect(executeSource).toContain("key={runStateRelayRef.current.version}");
    expect(executeSource).toContain("function ConnectionOverlayResizeRunner({");
    expect(executeSource).toContain(
      "function ConnectionOverlayRefreshRunner({",
    );
    expect(executeSource).toContain(
      "const updatePathsRef = useRef<() => void>(() => {});",
    );
    expect(executeSource).toContain("const refreshRunnerRef = useRef({");
    expect(executeSource).toContain("<ConnectionOverlayResizeRunner");
    expect(executeSource).toContain("<ConnectionOverlayRefreshRunner");
    expect(executeSource).not.toContain(
      "const inputShapeBaselineRef = useRef({ inputs, config });",
    );
    expect(executeSource).not.toContain(
      "const initialInputStatesBaselineRef = useRef(initialInputStates);",
    );
    expect(executeSource).not.toContain(
      "const initialResultBaselineRef = useRef(initialResult);",
    );
    expect(executeSource).not.toContain(
      "const configBaselineRef = useRef(config);",
    );
    expect(executeSource).not.toContain(
      "// TODO(no-useEffect): Allocates per-input ref slots when `inputs` changes.",
    );
    expect(executeSource).not.toContain(
      "useEffect(() => {\n    inputs.forEach((input) => {",
    );
    expect(executeSource).not.toContain(
      "// TODO(no-useEffect): Notifies parent of dep-change transitions;",
    );
    expect(executeSource).not.toContain(
      "// TODO(no-useEffect): Mixes imperative DOM event setup (could be",
    );
  });

  test("keeps extract playground tab and code fallbacks derived without render-time state updates", () => {
    expect(extractSource).toContain("function ExtractOutputRendererContent({");
    expect(extractSource).toContain("<ExtractOutputRendererContent");
    expect(extractSource).toContain("key={extractOutputRendererKey}");
    expect(extractSource).not.toContain(
      "ExtractOutputRenderer(\n          result,",
    );
    expect(extractSource).toContain("const fallbackAltTab = hasLikelihoods");
    expect(extractSource).toContain("const isActiveAltValid =");
    expect(extractSource).toContain('activeAlt === "likelihoods"');
    expect(extractSource).toContain(
      "const resolvedActiveAlt = isActiveAltValid",
    );
    expect(extractSource).toContain(
      "const resolvedActiveCodeTab = hasCodeConsensusTab",
    );
    expect(extractSource).not.toContain("setActiveAlt(fallbackAltTab);");
    expect(extractSource).not.toContain('setActiveCodeTab("extraction");');
    expect(extractSource).toContain("function ExtractOutputCodePane({");
    expect(extractSource).toContain(
      "const [codeValue, setCodeValue] = useState(initialCodeValue);",
    );
    expect(extractSource).toContain(
      "const displayOutputCodeValue = JSON.stringify(displayOutput, null, 2);",
    );
    expect(extractSource).toContain("<ExtractOutputCodePane");
    expect(extractSource).toContain("key={displayOutputCodeValue}");
    expect(extractSource).not.toContain(
      'const displayOutputBaselineRef = useRef("")',
    );
    expect(extractSource).toContain("const prevOpenRef = useRef(open);");
    expect(extractSource).toContain("if (open && !prevOpenRef.current) {");
    expect(extractSource).toContain("setLocalJsonSchema(");
    expect(extractSource).toContain("if (prevOpenRef.current !== open) {");
    expect(extractSource).not.toContain(
      '// TODO(no-useEffect): "When the `open` prop transitions to true, reset local',
    );
    expect(extractSource).toContain("applyPersistedDefaults &&");
    expect(extractSource).toContain("isPersistedStoreHydrated &&");
    expect(extractSource).toContain("!hasAppliedPersistedDefaultsRef.current");
    expect(extractSource).toContain(
      "hasAppliedPersistedDefaultsRef.current = true;",
    );
    expect(extractSource).toContain(
      "onConfigChange?.(mergedConfig as unknown as Record<string, unknown>);",
    );
    expect(extractSource).not.toContain(
      '// TODO(no-useEffect): One-shot "apply persisted defaults when the store',
    );
    expect(extractSource).toContain(
      "<ExtractionSelectionSync\n                  key={extractionId}",
    );
    expect(extractSource).toContain(
      "function ExtractionSelectionSyncMountRunner({",
    );
    expect(extractSource).toContain(
      "if (selectedExtractionId !== extractionId) {",
    );
    expect(extractSource).toContain("setSelectedExtractionId(extractionId);");
    expect(extractSource).not.toContain(
      "// TODO(no-useEffect): Sync selection into an external context when the",
    );
  });

  test("shows parse file tab from the uploaded playground document", () => {
    expect(parseSource).toContain("const inputFilePreview = useMemo(() => {");
    expect(parseSource).toContain(
      'const documentInput = inputStates.find(\n      (state) => state.type === "file" && state.fileBuffer,',
    );
    expect(parseSource).toContain(
      "const resolvedFilePreview = providedFilePreview ?? inputFilePreview;",
    );
    expect(executeSource).toContain('label: "File"');
    expect(executeSource).toContain('value: "file"');
    expect(parseSource).toContain("<FilePreview");
  });
});
