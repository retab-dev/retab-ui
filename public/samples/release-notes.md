# Retab UI — Release Notes

A complete history of the Retab component registry. Newest first.

> This sample is intentionally mixed: prose, GFM tables, task lists, code,
> links, and long release notes all render through the File Viewer Markdown path.

## Viewer Coverage

| Format   | Primary renderer         | Virtualized | Notes                                                                       |
| -------- | ------------------------ | :---------: | --------------------------------------------------------------------------- |
| Markdown | Markdown document viewer |     Yes     | React GFM rendering inside a custom page virtualizer.                       |
| CSV      | CSV viewer               |     Yes     | Large tables keep headers and selection state stable.                       |
| XLSX     | Workbook viewer          |     Yes     | Sheets, merged cells, and numeric alignment share the table infrastructure. |
| JSON     | Code viewer              |     Yes     | Structured text stays fast for long configuration files.                    |
| PDF      | PDF viewer               | Page based  | Canvas pages, thumbnails, and zoom stay synchronized.                       |

## Markdown Checklist

- [x] Render GitHub-flavored Markdown tables.
- [x] Preserve readable wrapped prose for document content.
- [x] Keep code blocks copyable.
- [x] Keep long documents fast while scrolling.
- [x] Render math, callouts, footnotes, and safe inline HTML.

## Example Configuration

```json
{
  "viewer": "markdown-document",
  "renderer": "react-markdown-gfm",
  "virtualization": "page-window",
  "lineNumbers": false
}
```

## Rollout Metrics

| Metric                        |  Before |    After |
| ----------------------------- | ------: | -------: |
| Mounted Markdown nodes        |  2,400+ |      120 |
| First useful paint            |   820ms |    190ms |
| Long-document scroll hitching | visible |     none |
| Table copy support            | partial | complete |

## Rich Markdown

Single newlines now break naturally.
This second sentence stays in the same paragraph source,
but renders on its own line.

Inline math works as $E = mc^2$, and display math works too:

$$
\int_0^1 x^2 dx = \frac{1}{3}
$$

:::warning{title="Migration note"}
The Markdown viewer renders raw HTML only after sanitization. Unsafe scripts,
event handlers, and JavaScript URLs are removed before React receives the tree.
:::

:::tip
Use <kbd>⌘</kbd> + <kbd>F</kbd> to search the rendered document.
:::

<details>
  <summary>Safe HTML example</summary>
  <p><mark>Marked text</mark>, <sub>subscript</sub>, and <sup>superscript</sup>
  are allowed. <script>alert("blocked")</script></p>
</details>

Footnotes are styled and linked.[^virtualization]

[^virtualization]:
    Only visible Markdown pages are mounted; the full source
    remains available for search, copy, and download.

Read more in the [File Viewer docs](/docs/viewers/file-viewer).

## 3.9.0

_2026-06-05_

- Improved viewport virtualization with content-visibility in the **Edit viewer**.
- Shipped bounded-memory bitmap LRU caching in the **XLSX viewer**.
- Refactored off-thread parsing in a Web Worker in the **DOCX viewer**.
- Corrected viewport virtualization with content-visibility in the **Schema builder**.
- Landed off-thread parsing in a Web Worker in the **Run timeline**.
- Introduced merged-cell handling in the **Source linking**.
- Improved bounded-memory bitmap LRU caching in the **Run timeline**.

## 3.8.0

_2026-07-02_

- Introduced fit-to-width zoom in the **Partition viewer**.
- Added bounded-memory bitmap LRU caching in the **JSON table**.
- Refactored viewport virtualization with content-visibility in the **Run timeline**.
- Refactored Suspense-driven loading via React use() in the **PPTX viewer**.
- Improved bounded-memory bitmap LRU caching in the **XLSX viewer**.

## 3.7.0

_2026-10-07_

