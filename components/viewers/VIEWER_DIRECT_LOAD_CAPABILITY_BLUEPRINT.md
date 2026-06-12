# Viewer Direct Load Capability Blueprint

This blueprint fixes the remaining impurity in the viewer source system:
`directUrl` currently lives on `ViewerDescriptor`, even though it is a loading
capability. The target design is simple:

```txt
ViewerSource -> ViewerDescriptor -> metadata
ViewerSource -> ViewerResource   -> capabilities
ViewerResource -> format loader  -> format-specific policy
```

No loader should read from a descriptor to perform IO.

## Problem

`ViewerDescriptor` currently mixes metadata with capabilities:

```ts
export interface ViewerDescriptor {
  source: ViewerSource
  category: FileCategory
  identityKey: string
  displayName: string
  fileName: string
  downloadHref?: string
  directUrl?: string
  mimeType?: string
}
```

`directUrl` means: this source came from a URL, and that URL can be handed
directly to a format library.

That is real and necessary. PDF.js should keep receiving URLs when possible so
it can preserve its native URL, range, and worker behavior.

But `directUrl` is not descriptor metadata. It is a loading capability.

`downloadHref` has the same boundary problem for user download behavior. It is
less dangerous because `resource.getDownload()` already exists, but the final
descriptor should not expose either field.

## Target Descriptor

`ViewerDescriptor` should only contain synchronous metadata used for routing,
display, equality, and naming:

```ts
export interface ViewerDescriptor {
  source: ViewerSource
  category: FileCategory
  identityKey: string
  displayName: string
  fileName: string
  mimeType?: string
}
```

Descriptor rules:

- `category` is for routing.
- `identityKey` is for source-linked equality and high-level identity.
- `displayName` is for UI labels.
- `fileName` is only the default filename, not the download mechanism.
- `mimeType` is metadata.
- The descriptor does not fetch, stream, create object URLs, expose direct URLs,
  or describe what a library can load.

## Target Resource Capability

Add an explicit direct-load capability to `ViewerResource`:

```ts
export type DirectLoadCapability =
  | { kind: "url"; url: string }
  | { kind: "none" }

export interface ViewerResource {
  readonly source: ViewerSource
  readonly descriptor: ViewerDescriptor
  readonly cacheKey: string
  readonly identityKey: string
  readonly fileName: string
  readonly mimeType?: string

  getDirectLoad(): DirectLoadCapability
  getDownload(): DownloadCapability

  readBlob(options?: ResourceReadOptions): Promise<Blob>
  readArrayBuffer(options?: ResourceReadOptions): Promise<ArrayBuffer>
  readText(options?: TextReadOptions): Promise<string>
  stream(options?: ResourceReadOptions): Promise<ReadableStream<Uint8Array>>
  readRange(
    range: ByteRange,
    options?: ResourceReadOptions
  ): Promise<ByteRangeResult>
}
```

Use `getDirectLoad()`, not `getUrl()`.

The point is not that a resource has URL shape. The point is that a downstream
format library can load it directly without the viewer infrastructure first
reading bytes.

## Capability Implementations

URL resources expose a direct load:

```ts
getDirectLoad: () => ({ kind: "url", url: source.url })
```

Blob resources do not:

```ts
getDirectLoad: () => ({ kind: "none" })
```

Text resources do not:

```ts
getDirectLoad: () => ({ kind: "none" })
```

This is deliberately narrow. Do not add object URLs to direct load by default.
Generated object URLs have ownership and revocation semantics, so they should
stay behind explicit resource helpers when a viewer truly needs them.

## Download Remains Separate

Direct load and download are different capabilities.

```ts
source.url // loading URL
source.downloadUrl // user download URL, possibly different
```

Example:

```ts
{
  kind: "url",
  url: "/api/files/preview/123",
  downloadUrl: "/api/files/download/123",
  fileName: "report.pdf"
}
```

PDF.js should use `/api/files/preview/123`.

The toolbar should use `/api/files/download/123`.

Do not merge these concepts. The canonical split is:

```ts
resource.getDirectLoad()
resource.getDownload()
```

## Loader Policy

Format loaders choose the best available capability.

PDF:

```ts
async function getPdfDocument(resource: ViewerResource, pdfjs: typeof Pdfjs) {
  const directLoad = resource.getDirectLoad()
  if (directLoad.kind === "url") {
    return pdfjs.getDocument(directLoad.url).promise
  }

  const buffer = await resource.readArrayBuffer()
  return pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
}
```

CSV:

