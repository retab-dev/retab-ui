# Text Viewer System Diagram

This document maps the `text-viewer` system as implemented in
`registry/new-york-v4` and re-exported through `components/ui`.

```mermaid
flowchart TD
  %% ---------------------------------------------------------------------------
  %% Public entry points and distribution
  %% ---------------------------------------------------------------------------
  subgraph Distribution["Distribution and public entry points"]
    Docs["content/docs/components/file-viewer/renderers/text.mdx\nDocs examples, feature list, props, ref API"]
    Demo["components/text-viewer-demo.tsx\nDocs demo using /samples/server.log"]
    RegistryItem["public/r/text-viewer.json\nshadcn registry item\nmetadata, dependencies, source file payloads"]
    ComponentExports["components/ui/text-viewer*.ts\nThin app exports from registry/new-york-v4/ui"]
    LibExports["lib/viewer-*.ts\nThin app exports from registry/new-york-v4/lib"]
    RegistryImpl["registry/new-york-v4/ui/text-viewer.tsx\nCanonical TextViewer runtime implementation"]
  end

  Docs --> Demo
  Docs --> ComponentExports
  Demo --> ComponentExports
  RegistryItem --> RegistryImpl
  ComponentExports --> RegistryImpl
  LibExports --> ResourceCore
  LibExports --> SourceCore
  LibExports --> ErrorCore
  LibExports --> DownloadCore

  %% ---------------------------------------------------------------------------
  %% Consumer API
  %% ---------------------------------------------------------------------------
  subgraph ConsumerAPI["Consumer API"]
    Consumer["Application component"]
    Props["TextViewerProps\nsource: url | blob | text\nclassName?: string\ncontrols?: boolean = true\nhighlight?: { start, end } | null\nbare?: boolean\nmaxBytes?: number = 1_000_000\nmaxLines?: number = 10_000"]
    RefAPI["TextViewerHandle\nscrollToLineRange(range, options?)\ngetViewportElement()"]
    SourceLinkConsumer["Source-linked viewers\nTextSourcesBlock, SourcesViewerBlock,\nJsonForm/source field hovers"]
  end

  Consumer --> Props
  Props --> TextViewer
  TextViewer --> RefAPI
  SourceLinkConsumer --> TextSourceAdapter
  TextSourceAdapter --> Props
  TextSourceAdapter --> RefAPI

  %% ---------------------------------------------------------------------------
  %% Text source adapter
  %% ---------------------------------------------------------------------------
  subgraph SourceLink["Source-link adapter: registry/new-york-v4/ui/text-source.tsx"]
    SourceAnchor["Source.anchor\nkind: text_span\nline_start, line_end\noptional char_start, char_end"]
    TextAnchorToLines["textAnchorToTarget(anchor)\nvalidates integer lines\nrequires line_start >= 1\nrequires line_end >= line_start\nvalidates optional char range"]
    UseTextSourceTarget["useTextSourceTarget(viewerRef)\nreturns SourceTarget.scrollTo(source, options)"]
    SourceToTextHighlight["sourceToTextHighlight(activeSource)\nconverts active source into TextViewer.highlight"]
  end

  SourceAnchor --> TextAnchorToLines
  TextAnchorToLines --> UseTextSourceTarget
  TextAnchorToLines --> SourceToTextHighlight
  UseTextSourceTarget -->|"viewerRef.current?.scrollToLineRange(range)"| RefAPI
  SourceToTextHighlight --> Props

  %% ---------------------------------------------------------------------------
  %% TextViewer frame
  %% ---------------------------------------------------------------------------
  subgraph TextViewerFrame["TextViewer frame: registry/new-york-v4/ui/text-viewer.tsx"]
    TextViewer["TextViewer forwardRef"]
    RetryState["retryState\n{ contentKey, version }"]
    UseIsClient["useIsClient()\nuseSyncExternalStore\nserver snapshot false\nclient snapshot true"]
    CreateResourceCall["createViewerResource(source)"]
    ContentBaseKey["textViewerContentBaseKey(content, bounds)\ncontent.key + maxBytes + maxLines"]
    RetryVersion["retryVersion\n0 unless retryState.contentKey matches current content key"]
    ResetKey["textViewerResetKey(resource, bounds, retryVersion)\nresource.keys.resource + retryVersion + bounds"]
    ContentResetKey["textViewerContentResetKey(contentBaseKey, retryVersion)\nSuspense key; prevents stale text during pending URL load"]
    SSRFallbackDecision{"source.kind !== text\nand not client?"}
    ErrorBoundary["ViewerErrorBoundary\nformat='text'\nsourceKind=resource.sourceKind\nresetKey=ResetKey\ndownload=null when controls=false"]
    Suspense["React.Suspense\nkey=ContentResetKey\nfallback=TextViewerFallback"]
    TextViewerInner["TextViewerInner\nloads text, virtualizes lines, renders chrome/body"]
  end

  TextViewer --> RetryState
  TextViewer --> UseIsClient
  TextViewer --> CreateResourceCall
  CreateResourceCall --> ResourceCore
  CreateResourceCall --> ContentBaseKey
  RetryState --> RetryVersion
  ContentBaseKey --> RetryVersion
  RetryVersion --> ResetKey
  RetryVersion --> ContentResetKey
  UseIsClient --> SSRFallbackDecision
  SSRFallbackDecision -->|"yes"| FallbackChrome
  SSRFallbackDecision -->|"no"| ErrorBoundary
  ResetKey --> ErrorBoundary
  ErrorBoundary --> Suspense
  ContentResetKey --> Suspense
  Suspense --> TextViewerInner
  ErrorBoundary -->|"onRetry increments retry version for same content key"| RetryState

  %% ---------------------------------------------------------------------------
  %% Source and resource normalization
  %% ---------------------------------------------------------------------------
  subgraph SourceCore["Source model: registry/new-york-v4/lib/viewer-source.ts"]
    ViewerSource["ViewerSource union\nUrlViewerSource | BlobViewerSource | TextSource"]
    URLSource["UrlViewerSource\nkind='url'\nurl, fileName?, mimeType?, downloadUrl?, identityKey?"]
    BlobSource["BlobViewerSource\nkind='blob'\nblob, required identityKey,\nfileName?, mimeType?, downloadUrl?"]
    InlineTextSource["TextSource\nkind='text'\ntext, fileName?, mimeType?, identityKey?"]
    DetectCategory["detectCategory(fileName, mimeType)\nextension and MIME mapping\n.txt .log .json .xml .yaml .ts .py etc -> text"]
    ResolveDescriptor["resolveViewerDescriptor({ source, category? })\ncategory, identityKey, displayName, fileName, mimeType"]
    DefaultNames["defaultDisplayName/defaultFileName/defaultIdentityKey\nurl -> URL/extracted name\ntext -> text.txt / full text identity\nblob -> file / explicit identityKey"]
  end

  ViewerSource --> URLSource
  ViewerSource --> BlobSource
  ViewerSource --> InlineTextSource
  URLSource --> ResolveDescriptor
  BlobSource --> ResolveDescriptor
  InlineTextSource --> ResolveDescriptor
  DetectCategory --> ResolveDescriptor
  DefaultNames --> ResolveDescriptor

  subgraph ResourceCore["Resource model: registry/new-york-v4/lib/viewer-resource.ts"]
    ResourceFactory["createViewerResource(source, category?)"]
    ResourceKeys["viewerResourceKeys\nload key = source kind + identityKey + MIME + direct URL + payload hash\npresentation key = category + displayName + fileName + MIME + download URL\nresource key = load + presentation"]
    URLRegistry["URL resource registries\nMap resource max 128\nMap content max 128"]
    TextRegistry["Inline text resource registries\nMap resource max 64\nMap content max 64"]
    BlobRegistry["Blob resource registries\nWeakMap blob -> Map resource/content\nblobObjectKey WeakMap"]
    ViewerResourceObj["ViewerResource\nfrozen descriptor, sourceKind, keys,\nidentityKey, fileName, mimeType,\ncontent, originalDownload"]
    ResourceContent["ViewerResourceContent\nkey, sourceKind, directUrl, mimeType, payload\nreadBlob, readBytes, readText, readStream, readRange"]
    URLContent["URL content\npayload { kind: 'url', url }\ndirectUrl = url\nreadText fetches and streams bounded response\nreadRange sends Range header"]
    BlobContent["Blob content\npayload { kind: 'blob', blob }\nreadText checks blob.size then blob.text()\nreadRange slices blob"]
    TextContent["Inline text content\npayload { kind: 'text', text }\nreadText uses TextEncoder byte length and line count\nreadBlob/readBytes/readStream/readRange from string"]
    OriginalDownload["originalDownload\nurl -> href action\nblob -> href downloadUrl or blob action\ntext -> text action"]
  end

  ResourceFactory --> ResolveDescriptor
  ResolveDescriptor --> ResourceKeys
  ResourceKeys --> URLRegistry
  ResourceKeys --> TextRegistry
  ResourceKeys --> BlobRegistry
  URLRegistry --> URLContent
  TextRegistry --> TextContent
  BlobRegistry --> BlobContent
  URLContent --> ResourceContent
  BlobContent --> ResourceContent
  TextContent --> ResourceContent
  ResourceContent --> ViewerResourceObj
  OriginalDownload --> ViewerResourceObj
  ResourceFactory --> ViewerResourceObj
  ViewerResourceObj --> TextViewer

  %% ---------------------------------------------------------------------------
  %% Bounded text loading
  %% ---------------------------------------------------------------------------
  subgraph TextResource["Text resource layer: registry/new-york-v4/ui/text-viewer-resource.ts"]
    Defaults["Defaults\nDEFAULT_MAX_BYTES = 1_000_000\nDEFAULT_MAX_LINES = 10_000\nMAX_TEXT_RESOURCE_CACHE_ENTRIES = 64"]
    ResolveBounds["resolvedTextViewerBounds({ maxBytes, maxLines })\nuses defaults\nrequires positive safe integers"]
    InvalidBounds["TextViewerInvalidBoundsError\nViewerFormatError(format='text', kind='bounds')"]
    ReadTextResource["readTextResource({ content, retryVersion, bounds })"]
    InlineFastPath{"content.payload.kind === 'text'?"}
    AssertInlineBounds["assertTextWithinBounds(inlineText, bounds)\nUTF-8 byte length via TextEncoder\nline count via splitTextLines"]
    TextResourceKey["textViewerResourceKey\ncontent.key + retryVersion + bounds.maxBytes + bounds.maxLines"]
    TextResourceCache["textResourceCache\nMap<string, TextResource>\npending/resolved/rejected\ntrim oldest above 64"]
    ReadBounded["readBoundedTextResource(content, bounds)\nawait content.readText(bounds)\nwrap unknown errors with toTextFormatError\npreserve ResourceError"]
    SuspenseThrow["pending -> throw promise\nrejected -> throw error\nresolved -> return value"]
    TooLargeError["TextViewerTooLargeError\nViewerFormatError(format='text', kind='bounds')\nreason bytes | lines"]
    SplitLines["splitTextLines(text)\nCRLF, LF, CR, U+2028, U+2029\nempty text becomes one blank line"]
  end

  TextViewerInner --> Defaults
  Defaults --> ResolveBounds
  ResolveBounds --> InvalidBounds
  ResolveBounds --> ReadTextResource
  ViewerResourceObj --> ReadTextResource
  ReadTextResource --> InlineFastPath
  InlineFastPath -->|"yes"| AssertInlineBounds
  AssertInlineBounds --> TooLargeError
  AssertInlineBounds --> SplitLines
  InlineFastPath -->|"no"| TextResourceKey
  TextResourceKey --> TextResourceCache
  TextResourceCache -->|"cache miss"| ReadBounded
  ReadBounded --> ResourceContent
  ReadBounded --> ErrorCore
  ReadBounded --> TextResourceCache
  TextResourceCache --> SuspenseThrow
  SuspenseThrow --> Suspense
  SuspenseThrow --> ErrorBoundary
  SuspenseThrow --> SplitLines

  %% ---------------------------------------------------------------------------
  %% Low-level bounded source reads
  %% ---------------------------------------------------------------------------
  subgraph BoundedReads["Low-level bounded reads inside viewer-resource.ts"]
    FetchResource["fetchResource(url, init)\nfetch failed -> ResourceError(fetch_failed)\nabort -> ResourceError(aborted)\nnon-ok except 206 -> ResourceError(http_error)"]
    ValidateFull["validateFullContentResponse\nrejects 206 partial_content for full reads"]
    ResponseText["readBoundedResponseText(response, bounds)\ncontent-length precheck\nstream reader when body exists\nTextDecoder streaming decode\ntracks received bytes\ntracks line limit per chunk\ncancels reader on bounds failure"]
    BlobText["readBoundedBlobText(blob, bounds)\nblob.size byte precheck\nblob.text()\nassertLineLimit"]
    InlineText["readBoundedInlineText(text, bounds)\nTextEncoder byte check\nassertLineLimit"]
    LineTracker["createLineLimitTracker(maxLines)\ncounts CR, LF, CRLF, U+2028, U+2029 across chunks"]
    TooLargeResource["ResourceError(kind='too_large', tooLargeReason='bytes'|'lines')"]
    RangeReads["readRange(range)\nvalidateByteRange\nURL uses Range header and Content-Range validation\nBlob/text use slices"]
    StreamReads["readStream()\nURL returns response.body or empty stream for 204/205\nBlob/text wrap native stream"]
  end

  URLContent --> FetchResource
  FetchResource --> ValidateFull
  ValidateFull --> ResponseText
  ResponseText --> LineTracker
  ResponseText --> TooLargeResource
  BlobContent --> BlobText
  BlobText --> TooLargeResource
  TextContent --> InlineText
  InlineText --> TooLargeResource
  URLContent --> RangeReads
  BlobContent --> RangeReads
  TextContent --> RangeReads
  URLContent --> StreamReads
  BlobContent --> StreamReads
  TextContent --> StreamReads
  TooLargeResource --> ErrorCore

  %% ---------------------------------------------------------------------------
  %% Inner rendering and virtualization
  %% ---------------------------------------------------------------------------
  subgraph Rendering["Rendering and virtualization: TextViewerInner"]
    Lines["textLines = splitTextLines(text)"]
    HighlightInput["highlight prop\n1-based inclusive line range or null"]
    NormalizeRange["normalizeTextLineRange(range, lineCount)\nfinite values only\ntruncates decimals\naccepts reversed ranges\nclamps to document\nreturns null for fully out-of-range or empty docs"]
    FontScale["fontScale state\nbase font 12px\nbase line 20px\nmin 0.25x\nmax 5x\nzoom factor 1.2"]
    Virtualizer["local text row virtualizer\ncount = textLines.length\nscroll element = ScrollArea viewport\nlineHeight offsets\noverscan = 24\npaddingStart/End = 8\ninitial viewport 800x600"]
    MeasureEffect["layout effect reads scroll viewport\nreruns when lineHeight changes"]
    InitialVirtualLines["createInitialTextVirtualLines\nused before virtualizer measures\nwindow = initial viewport lines + overscan * 2"]
    Gutter["gutterWidth\nString(lineCount).length + 1 ch"]
    Pre["pre.relative.w-max.min-w-full.font-mono\nfontSize = 12 * fontScale\nlineHeight = 20 * fontScale\nheight = virtualizer totalSize"]
    TextLineNode["TextLine absolute row\ndata-line-number\nleft gutter + whitespace-pre text\nblank lines render as a space\nhighlight adds bg-primary/12 and ring"]
    IsLineInRange["isLineInRange(lineNumber, normalizedRange)"]
  end

  SplitLines --> Lines
  Lines --> NormalizeRange
  HighlightInput --> NormalizeRange
  TextViewerInner --> FontScale
  FontScale --> Virtualizer
  FontScale --> MeasureEffect
  Lines --> Virtualizer
  Virtualizer --> InitialVirtualLines
  Virtualizer --> Pre
  InitialVirtualLines --> Pre
  Lines --> Gutter
  Gutter --> TextLineNode
  Pre --> TextLineNode
  NormalizeRange --> IsLineInRange
  IsLineInRange --> TextLineNode

  %% ---------------------------------------------------------------------------
  %% Frame, controls, loading, errors
  %% ---------------------------------------------------------------------------
  subgraph Chrome["Chrome: registry/new-york-v4/ui/text-viewer-chrome.tsx"]
    Frame["TextViewerFrame\nflex column, overflow hidden\ndata-slot='text-viewer'\nbare -> h-full bg-muted/20\nnon-bare -> rounded border bg-muted/30"]
    Controls["TextViewerControls\nleading line count\ntrailing zoom controls + divider + download"]
    ZoomControls["TextViewerZoomControls\nMinus, percentage, Plus, Maximize\nButton size icon-sm\naria-label/title\nfallback controls disabled and aria-hidden"]
    FallbackChrome["TextViewerFallback\noptional controls skeleton\n12 body skeleton rows\nused for SSR non-text sources and Suspense pending"]
    LegacyErrorState["TextViewerErrorState\nlocal retry/download layout\ncurrently superseded by generic ViewerErrorBoundary path"]
  end

  TextViewerInner --> Frame
  Frame --> Controls
  Controls --> ZoomControls
  Controls --> DownloadControl
  Suspense --> FallbackChrome

  subgraph ErrorHandling["Error handling: viewer-error.tsx + viewer-errors.ts"]
    ErrorCore["Error classes and mappers\nResourceError\nViewerFormatError\nViewerStateError\nViewerUnsupportedError"]
    ErrorBoundaryState["ViewerErrorBoundary state\n{ error, retryKey }\nclears error when resetKey changes"]
    ErrorInfo["toViewerErrorInfo(error, context)\ndomain, format, kind, retryability,\ndownload usefulness, userMessage"]
    ErrorState["ViewerErrorState\nrole='alert'\ndata-error-* attributes\nRetry button when retryable\nDownload button when useful"]
    TextMessages["Text user messages\nbounds lines -> too many lines\nbounds bytes -> too large\ninvalid bounds -> bounds invalid\nfallback -> couldn't load text file"]
    RetryRules["Retry defaults\nResourceError retry only for url except aborted/range/too_large/unsupported\nText bounds format errors are not retryable\nunknown retries only for url"]
  end

  ErrorBoundary --> ErrorBoundaryState
  ErrorBoundaryState --> ErrorInfo
  ErrorInfo --> TextMessages
  ErrorInfo --> RetryRules
  ErrorInfo --> ErrorState
  ErrorState -->|"retry clears error and calls TextViewer onRetry"| RetryState
  ErrorState --> DownloadButton

  %% ---------------------------------------------------------------------------
  %% Download path
  %% ---------------------------------------------------------------------------
  subgraph Download["Download: viewer-download.tsx + viewer-download.ts"]
    DownloadCore["ViewerDownloadAction\nid, label, fileName, origin,\nisDisabled?, getPayload(signal?)"]
    DownloadActions["Factory actions\ncreateHrefDownloadAction\ncreateBlobDownloadAction\ncreateTextDownloadAction\ncreateDisabledDownloadAction"]
    DownloadControl["ViewerDownloadControl\none action -> button\nmultiple actions -> menu"]
    DownloadButton["ViewerDownloadButton / menu item\nDownload icon, label optional"]
    DownloadTrigger["useViewerDownloadTrigger\ntracks pendingActionId\naborts previous download on new trigger\naborts on unmount/reset"]
    TriggerDownload["triggerViewerDownload(action)\nget payload\nhref -> click download\nblob/text -> object URL + click + revoke\nerrors -> ViewerDownloadError"]
  end

  OriginalDownload --> DownloadActions
  DownloadActions --> DownloadCore
  DownloadCore --> DownloadControl
  DownloadControl --> DownloadButton
  DownloadButton --> DownloadTrigger
  DownloadTrigger --> TriggerDownload

  %% ---------------------------------------------------------------------------
  %% Scroll and highlight path
  %% ---------------------------------------------------------------------------
  subgraph Scrolling["Scrolling and range layout: text-viewer-layout.ts + text-viewer-ranges.ts"]
    HighlightEffect["effect on highlightRange/lineHeight\nscrollLineRangeMetricsIntoView(...)"]
    ImperativeHandle["useImperativeHandle\nscrollToLineRange(range, options)\ngetViewportElement()"]
    MetricsScroll["scrollLineRangeMetricsIntoView\nrequires viewport and scrollTo\ncomputes top from line metrics without mounted DOM nodes"]
    TopForMetrics["scrollTopForLineRangeMetrics\nrangeTop = paddingStart + (startLine - 1) * lineHeight\nrangeBottom = paddingStart + endLine * lineHeight\ncenter if range fits viewport\notherwise top minus LINE_SCROLL_HEADROOM 64\nclamp >= 0"]
    Viewport["ScrollArea viewportRef\nactual scroll container"]
  end

  NormalizeRange --> HighlightEffect
  HighlightEffect --> MetricsScroll
  ImperativeHandle --> MetricsScroll
  TextViewerInner --> ImperativeHandle
  MetricsScroll --> TopForMetrics
  TopForMetrics --> Viewport
  RefAPI --> ImperativeHandle
  DOMScroll -. "available helper, not used by TextViewerInner" .-> Viewport

  %% ---------------------------------------------------------------------------
  %% State transition and failure flows
  %% ---------------------------------------------------------------------------
  subgraph RuntimeFlows["Important runtime flows"]
    URLPending["URL/blob async text pending\nreadTextResource throws promise\nSuspense shows fallback\nContentResetKey avoids stale previous source"]
    URLResolved["resource resolves\ncache status resolved\ntext split into lines\nvirtual rows render"]
    URLRejected["resource rejects\nreadTextResource throws error\nViewerErrorBoundary renders user-facing alert"]
    InlineSync["inline text source\nsync fast path\nbounds checked every render\nno Suspense promise for load"]
    BoundsChange["maxBytes/maxLines change\ncontentBaseKey changes\nresource cache key changes\nboundary reset key changes"]
    SourceChange["source identity/load/presentation changes\ncreateViewerResource returns interned or new resource\nreset/content keys change"]
    RetryFlow["Retry click\nboundary clears error\nTextViewer increments retryVersion for same content\nnew resource cache key triggers fresh read"]
  end

  ReadTextResource --> URLPending
  URLPending --> FallbackChrome
  URLPending --> URLResolved
  URLPending --> URLRejected
  URLResolved --> Lines
  URLRejected --> ErrorState
  InlineFastPath --> InlineSync
  InlineSync --> Lines
  BoundsChange --> ContentBaseKey
  BoundsChange --> ResetKey
  SourceChange --> CreateResourceCall
  RetryFlow --> RetryState

  %% ---------------------------------------------------------------------------
  %% Test coverage
  %% ---------------------------------------------------------------------------
  subgraph Tests["Tests and behavioral contracts"]
    MainTests["tests/text-viewer.test.tsx\nline rendering, empty/trailing lines, CRLF/CR,\nsource changes, stale row removal, pending URL fallback,\ntoolbar hiding, bounds errors,\nhighlight normalization, imperative scroll,\nzoom-dependent scroll, downloads, retry/cache behavior"]
    EdgeTests["tests/text-viewer-edge-cases.test.tsx\nline terminators, whitespace, accessibility/chrome,\ninvalid inputs, size and line bounds"]
    BugHuntTests["tests/text-viewer-bug-hunt.test.tsx\nresource cache, retries, SSR/client behavior,\nregression coverage"]
    FileMarkdownTests["tests/file-viewer-markdown.test.ts\nFileViewer markdown/text interactions"]
    SourceTests["tests/sources.test.tsx\nsource-link adapter behavior across viewer formats"]
  end

  Tests --> RegistryImpl
  MainTests --> TextViewer
  MainTests --> TextResource
  MainTests --> Scrolling
  EdgeTests --> Rendering
  BugHuntTests --> TextResource
  BugHuntTests --> TextViewerFrame
  SourceTests --> SourceLink
  FileMarkdownTests --> ConsumerAPI
```