- Optimized keyboard navigation in the **Property form**.
- Corrected Suspense-driven loading via React use() in the **JSON table**.
- Introduced right-aligned numeric cells in the **Schema builder**.
- Shipped lazy code-splitting of the heavy parser in the **Parse viewer**.
- Corrected fit-to-width zoom in the **Step waterfall**.
- Added lazy code-splitting of the heavy parser in the **Partition viewer**.
- Shipped the slots-based chrome composition model in the **Parse viewer**.

## 3.6.0

_2026-07-02_

- Optimized collapsible side rails in the **Property form**.
- Patched bounded-memory bitmap LRU caching in the **Parse viewer**.
- Reworked viewport virtualization with content-visibility in the **DOCX viewer**.
- Corrected right-aligned numeric cells in the **Consensus view**.

## 3.5.0

_2026-02-02_

- Optimized merged-cell handling in the **Classification viewer**.
- Corrected color-keyed page timelines in the **Consensus view**.
- Fixed high-DPI canvas rendering in the **Segmented viewer**.
- Added high-DPI canvas rendering in the **XLSX viewer**.
- Shipped the slots-based chrome composition model in the **Schema builder**.
- Corrected color-keyed page timelines in the **Parse viewer**.

## 3.4.0

_2026-02-06_

- Patched color-keyed page timelines in the **CSV viewer**.
- Patched right-aligned numeric cells in the **Partition viewer**.
- Corrected per-page overlay citations in the **CSV viewer**.
- Introduced the slots-based chrome composition model in the **Schema builder**.
- Refactored off-thread parsing in a Web Worker in the **Parse viewer**.
- Refactored fit-to-width zoom in the **JSON table**.
- Introduced keyboard navigation in the **Edit viewer**.

## 3.3.0

_2026-06-20_

- Resolved right-aligned numeric cells in the **Extract viewer**.
- Improved high-DPI canvas rendering in the **Consensus view**.
- Reworked keyboard navigation in the **Split viewer**.
- Fixed high-DPI canvas rendering in the **Source linking**.
- Fixed per-page overlay citations in the **DOCX viewer**.
- Landed the slots-based chrome composition model in the **PPTX viewer**.
- Fixed viewport virtualization with content-visibility in the **PDF viewer**.
- Refactored lazy code-splitting of the heavy parser in the **PPTX viewer**.

## 3.2.0

_2026-06-20_

- Introduced bounded-memory bitmap LRU caching in the **Split viewer**.
- Shipped Suspense-driven loading via React use() in the **Step waterfall**.
- Corrected viewport virtualization with content-visibility in the **PPTX viewer**.
- Corrected high-DPI canvas rendering in the **Parse viewer**.

## 3.1.0

_2026-05-03_

- Shipped right-aligned numeric cells in the **JSON form**.
- Resolved lazy code-splitting of the heavy parser in the **PDF viewer**.
- Shipped the slots-based chrome composition model in the **Edit viewer**.
- Shipped merged-cell handling in the **DOCX viewer**.
- Tuned lazy code-splitting of the heavy parser in the **Segmented viewer**.

## 3.0.0

_2026-03-12_

- Optimized collapsible side rails in the **Extract viewer**.
- Resolved bounded-memory bitmap LRU caching in the **File viewer**.
- Landed right-aligned numeric cells in the **Schema builder**.
- Landed Suspense-driven loading via React use() in the **PDF viewer**.
- Shipped high-DPI canvas rendering in the **JSON form**.

## 2.9.0

_2025-04-23_

- Corrected collapsible side rails in the **Segmented viewer**.
- Fixed per-page overlay citations in the **PPTX viewer**.
- Landed per-page overlay citations in the **Property form**.
- Landed bounded-memory bitmap LRU caching in the **Step waterfall**.
- Landed color-keyed page timelines in the **Source linking**.
- Fixed shared hover/selection state across surfaces in the **Consensus view**.
- Landed collapsible side rails in the **File viewer**.
- Resolved keyboard navigation in the **Source linking**.

## 2.8.0

_2025-06-03_

