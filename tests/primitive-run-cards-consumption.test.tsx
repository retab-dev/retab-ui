// @vitest-environment jsdom
import * as React from "react"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import {
  ExtractRunCard,
  type ExtractRunCardField,
  type ExtractRunCardProps,
} from "@/components/ui/primitive-run-cards"
import type { RunStatus } from "@/components/ui/run-card"
import type { Source } from "@/lib/document-source"

/**
 * Proof that the Retab dashboard's per-step extract data flows through
 * retab-ui's shared `ExtractRunCard`. Models the dashboard contract from
 *   frontend/.../runs/projection/step-card-view-model.ts  (ExtractCardViewModel)
 *   frontend/.../runs/utils/extract-run.ts                (NormalizedBbox)
 *   frontend/.../shared/workflows/types/workflows.ts      (RunLifecycleKind)
 *
 * The dashboard now carries rich first-page field summaries when the matcher
 * returns labels/values, while still supporting the older boxes-only fallback.
 * `ExtractRunCard` supports both shapes directly.
 */

// ── dashboard contract (mirrored) ─────────────────────────────────────────────
type RunLifecycleKind =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "awaiting_review"
  | "cancelled"

interface NormalizedBbox {
  left: number
  top: number
  width: number
  height: number
}

interface ExtractFieldSummary {
  key: string
  label: string
  value: string
  sourceBbox: NormalizedBbox
}

interface RunCardThumbnailDocument {
  id: string
  mimeType?: string
}

interface ExtractCardViewModel {
  kind: "extract"
  fieldCount: number
  inputDocument?: RunCardThumbnailDocument
  fields?: ExtractFieldSummary[]
  sourceBboxes?: NormalizedBbox[]
}

// ── adapter (copy into the dashboard once @retab/primitive-run-cards installs) ──

/**
 * Lifecycle → RunStatus. This *compiles* only because retab-ui's `RunStatus` is
 * a superset of the backend lifecycle (`error` → `failed`; the rest are 1:1) —
 * the type-check is the proof the two status vocabularies converged.
 */
function toRunStatus(kind: RunLifecycleKind): RunStatus {
  return kind === "error" ? "failed" : kind
}

/** A page bbox the dashboard already normalizes to [0,1] → a pdf_bbox `Source`. */
function bboxToSource(box: NormalizedBbox): Source {
  return { content: "", anchor: { kind: "pdf_bbox", page: 1, ...box } }
}

function fieldSummaryToField(field: ExtractFieldSummary): ExtractRunCardField {
  return {
    key: field.key,
    label: field.label,
    value: field.value,
    source: bboxToSource(field.sourceBbox),
  }
}

interface ExtractRunCardContext {
  fileName: string
  fileType: string
  previewImageUrl: string
  status: RunLifecycleKind
}

function extractCardViewModelToProps(
  vm: ExtractCardViewModel,
  ctx: ExtractRunCardContext
): ExtractRunCardProps {
  const richFields = (vm.fields ?? []).map(fieldSummaryToField)
  const fields: ExtractRunCardField[] =
    richFields.length > 0
      ? richFields
      : (vm.sourceBboxes ?? []).map((box, i) => ({
          key: `field-${i}`,
          source: bboxToSource(box),
        }))
  return {
    file: { name: ctx.fileName, type: ctx.fileType },
    previewImageUrl: ctx.previewImageUrl,
    fieldCount: vm.fieldCount,
    fields,
    status: toRunStatus(ctx.status),
  }
}

// ── jsdom shims so FileThumbnail mounts (it observes intersection/resize) ──────
beforeAll(() => {
  class NoopObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  for (const name of ["IntersectionObserver", "ResizeObserver"] as const) {
    if (!(name in globalThis)) {
      // @ts-expect-error test shim
      globalThis[name] = NoopObserver
    }
  }
})

afterEach(cleanup)

const VM: ExtractCardViewModel = {
  kind: "extract",
  fieldCount: 5,
  inputDocument: { id: "doc_1", mimeType: "application/pdf" },
  fields: [
    {
      key: "account_number",
      label: "Account number",
      value: "000009752",
      sourceBbox: { left: 0.1, top: 0.1, width: 0.2, height: 0.05 },
    },
    {
      key: "statement_date",
      label: "Statement date",
      value: "July 8, 2003",
      sourceBbox: { left: 0.5, top: 0.3, width: 0.15, height: 0.04 },
    },
  ],
  sourceBboxes: [
    { left: 0.1, top: 0.1, width: 0.2, height: 0.05 },
    { left: 0.5, top: 0.3, width: 0.15, height: 0.04 },
  ],
}

const CTX: ExtractRunCardContext = {
  fileName: "bank-statement.pdf",
  fileType: "application/pdf",
  previewImageUrl: "/samples/bank-statement-page-1.png",
  status: "awaiting_review",
}

describe("ExtractCardViewModel → ExtractRunCard", () => {
  it("maps lifecycle status onto the shared RunStatus superset", () => {
    expect(toRunStatus("error")).toBe("failed")
    expect(toRunStatus("awaiting_review")).toBe("awaiting_review")
    expect(toRunStatus("completed")).toBe("completed")
    expect(toRunStatus("cancelled")).toBe("cancelled")
  })

  it("turns rich vm fields into labeled source anchors", () => {
    const props = extractCardViewModelToProps(VM, { ...CTX, status: "completed" })
    expect(props.fields).toHaveLength(2)
    expect(props.fields[0]!.source.anchor).toMatchObject({
      kind: "pdf_bbox",
      page: 1,
      left: 0.1,
      top: 0.1,
      width: 0.2,
      height: 0.05,
    })
    expect(props.fields[0]!.label).toBe("Account number")
    expect(props.fields[0]!.value).toBe("000009752")
    expect(props.fieldCount).toBe(5)
  })

  it("renders the rich extract step through the shared component", () => {
    const props = extractCardViewModelToProps(VM, CTX)
    const { container } = render(
      <ExtractRunCard {...props} className="rounded-none border-0" />
    )

    // status pill from the mapped lifecycle
    expect(screen.getByText("Awaiting review")).toBeTruthy()
    expect(screen.getByText("Account number")).toBeTruthy()
    expect(screen.getByText("000009752")).toBeTruthy()
    expect(screen.getByText("Statement date")).toBeTruthy()
    expect(screen.getByText("July 8, 2003")).toBeTruthy()
    expect(container.textContent).toContain("+3 more fields")
    // one source box per bbox, drawn over the page
    expect(
      container.querySelector('[title="Account number: 000009752"]')
    ).toBeTruthy()
    expect(
      container.querySelector('[title="Statement date: July 8, 2003"]')
    ).toBeTruthy()
    const runCard = container.querySelector('[data-slot="run-card"]')
    expect(runCard?.className).toContain("rounded-none")
    expect(runCard?.className).toContain("border-0")
  })

  it("falls back to the boxes-only count when no field summaries are available", () => {
    const props = extractCardViewModelToProps({ ...VM, fields: undefined }, CTX)
    const { container } = render(<ExtractRunCard {...props} />)

    expect(screen.getByText("5")).toBeTruthy()
    expect(container.textContent).toContain("fields extracted")
    expect(container.querySelector('[title="field-0"]')).toBeTruthy()
    expect(container.querySelector('[title="field-1"]')).toBeTruthy()
  })
})
