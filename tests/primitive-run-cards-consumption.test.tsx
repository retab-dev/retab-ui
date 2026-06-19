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
 * Proof that the Retab dashboard's per-step extract data flows through retab-ui's
 * shared `ExtractRunCard` — with NO change to the dashboard's view-model. Models
 * the dashboard contract verbatim from
 *   frontend/.../runs/projection/step-card-view-model.ts  (ExtractCardViewModel)
 *   frontend/.../runs/utils/extract-run.ts                (NormalizedBbox)
 *   frontend/.../shared/workflows/types/workflows.ts      (RunLifecycleKind)
 *
 * The dashboard deliberately renders count + source boxes (not a field list):
 * its `sourceBboxes` are walked by value with field keys discarded, so there is
 * no per-box (label, value) to project. `ExtractRunCard` now supports that
 * boxes-only shape directly, so the adapter is a pure mapping — no matcher
 * rework, no synthesized labels.
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

interface RunCardThumbnailDocument {
  id: string
  mimeType?: string
}

interface ExtractCardViewModel {
  kind: "extract"
  fieldCount: number
  inputDocument?: RunCardThumbnailDocument
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
  // The vm carries geometry + a count, not field names — so each box becomes a
  // label-less field and the card shows the count chip.
  const fields: ExtractRunCardField[] = (vm.sourceBboxes ?? []).map(
    (box, i) => ({ key: `field-${i}`, source: bboxToSource(box) })
  )
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

  it("turns vm bboxes into normalized pdf_bbox source anchors", () => {
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
    // No field names in the vm → no labels; the card falls back to the count.
    expect(props.fields.every((f) => f.label === undefined)).toBe(true)
    expect(props.fieldCount).toBe(5)
  })

  it("renders the boxes-only extract step through the shared component", () => {
    const props = extractCardViewModelToProps(VM, CTX)
    const { container } = render(<ExtractRunCard {...props} />)

    // status pill from the mapped lifecycle
    expect(screen.getByText("Awaiting review")).toBeTruthy()
    // count chip (vm.fieldCount), not a field list
    expect(screen.getByText("5")).toBeTruthy()
    expect(container.textContent).toContain("fields extracted")
    // one source box per bbox, drawn over the page
    expect(container.querySelector('[title="field-0"]')).toBeTruthy()
    expect(container.querySelector('[title="field-1"]')).toBeTruthy()
  })

  it("still lists labeled fields when a caller provides them (the rich demo)", () => {
    render(
      <ExtractRunCard
        file={{ name: "x.pdf", type: "application/pdf" }}
        previewImageUrl="/x.png"
        fields={[
          {
            key: "account",
            label: "Account number",
            value: "000009752",
            source: bboxToSource(VM.sourceBboxes![0]!),
          },
        ]}
      />
    )
    expect(screen.getByText("Account number")).toBeTruthy()
    expect(screen.getByText("000009752")).toBeTruthy()
  })
})