- Corrected right-aligned numeric cells in the **DOCX viewer**.
- Refactored the slots-based chrome composition model in the **CSV viewer**.
- Introduced bounded-memory bitmap LRU caching in the **Classification viewer**.
- Refactored bounded-memory bitmap LRU caching in the **Step waterfall**.
- Patched the slots-based chrome composition model in the **Edit viewer**.
- Refactored off-thread parsing in a Web Worker in the **PDF viewer**.
- Improved lazy code-splitting of the heavy parser in the **CSV viewer**.

## 2.7.0

_2025-07-28_

- Added fit-to-width zoom in the **File viewer**.
- Resolved collapsible side rails in the **Run timeline**.
- Patched lazy code-splitting of the heavy parser in the **Partition viewer**.
- Added color-keyed page timelines in the **Segmented viewer**.
- Corrected shared hover/selection state across surfaces in the **Extract viewer**.

## 2.6.0

_2025-03-18_

- Optimized off-thread parsing in a Web Worker in the **Classification viewer**.
- Added collapsible side rails in the **CSV viewer**.
- Introduced high-DPI canvas rendering in the **Step waterfall**.
- Improved lazy code-splitting of the heavy parser in the **XLSX viewer**.
- Corrected collapsible side rails in the **PPTX viewer**.

## 2.5.0

_2025-09-02_

- Shipped off-thread parsing in a Web Worker in the **PPTX viewer**.
- Reworked lazy code-splitting of the heavy parser in the **PDF viewer**.
- Landed Suspense-driven loading via React use() in the **Step waterfall**.
- Optimized lazy code-splitting of the heavy parser in the **File viewer**.
- Tuned high-DPI canvas rendering in the **Extract viewer**.

## 2.4.0

_2025-09-26_

- Refactored right-aligned numeric cells in the **Extract viewer**.
- Resolved shared hover/selection state across surfaces in the **Classification viewer**.
- Landed viewport virtualization with content-visibility in the **Split viewer**.
- Patched viewport virtualization with content-visibility in the **Consensus view**.
- Landed viewport virtualization with content-visibility in the **File viewer**.
- Tuned collapsible side rails in the **PPTX viewer**.
- Shipped the slots-based chrome composition model in the **JSON form**.

## 2.3.0

_2025-03-15_

- Improved keyboard navigation in the **Parse viewer**.
- Introduced the slots-based chrome composition model in the **Partition viewer**.
- Reworked Suspense-driven loading via React use() in the **Partition viewer**.
- Shipped Suspense-driven loading via React use() in the **DOCX viewer**.
- Tuned off-thread parsing in a Web Worker in the **Property form**.

## 2.2.0

_2025-09-15_

- Improved keyboard navigation in the **Property form**.
- Optimized fit-to-width zoom in the **Extract viewer**.
- Added color-keyed page timelines in the **Schema builder**.
- Added fit-to-width zoom in the **JSON form**.
- Introduced fit-to-width zoom in the **CSV viewer**.
- Patched keyboard navigation in the **CSV viewer**.
- Optimized bounded-memory bitmap LRU caching in the **Parse viewer**.

## 2.1.0

_2025-12-11_

- Fixed collapsible side rails in the **Image viewer**.
- Fixed fit-to-width zoom in the **PDF viewer**.
- Improved collapsible side rails in the **JSON form**.
- Introduced viewport virtualization with content-visibility in the **JSON form**.

## 2.0.0

_2025-02-15_

- Corrected color-keyed page timelines in the **JSON form**.
- Refactored off-thread parsing in a Web Worker in the **Extract viewer**.
- Refactored viewport virtualization with content-visibility in the **Image viewer**.
- Fixed the slots-based chrome composition model in the **File viewer**.

## 1.9.0

_2024-05-21_

- Refactored fit-to-width zoom in the **Classification viewer**.
- Refactored fit-to-width zoom in the **Segmented viewer**.
- Shipped off-thread parsing in a Web Worker in the **PDF viewer**.
- Introduced lazy code-splitting of the heavy parser in the **Parse viewer**.
- Landed viewport virtualization with content-visibility in the **Consensus view**.
- Reworked merged-cell handling in the **Parse viewer**.

## 1.8.0

_2024-09-27_