## File Map

- `components/ui/text-viewer.tsx`, `text-viewer-resource.ts`,
  `text-viewer-chrome.tsx`, and `text-viewer-layout.ts` are app-level exports.
  They forward to the registry implementation.
- `registry/new-york-v4/ui/text-viewer.tsx` owns the public React component,
  retry state, SSR fallback decision, Suspense boundary, error boundary,
  bounded text loading call, virtualized render, zoom state, highlight scroll,
  and ref handle.
- `registry/new-york-v4/ui/text-viewer-resource.ts` owns text-specific bounds,
  text resource caching, inline fast-path reads, Suspense promise throwing,
  line splitting, and text-specific format errors.
- `registry/new-york-v4/ui/text-viewer-layout.ts` owns scroll math for line
  ranges, including metric-based scrolling for virtualized lines that are not
  mounted.
- `registry/new-york-v4/ui/text-viewer-ranges.ts` owns 1-based line range
  normalization and membership checks.
- `registry/new-york-v4/ui/text-viewer-chrome.tsx` owns the frame, controls,
  zoom controls, skeleton fallback, and legacy local error state component.
- `registry/new-york-v4/ui/text-source.tsx` adapts the shared source-link model
  to `TextViewer` by converting `text_span` anchors into line ranges.
- `registry/new-york-v4/lib/viewer-source.ts` owns source descriptors,
  extension/MIME category detection, display names, file names, and identity
  keys.