```ts
async function streamCsvResource(resource: ViewerResource) {
  const directLoad = resource.getDirectLoad()
  const dialect = inferCsvDialect({
    src: directLoad.kind === "url" ? directLoad.url : undefined,
    fileName: resource.fileName,
    mimeType: resource.mimeType,
  })

  if (resource.source.kind === "blob") {
    return parseBlobCsv(resource.source.blob, dialect)
  }

  return streamCsv(await resource.stream(), dialect)
}
```

FileViewer legacy adapters:

```tsx
const directLoad = resource.getDirectLoad()

if (category === "xlsx") {
  if (directLoad.kind !== "url") {
    return <UnsupportedCard resource={resource} />
  }
  return <XlsxViewer src={directLoad.url} />
}
```

The adapter is now explicit: URL-only viewers receive a URL only when the
resource actually has a direct URL.

## Cache Key Rules

`viewerResourceCacheKey()` must stop reading `descriptor.directUrl`.

Instead, the resource layer owns the direct-load contribution:

```ts
function viewerResourceCacheKey(
  source: ViewerSource,
  descriptor: ViewerDescriptor
) {
  return [
    source.kind,
    descriptor.identityKey,
    descriptor.category,
    descriptor.displayName,
    descriptor.fileName,
    directLoadCacheKey(source),
    descriptor.mimeType ?? "",
    payloadCacheKey(source),
  ].join("\0")
}

function directLoadCacheKey(source: ViewerSource) {
  return source.kind === "url" ? source.url : ""
}
```

Download URL should only be included if changing it changes resource behavior.
For most loaded-resource caches it should not, because download URL does not
change loaded bytes. If a cache key currently includes download URL only because
it came from `descriptor.downloadHref`, remove that coupling.

## Migration Plan

1. Add `DirectLoadCapability`.

2. Add `getDirectLoad()` to `ViewerResource`.

3. Implement it in URL, Blob, and text resources.

4. Remove `directUrl` from `ViewerDescriptor`.

5. Remove `downloadHref` from `ViewerDescriptor`.

6. Update `viewerResourceCacheKey()` to use `directLoadCacheKey(source)`.

7. Update PDF to use `resource.getDirectLoad()`.

8. Update CSV dialect inference to use `resource.getDirectLoad()`, `fileName`,
   and `mimeType`.

9. Update FileViewer to create one `ViewerResource` and pass that resource to
   routing decisions.

10. Update URL-only legacy adapters to require `getDirectLoad().kind === "url"`.

11. Update unsupported and error fallbacks to use `resource.getDownload()`
    instead of descriptor download fields.

12. Update tests so descriptor assertions no longer mention `directUrl` or
    `downloadHref`.

13. Search for and remove all production reads of:

```txt
descriptor.directUrl
descriptor.downloadHref
directUrl:
downloadHref:
```

## Required Tests

Resource tests:

- URL source returns `{ kind: "url", url }` from `getDirectLoad()`.
- Blob source returns `{ kind: "none" }`.
- Text source returns `{ kind: "none" }`.
- URL source download can differ from direct load.
- Changing `downloadUrl` does not poison loaded-resource caches unless the
  cache explicitly models download behavior.

PDF tests:

- URL PDF calls `pdfjs.getDocument(url)`.
- Blob PDF calls `pdfjs.getDocument({ data })`.
- URL PDF with different `downloadUrl` still loads from `url`.

CSV tests:

- URL TSV infers tab delimiter from direct load URL.
- Blob TSV infers tab delimiter from `fileName`.
- Text CSV infers delimiter from `fileName`.

FileViewer tests:

- URL-only legacy viewers receive direct URL resources.
- Blob resources for unmigrated URL-only viewers render unsupported.
- Unsupported fallback still exposes download when `resource.getDownload()`
  allows it.

Search tests:

```bash
rg -n "descriptor\\.directUrl|descriptor\\.downloadHref|directUrl:|downloadHref:" \
  registry/new-york-v4 components tests content --glob '!public/r/**/*.json'
```

The search should return no production usage after migration.

## Final Invariants

1. `ViewerDescriptor` contains metadata only.
2. `ViewerResource` contains capabilities only.
3. Download and direct loading are separate capabilities.
4. Format loaders choose capabilities explicitly.
5. URL fast paths are preserved.
6. Blob and text sources stay first-class.
7. FileViewer adapters make URL-only limitations visible.
8. No IO starts from `descriptor`.

When this blueprint is implemented, `directUrl` stops being a descriptor leak
and becomes a clean resource capability.