- Tuned right-aligned numeric cells in the **File viewer**.
- Shipped per-page overlay citations in the **Source linking**.
- Landed Suspense-driven loading via React use() in the **XLSX viewer**.
- Added viewport virtualization with content-visibility in the **Source linking**.
- Tuned keyboard navigation in the **Image viewer**.
- Added merged-cell handling in the **Split viewer**.
- Tuned bounded-memory bitmap LRU caching in the **Schema builder**.

## 1.7.0

_2024-12-10_

- Resolved the slots-based chrome composition model in the **JSON form**.
- Fixed fit-to-width zoom in the **Segmented viewer**.
- Patched per-page overlay citations in the **XLSX viewer**.
- Resolved Suspense-driven loading via React use() in the **Image viewer**.

## 1.6.0

_2024-01-11_

- Landed fit-to-width zoom in the **Extract viewer**.
- Refactored per-page overlay citations in the **Extract viewer**.
- Added fit-to-width zoom in the **DOCX viewer**.
- Landed bounded-memory bitmap LRU caching in the **XLSX viewer**.
- Fixed fit-to-width zoom in the **JSON table**.
- Refactored viewport virtualization with content-visibility in the **Run timeline**.
- Refactored merged-cell handling in the **Step waterfall**.

## 1.5.0

_2024-07-25_

- Reworked the slots-based chrome composition model in the **JSON table**.
- Optimized merged-cell handling in the **CSV viewer**.
- Landed right-aligned numeric cells in the **Extract viewer**.
- Added shared hover/selection state across surfaces in the **Consensus view**.
- Refactored viewport virtualization with content-visibility in the **PDF viewer**.
- Introduced merged-cell handling in the **Segmented viewer**.

## 1.4.0

_2024-02-13_

- Improved merged-cell handling in the **PDF viewer**.
- Optimized merged-cell handling in the **Schema builder**.
- Patched off-thread parsing in a Web Worker in the **Classification viewer**.
- Added merged-cell handling in the **Extract viewer**.
- Landed fit-to-width zoom in the **DOCX viewer**.
- Resolved right-aligned numeric cells in the **File viewer**.
- Landed high-DPI canvas rendering in the **Split viewer**.

## 1.3.0

_2024-02-16_

- Introduced viewport virtualization with content-visibility in the **Step waterfall**.
- Shipped fit-to-width zoom in the **Source linking**.
- Tuned bounded-memory bitmap LRU caching in the **Run timeline**.
- Added high-DPI canvas rendering in the **XLSX viewer**.
- Patched merged-cell handling in the **PPTX viewer**.
- Refactored merged-cell handling in the **Parse viewer**.

## 1.2.0

_2024-05-23_

- Corrected high-DPI canvas rendering in the **Classification viewer**.
- Introduced fit-to-width zoom in the **DOCX viewer**.
- Fixed fit-to-width zoom in the **Classification viewer**.
- Landed fit-to-width zoom in the **Split viewer**.
- Introduced viewport virtualization with content-visibility in the **Run timeline**.
- Introduced right-aligned numeric cells in the **Extract viewer**.
- Patched the slots-based chrome composition model in the **Step waterfall**.
- Optimized fit-to-width zoom in the **PPTX viewer**.

## 1.1.0

_2024-12-12_

- Corrected keyboard navigation in the **PDF viewer**.
- Added high-DPI canvas rendering in the **Consensus view**.
- Corrected fit-to-width zoom in the **CSV viewer**.
- Patched keyboard navigation in the **Property form**.
- Shipped off-thread parsing in a Web Worker in the **Property form**.

## 1.0.0

_2024-06-27_

- Introduced right-aligned numeric cells in the **PDF viewer**.
- Tuned fit-to-width zoom in the **Segmented viewer**.
- Landed keyboard navigation in the **Run timeline**.
- Shipped color-keyed page timelines in the **Partition viewer**.
- Fixed fit-to-width zoom in the **PPTX viewer**.
- Shipped merged-cell handling in the **CSV viewer**.
- Shipped keyboard navigation in the **Extract viewer**.
