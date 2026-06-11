# Retab UI — Release Notes

A document-viewer family for the Retab registry. One **generic file viewer**
detects the file type and renders the right component.

## Highlights

- **PDF, DOCX, PPTX, XLSX, images (incl. multi-page TIFF), CSV** — each with its
  own purpose-built, virtualized, client-side viewer.
- **Text, code, JSON, Markdown, HTML** — handled inline, no server round-trip.

## Supported formats

| Category | Extensions | Renderer |
| --- | --- | --- |
| Documents | `pdf`, `docx`, `pptx`, `xlsx` | dedicated viewer |
| Images | `png`, `jpg`, `webp`, `tiff`, `svg` | image viewer |
| Tabular | `csv`, `tsv` | csv viewer |
| Text & code | `txt`, `json`, `ts`, `py`, … | text viewer |
| Markup | `md`, `html` | markdown / iframe |

## Code

```ts
import { FileViewer } from "@/components/ui/file-viewer"

export function Example() {
  return <FileViewer src="/report.pdf" fileName="report.pdf" />
}
```

> The viewer is built without `useEffect` for data loading — sources load with
> React's `use()` and Suspense, and heavy renderers are code-split.

1. Detect the type from the extension or MIME type.
2. Lazy-load only the matching viewer.
3. Render — fast, client-side, no upload.