- `registry/new-york-v4/lib/viewer-resource.ts` owns resource interning,
  load/presentation/resource keys, URL/blob/text content readers, bounded
  low-level reads, range reads, streams, and original download actions.
- `registry/new-york-v4/lib/viewer-errors.ts` owns normalized viewer error
  types, retryability, download usefulness, and user-facing messages.
- `registry/new-york-v4/ui/viewer-error.tsx` owns the generic viewer error
  boundary and alert UI used by `TextViewer`.
- `registry/new-york-v4/lib/viewer-download.ts` and
  `registry/new-york-v4/ui/viewer-download.tsx` own download action modeling,
  UI controls, abort handling, payload preparation, object URL creation, and
  click-based downloads.

## End-To-End Flow

1. A consumer renders `TextViewer` with a URL, Blob, or inline text source.
2. `TextViewer` creates or reuses a `ViewerResource` using source identity,
   source payload, file metadata, MIME/category detection, and download
   metadata.
3. Non-inline sources rendered during SSR show `TextViewerFallback`; inline text
   can render synchronously because the payload is already local.
4. On the client, `ViewerErrorBoundary` wraps a keyed Suspense subtree. The
   reset key includes resource identity, retry version, and bounds; the Suspense
   key includes content identity, retry version, and bounds.
5. `TextViewerInner` resolves positive integer bounds, then calls
   `readTextResource`.
6. Inline text uses the synchronous payload fast path and checks byte and line
   limits directly.
7. URL and Blob text use a text resource cache keyed by content, retry version,
   and bounds. Pending cache entries throw a promise for Suspense; rejected
   entries throw to the error boundary; resolved entries return text.
8. URL reads fetch the resource, reject unexpected partial responses for full
   text reads, stream-decode response bodies when possible, enforce byte limits
   while reading, enforce line limits across chunks, and cancel the reader when a
   limit is exceeded.
9. Blob reads precheck `blob.size`, then decode with `blob.text()` and enforce
   line limits.
10. The loaded text is split on CRLF, LF, CR, U+2028, and U+2029 so visual line
    numbers match browser `white-space: pre` behavior.
11. The optional highlight range is normalized against the final line count:
    invalid or fully out-of-document ranges become `null`, reversed ranges are
    accepted, and partial overlaps are clamped.
12. The local text row virtualizer renders only the mounted line window plus 24
    lines of overscan. Before measurement, `createInitialTextVirtualLines` renders an
    initial viewport-sized window so the first paint is not blank.
13. Each virtual line is absolutely positioned inside a `pre`, receives a stable
    `data-line-number`, renders a gutter, preserves whitespace, and applies
    highlight classes when its line number is inside the normalized range.
14. The controls row shows line count, zoom controls, and the original download
    action unless `controls={false}`.
15. Zoom changes `fontScale`, recomputes line height, asks the virtualizer to
    remeasure, and affects subsequent highlight and imperative scroll math.
16. Highlight changes and `scrollToLineRange` both use metric-based scroll math,
    so the viewer can scroll to lines that are not currently mounted.
17. Errors are normalized into viewer error info. URL load failures are generally
    retryable; text bounds errors are not. Useful downloads remain available in
    error states when the controls has not been disabled.
18. Retry clears the boundary error, increments `retryVersion` for the same
    content key, changes the text resource cache key, and forces a fresh read.
19. Download actions resolve to href, blob, or text payloads. The UI aborts any
    previous pending download trigger, creates object URLs for blob/text payloads,
    clicks a temporary anchor, and revokes object URLs.
20. Source-linked extraction flows use `text-source.tsx` to convert active
    `text_span` anchors into `highlight` props and imperative scroll calls.
