"use client";

import { useRef, useState, type ComponentProps } from "react";
import { layout, prepare } from "@chenglou/pretext";
import { useMountEffect } from "@/hooks/useMountEffect";

// === Cycle timing ===
const HERO_CYCLE_S = 38;
const HERO_CURTAIN_AT_S = 34.5;
const HERO_CURTAIN_END_S = 35.3;
const HERO_FLASH_DUR_S = 1.1;
// Two adjacent keyframe stops 1ms apart linearly interpolate over 1ms — the
// eye reads it as an instant snap. Used to fake step transitions inside a
// linear-timed animation.
const HERO_STEP_EPSILON_S = 0.001;

// === Stream typography (must mirror the JSX classes below) ===
const FALLBACK_FONT_SIZE_PX = 13.5;
const FALLBACK_LINE_HEIGHT = 1.55;
const FALLBACK_LINE_HEIGHT_PX = FALLBACK_FONT_SIZE_PX * FALLBACK_LINE_HEIGHT;
// Mirrors --font-roboto-mono in app/globals.css.
const FALLBACK_PRETEXT_FONT = `${FALLBACK_FONT_SIZE_PX}px "SFMono-Regular", "SFMono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
const DIAGRAM_FONT_SIZE_PX = 13;
const DIAGRAM_LINE_HEIGHT = 1.45;
const DIAGRAM_LINE_HEIGHT_PX = DIAGRAM_FONT_SIZE_PX * DIAGRAM_LINE_HEIGHT;
const DIAGRAM_PRETEXT_FONT = `${DIAGRAM_FONT_SIZE_PX}px "SFMono-Regular", "SFMono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
const DIAGRAM_MARGIN_TOP_PX = 12; // mt-3
const DIAGRAM_PADDING_LEFT_PX = 28; // pl-7

// === Stream layout (must mirror the JSX classes below) ===
const ROW_INNER_PADDING_X = 6; // each row's `padding: 1px 6px`
const BEAT_MARGIN_PX = 8; // .mcp-hero-beat margin-top
const ROW_VERTICAL_PADDING = 2; // 1px top + 1px bottom
const SESSION_LEAD_MARGIN_BOTTOM = 20; // mb-5

// Body window height (must mirror the CSS at the bottom of the file).
const BODY_HEIGHT_DESKTOP = 520;
const BODY_HEIGHT_MOBILE = 400;

// === Script ===
type HeroRow =
  | { kind: "prompt"; at: number; text: string; beatStart?: boolean }
  | { kind: "thought"; at: number; text: string; beatStart?: boolean }
  | {
      kind: "call";
      at: number;
      tool: string;
      args?: string;
      beatStart?: boolean;
    }
  | { kind: "args"; at: number; text: string; beatStart?: boolean }
  | {
      kind: "result";
      at: number;
      text: string;
      marker: "ok" | "err" | "info";
      beatStart?: boolean;
    }
  | {
      kind: "final";
      at: number;
      text: string;
      diagram?: readonly string[];
      beatStart?: boolean;
    }
  | { kind: "cursor"; at: number; beatStart?: boolean };

const ROW_INDENT: Record<HeroRow["kind"], number> = {
  prompt: 0,
  thought: 0,
  call: 12, // pl-3
  args: 36, // pl-9
  result: 12, // pl-3
  final: 0,
  cursor: 0,
};

type HeroScriptId = "invoice-review" | "bank-statement-workflow";

type HeroScript = {
  sessionLead: string;
  rows: HeroRow[];
};

// Global script toggle. Switch this value to "invoice-review" to show the
// paused-invoice review script.
const ACTIVE_HERO_SCRIPT_ID: HeroScriptId = "bank-statement-workflow";

const invoiceReviewRows: HeroRow[] = [
  {
    kind: "thought",
    at: 0.5,
    text: "Run run_8af3 is paused for review. Let me see what's going on.",
  },
  {
    kind: "call",
    at: 1.4,
    tool: "workflows_runs_get",
    args: '{ "run_id": "run_8af3" }',
  },
  {
    kind: "result",
    at: 2.4,
    marker: "info",
    text: "status: awaiting_review · paused at review_invoice · 4/6 steps",
  },

  {
    kind: "thought",
    at: 3.3,
    text: "OK, stopped at review_invoice. Pulling the highlights to see what got flagged.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 3.9,
    tool: "workflows_steps_get",
    args: '{ "block_id": "review_invoice" }',
  },
  {
    kind: "result",
    at: 5.0,
    marker: "info",
    text: "2 highlights · products[3].ean (low_confidence) · header.bank_iban (schema)",
  },

  {
    kind: "thought",
    at: 6.0,
    text: "EAN at low confidence is the real concern — schema mismatches on IBAN are usually formatting noise. Let me look at the actual extracted product.",
    beatStart: true,
  },
  { kind: "call", at: 6.9, tool: "workflows_steps_get" },
  {
    kind: "args",
    at: 7.3,
    text: '{ "block_id": "extract_invoice", "path": "output.products[3]" }',
  },
  {
    kind: "result",
    at: 8.4,
    marker: "info",
    text: 'ean: "501234567890" · likelihoods.ean: 0.42 · qty: 6 · unit: 41.00',
  },

  {
    kind: "thought",
    at: 9.4,
    text: "Twelve digits — but EANs are usually 13. Either the schema is wrong or we lost a digit. Sourcing the original to see.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 10.2,
    tool: "files_get_sources",
    args: '{ "extraction_id": "ext_2c91", "path": "products[3].ean" }',
  },
  {
    kind: "result",
    at: 11.2,
    marker: "ok",
    text: "pdf_bbox { page: 4, left: 0.18, top: 0.62, width: 0.10 }",
  },

  {
    kind: "thought",
    at: 12.1,
    text: "I have the bbox. Grepping the prefix to see what's actually printed.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 12.7,
    tool: "files_grep",
    args: '{ "file_id": "file_a1b2", "pattern": "5012345" }',
  },
  {
    kind: "result",
    at: 13.7,
    marker: "ok",
    text: '"5012345678903" · the extracted value dropped the trailing digit',
  },

  {
    kind: "thought",
    at: 14.7,
    text: "Right. Quick visual on page 4 to be sure before patching.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 15.2,
    tool: "files_inspect",
    args: '{ "args": { "kind": "pdf_image", "pages": [4] } }',
  },
  {
    kind: "result",
    at: 16.2,
    marker: "ok",
    text: "rendered page 4 · reading: 5012345678903",
  },

  {
    kind: "thought",
    at: 17.1,
    text: "Confirmed on the page. Submitting the correction; leaving the IBAN flag alone since the value's actually fine.",
    beatStart: true,
  },
  { kind: "call", at: 17.9, tool: "workflows_reviews_versions_create" },
  {
    kind: "args",
    at: 18.4,
    text: '{ "review_id": "rev_...", "parent_id": "ver_...", "snapshot": { "products": [{ "ean": "5012345678903" }] } }',
  },
  {
    kind: "result",
    at: 19.6,
    marker: "ok",
    text: 'created version "ver_..."',
  },
  { kind: "call", at: 20.2, tool: "workflows_reviews_approve" },
  {
    kind: "args",
    at: 20.7,
    text: '{ "id": "rev_...", "version_id": "ver_..." }',
  },
  {
    kind: "result",
    at: 21.9,
    marker: "ok",
    text: "submission_status: accepted · resume_status: resumed",
  },

  {
    kind: "thought",
    at: 20.5,
    text: "Submitted. Re-pulling the run to confirm it's unblocked.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 21.1,
    tool: "workflows_runs_get",
    args: '{ "run_id": "run_8af3" }',
  },
  {
    kind: "result",
    at: 22.1,
    marker: "ok",
    text: "status: completed · 6/6 steps · 4.7s",
  },

  {
    kind: "final",
    at: 23.0,
    text: "Done. Review handled without a human — only real fix was the dropped EAN digit.",
    beatStart: true,
  },
];

const bankStatementWorkflowRows: HeroRow[] = [
  {
    kind: "thought",
    at: 0.5,
    text: "Let's inspect this bank statement and turn the repeatable parts into a workflow.",
  },
  {
    kind: "call",
    at: 1.4,
    tool: "files_inspect",
    args: '{ "file_id": "stmt_042", "args": { "kind": "pdf_image", "pages": [1] } }',
  },
  {
    kind: "result",
    at: 2.4,
    marker: "info",
    text: "3-page statement · checking account · May 2026 · two-column transaction table",
  },

  {
    kind: "thought",
    at: 3.3,
    text: "I need the stable anchors first: account holder, statement period, balances, and transaction rows.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 3.9,
    tool: "files_grep",
    args: '{ "file_id": "stmt_042", "pattern": "Opening balance|Closing balance|Deposits|Withdrawals" }',
  },
  {
    kind: "result",
    at: 5.0,
    marker: "ok",
    text: "anchors found · opening balance · deposits · withdrawals · closing balance",
  },

  {
    kind: "thought",
    at: 6.0,
    text: "The layout is consistent. I'll create a workflow, then add an extract node for the fields and transaction rows.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 6.8,
    tool: "workflows_create",
    args: '{ "name": "bank_statement_reconciliation" }',
  },
  {
    kind: "result",
    at: 7.8,
    marker: "ok",
    text: "workflow_id: wf_bank_stmt · draft created",
  },
  {
    kind: "call",
    at: 8.5,
    tool: "workflows_blocks_create",
    args: '{ "workflow_id": "wf_bank_stmt", "type": "extract", "label": "extract_transactions", "config": { "json_schema": "bank_statement_v1" } }',
  },
  {
    kind: "result",
    at: 9.5,
    marker: "ok",
    text: "extract_transactions · account fields and transactions[] configured",
  },

  {
    kind: "thought",
    at: 10.4,
    text: "Next I need a function node to reconcile running balances and flag missing dates.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 11.2,
    tool: "workflows_blocks_create",
    args: '{ "workflow_id": "wf_bank_stmt", "type": "function", "label": "balance_check" }',
  },
  {
    kind: "result",
    at: 12.2,
    marker: "ok",
    text: "balance_check · duplicate transaction guard · required date guard",
  },
  {
    kind: "call",
    at: 13.0,
    tool: "workflows_edges_create",
    args: '{ "workflow_id": "wf_bank_stmt", "source": "extract_transactions", "target": "balance_check" }',
  },
  {
    kind: "result",
    at: 14.0,
    marker: "ok",
    text: "extract_transactions -> balance_check",
  },

  {
    kind: "thought",
    at: 15.0,
    text: "Let's run the sample through the draft workflow and see if the validation catches anything.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 15.8,
    tool: "workflows_runs_create",
    args: '{ "workflow_id": "wf_bank_stmt", "version": "draft", "inputs": { "start": "stmt_042" } }',
  },
  {
    kind: "result",
    at: 16.8,
    marker: "info",
    text: "run_91bd · extracting transactions · running balance function",
  },
  {
    kind: "call",
    at: 17.7,
    tool: "workflows_runs_get",
    args: '{ "run_id": "run_91bd" }',
  },
  {
    kind: "result",
    at: 18.7,
    marker: "ok",
    text: "status: completed · 143 transactions · balance_check passed",
  },

  {
    kind: "thought",
    at: 19.7,
    text: "Good. I'll add a review gate only for balance mismatches or rows with missing dates.",
    beatStart: true,
  },
  {
    kind: "call",
    at: 20.5,
    tool: "workflows_blocks_update",
    args: '{ "block_id": "balance_check", "config": { "review": { "predicate": { "kind": "validation_failed" } } } }',
  },
  {
    kind: "result",
    at: 21.5,
    marker: "ok",
    text: "config.review · triggers only on reconciliation failures",
  },
  {
    kind: "final",
    at: 22.8,
    text: "Workflow drafted: bank statement reconciliation.",
    diagram: [
      "[PDF bank statement]",
      "        |",
      "        v",
      "[extract fields + transactions]",
      "        |",
      "        v",
      "[function node: balance check] ----fail----> [review gate]",
      "        | pass",
      "        v",
      "[clean transaction JSON]",
    ],
    beatStart: true,
  },
];

const HERO_SCRIPTS: Record<HeroScriptId, HeroScript> = {
  "invoice-review": {
    sessionLead:
      "inspect the paused invoice review and fix only the real issue",
    rows: invoiceReviewRows,
  },
  "bank-statement-workflow": {
    sessionLead: "Create a workflow to extract data from bank statements",
    rows: bankStatementWorkflowRows,
  },
};

const activeHeroScript = HERO_SCRIPTS[ACTIVE_HERO_SCRIPT_ID];
const lastScriptRow = activeHeroScript.rows[activeHeroScript.rows.length - 1];
const heroRows: HeroRow[] = [
  ...activeHeroScript.rows,
  { kind: "cursor", at: lastScriptRow.at + 0.6 },
];

// SSR / pre-hydration fallback. Hand-tuned for a ~580px-wide content area;
// good enough to look right before pretext refines on mount.
type Snap = { at: number; y: number };
type StreamMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  font: string;
  lineHeightPx: number;
};
const DEFAULT_SNAPS: ReadonlyArray<Snap> = [
  { at: 14.7, y: 25 },
  { at: 15.2, y: 50 },
  { at: 16.2, y: 75 },
  { at: 17.1, y: 120 },
  { at: 17.9, y: 145 },
  { at: 18.4, y: 190 },
  { at: 19.6, y: 215 },
  { at: 20.5, y: 245 },
  { at: 21.1, y: 270 },
  { at: 22.1, y: 295 },
  { at: 23.0, y: 340 },
];

// === Helpers ===
function pct(seconds: number): string {
  return `${(seconds / HERO_CYCLE_S) * 100}%`;
}

function rowVisibleText(row: HeroRow): string {
  switch (row.kind) {
    case "prompt":
      return `$ ${row.text}`;
    case "thought":
      return `⏺ ${row.text}`;
    case "call":
      return `↳ ${row.tool}${row.args ? " " + row.args : ""}`;
    case "args":
      return row.text;
    case "result": {
      const mark =
        row.marker === "ok" ? "✓ " : row.marker === "err" ? "✗ " : "";
      return `⎿ ${mark}${row.text}`;
    }
    case "final":
      return `⏺ ${row.text}`;
    case "cursor":
      return `▎`;
  }
}

function measureRowHeight(
  row: HeroRow,
  innerWidth: number,
  metrics: StreamMetrics,
): number {
  const prepared = prepare(rowVisibleText(row), metrics.font);
  const { height } = layout(prepared, innerWidth, metrics.lineHeightPx);

  if (row.kind !== "final" || !row.diagram) {
    return height;
  }

  const diagramWidth = Math.max(1, innerWidth - DIAGRAM_PADDING_LEFT_PX);
  const diagramHeight = row.diagram.reduce((sum, line) => {
    const diagramPrepared = prepare(line, DIAGRAM_PRETEXT_FONT);
    const { height: lineHeight } = layout(
      diagramPrepared,
      diagramWidth,
      DIAGRAM_LINE_HEIGHT_PX,
    );
    return sum + lineHeight;
  }, 0);

  return height + DIAGRAM_MARGIN_TOP_PX + diagramHeight;
}

// Measure each row's rendered height with pretext using the actual transcript
// pane dimensions and computed CSS. Rows, including the cursor row, snap so
// their bottom edge lands at the visible content bottom.
function computeSnaps(metrics: StreamMetrics): Snap[] {
  let cumulativeY = 0;
  const snaps: Snap[] = [];
  const contentWidth =
    metrics.viewportWidth - metrics.paddingLeft - metrics.paddingRight;
  const viewportBottomTarget = metrics.viewportHeight - metrics.paddingBottom;

  const leadPrepared = prepare(
    `> ${activeHeroScript.sessionLead}`,
    metrics.font,
  );
  const { height: leadHeight } = layout(
    leadPrepared,
    contentWidth,
    metrics.lineHeightPx,
  );
  cumulativeY += leadHeight + SESSION_LEAD_MARGIN_BOTTOM;

  for (const row of heroRows) {
    if (row.beatStart) cumulativeY += BEAT_MARGIN_PX;

    const indent = ROW_INDENT[row.kind];
    const innerWidth = contentWidth - indent - 2 * ROW_INNER_PADDING_X;
    if (innerWidth <= 0) continue;

    const height = measureRowHeight(row, innerWidth, metrics);

    cumulativeY += height + ROW_VERTICAL_PADDING;

    const target = Math.max(
      0,
      cumulativeY + metrics.paddingTop - viewportBottomTarget,
    );
    if (target <= 0) continue;
    const prev = snaps[snaps.length - 1];
    // Only emit if strictly greater than the previous snap (scroll only ever
    // goes up). Avoids redundant or backward keyframes.
    if (!prev || target > prev.y) {
      snaps.push({ at: row.at, y: target });
    }
  }

  return snaps;
}

function generateRowKeyframes(): string {
  return heroRows
    .map((row, i) => {
      const beforeAppear = Math.max(0, row.at - HERO_STEP_EPSILON_S);
      const flashEnd = Math.min(row.at + HERO_FLASH_DUR_S, HERO_CURTAIN_AT_S);
      const flashColor =
        row.kind === "result" && row.marker === "err"
          ? "var(--mcp-hero-flash-error)"
          : row.kind === "result" && row.marker === "ok"
            ? "var(--mcp-hero-flash-ok)"
            : row.kind === "result" && row.marker === "info"
              ? "var(--mcp-hero-flash-info)"
              : "transparent";

      return `
        @keyframes mcp-hero-row-${i} {
          0% { opacity: 0; background-color: transparent; }
          ${pct(beforeAppear)} { opacity: 0; background-color: transparent; }
          ${pct(row.at)} { opacity: 1; background-color: ${flashColor}; }
          ${pct(flashEnd)} { opacity: 1; background-color: transparent; }
          ${pct(HERO_CURTAIN_AT_S)} { opacity: 1; background-color: transparent; }
          ${pct(HERO_CURTAIN_END_S)} { opacity: 0; background-color: transparent; }
          100% { opacity: 0; background-color: transparent; }
        }
        .mcp-hero-row-${i} {
          animation: mcp-hero-row-${i} ${HERO_CYCLE_S}s linear infinite;
        }
      `;
    })
    .join("\n");
}

function generateScrollKeyframes(snaps: ReadonlyArray<Snap>): string {
  const lines: string[] = [`0% { transform: translateY(0); }`];
  let prevY = 0;
  for (const snap of snaps) {
    lines.push(
      `${pct(snap.at - HERO_STEP_EPSILON_S)} { transform: translateY(-${prevY}px); }`,
    );
    lines.push(`${pct(snap.at)} { transform: translateY(-${snap.y}px); }`);
    prevY = snap.y;
  }
  lines.push(
    `${pct(HERO_CURTAIN_AT_S)} { transform: translateY(-${prevY}px); }`,
  );
  lines.push(
    `${pct(HERO_CURTAIN_END_S)} { transform: translateY(-${prevY}px); }`,
  );
  lines.push(
    `${pct(HERO_CURTAIN_END_S + HERO_STEP_EPSILON_S)} { transform: translateY(0); }`,
  );
  lines.push(`100% { transform: translateY(0); }`);
  return `@keyframes mcp-hero-stream-scroll {\n  ${lines.join("\n  ")}\n}`;
}

// Word-level token streaming for thought rows. Splits text into "Word "
// chunks (each word carries its trailing whitespace), spreads them across the
// window between the thought's `at` time and the next call's `at`, then emits
// per-token opacity keyframes. Mirrors how an LLM streams tokens to the user
// — visible chunks ~30ms apart, finishing just before the agent issues the
// next tool call.
function splitIntoTokens(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

type ThoughtToken = {
  text: string;
  at: number;
  rowIdx: number;
  tokIdx: number;
};

function buildThoughtTokens(): ThoughtToken[] {
  const tokens: ThoughtToken[] = [];
  for (let rowIdx = 0; rowIdx < heroRows.length; rowIdx++) {
    const row = heroRows[rowIdx];
    if (row.kind !== "thought") continue;

    // Stream up until just before the next decision-point (the call this
    // thought leads into) or, lacking one, the curtain.
    const nextDecision = heroRows
      .slice(rowIdx + 1)
      .find((r) => r.kind === "call" || r.kind === "args");
    const windowEnd = (nextDecision?.at ?? HERO_CURTAIN_AT_S) - 0.1;
    const windowDur = Math.max(0.2, windowEnd - row.at);

    const split = splitIntoTokens(row.text);
    const interval = windowDur / split.length;

    for (let tokIdx = 0; tokIdx < split.length; tokIdx++) {
      tokens.push({
        text: split[tokIdx],
        at: row.at + tokIdx * interval,
        rowIdx,
        tokIdx,
      });
    }
  }
  return tokens;
}

const HERO_TOKENS = buildThoughtTokens();
const HERO_TOKENS_BY_ROW = HERO_TOKENS.reduce<Map<number, ThoughtToken[]>>(
  (acc, tok) => {
    const list = acc.get(tok.rowIdx);
    if (list) list.push(tok);
    else acc.set(tok.rowIdx, [tok]);
    return acc;
  },
  new Map(),
);

function generateTokenKeyframes(): string {
  return HERO_TOKENS.map((token) => {
    const beforeAppear = Math.max(0, token.at - HERO_STEP_EPSILON_S);
    return `
      @keyframes mcp-hero-tok-${token.rowIdx}-${token.tokIdx} {
        0% { opacity: 0; }
        ${pct(beforeAppear)} { opacity: 0; }
        ${pct(token.at)} { opacity: 1; }
        ${pct(HERO_CURTAIN_AT_S)} { opacity: 1; }
        ${pct(HERO_CURTAIN_END_S)} { opacity: 0; }
        100% { opacity: 0; }
      }
      .mcp-hero-tok-${token.rowIdx}-${token.tokIdx} {
        animation: mcp-hero-tok-${token.rowIdx}-${token.tokIdx} ${HERO_CYCLE_S}s linear infinite;
      }
    `;
  }).join("\n");
}

// === Components ===
function HeroRowEl({ row, index }: { row: HeroRow; index: number }) {
  const beat = row.beatStart ? "mcp-hero-beat" : "";
  const cls = `mcp-hero-row mcp-hero-row-${index} ${beat}`.trim();

  if (row.kind === "prompt") {
    return (
      <div className={cls}>
        <span className="mcp-hero-muted">$ </span>
        <span className="mcp-hero-strong">{row.text}</span>
      </div>
    );
  }

  if (row.kind === "thought") {
    const tokens = HERO_TOKENS_BY_ROW.get(index) ?? [];
    return (
      <div className={cls}>
        <span className="mcp-hero-bullet mr-2">●</span>
        <span className="mcp-hero-thought">
          {tokens.map((tok) => (
            <span
              key={tok.tokIdx}
              className={`mcp-hero-tok-${tok.rowIdx}-${tok.tokIdx}`}
            >
              {tok.text}
            </span>
          ))}
        </span>
      </div>
    );
  }

  if (row.kind === "call") {
    return (
      <div className={`${cls} pl-3`}>
        <span className="mcp-hero-gutter mr-2">↳</span>
        <span className="mcp-hero-tool">{row.tool}</span>
        {row.args ? (
          <span className="mcp-hero-args ml-2">{row.args}</span>
        ) : null}
      </div>
    );
  }

  if (row.kind === "args") {
    return <div className={`${cls} mcp-hero-args pl-9`}>{row.text}</div>;
  }

  if (row.kind === "result") {
    const marker =
      row.marker === "ok" ? (
        <span className="mcp-hero-ok mr-1">✓</span>
      ) : row.marker === "err" ? (
        <span className="mcp-hero-error mr-1">✗</span>
      ) : null;
    const body =
      row.marker === "err"
        ? "mcp-hero-error"
        : row.marker === "info"
          ? "mcp-hero-info"
          : "mcp-hero-result";
    return (
      <div className={`${cls} rounded-sm pl-3`}>
        <span className="mcp-hero-gutter mr-2">⎿</span>
        {marker}
        <span className={body}>{row.text}</span>
      </div>
    );
  }

  if (row.kind === "final") {
    return (
      <div className={cls}>
        <span className="mcp-hero-bullet mr-2">●</span>
        <span className="mcp-hero-final font-medium">{row.text}</span>
        {row.diagram ? (
          <pre className="mcp-hero-thought mt-3 pl-7 font-mono text-[13px] leading-[1.45] whitespace-pre-wrap">
            {row.diagram.join("\n")}
          </pre>
        ) : null}
      </div>
    );
  }

  if (row.kind === "cursor") {
    return (
      <div className={`${cls} flex items-center gap-2 pt-1`}>
        <span className="mcp-hero-faint">▎</span>
        <span className="mcp-hero-cursor inline-block h-[15px] w-[7px] translate-y-[2px]" />
      </div>
    );
  }

  return null;
}

function ClaudeCodeLogo({ style, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      height="1em"
      style={{ flex: "none", lineHeight: 1, ...style }}
      viewBox="0 0 24 24"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Antigravity</title>
      <path
        clipRule="evenodd"
        d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}

function ClaudeCodeIntro() {
  return (
    <div className="px-6 pt-[21px] pb-[18px] max-sm:px-[15px] max-sm:pt-[15px] max-sm:pb-[14px]">
      <div className="flex items-center gap-5">
        <ClaudeCodeLogo
          className="mcp-hero-accent h-10 w-16 shrink-0 max-sm:h-8 max-sm:w-12"
          aria-hidden={true}
        />
        <div className="min-w-0 font-mono">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="mcp-hero-strong text-[15px] font-semibold max-sm:text-[13px]">
              Claude Code
            </span>
            <span className="mcp-hero-muted text-[13px] max-sm:text-[12px]">
              v2.1.3
            </span>
          </div>
          <p className="mcp-hero-muted mt-2 text-[13.5px] max-sm:text-[12px]">
            Opus 4.7
          </p>
        </div>
      </div>
    </div>
  );
}

export function HeroTerminal() {
  const streamRef = useRef<HTMLDivElement>(null);
  const [snaps, setSnaps] = useState<ReadonlyArray<Snap>>(DEFAULT_SNAPS);

  // One-time setup + resize handling: pretext measures rows via Canvas using
  // the transcript pane's actual computed typography, padding, and viewport.
  useMountEffect(() => {
    const el = streamRef.current;
    if (!el) return;

    const measureAndSet = () => {
      const streamEl = el.querySelector<HTMLElement>(".mcp-hero-stream");
      if (!streamEl) return;

      const width = el.clientWidth;
      const height = el.clientHeight;
      const style = window.getComputedStyle(streamEl);
      if (width > 0 && height > 0) {
        const next = computeSnaps({
          viewportWidth: width,
          viewportHeight: height,
          paddingTop: Number.parseFloat(style.paddingTop) || 0,
          paddingRight: Number.parseFloat(style.paddingRight) || 0,
          paddingBottom: Number.parseFloat(style.paddingBottom) || 0,
          paddingLeft: Number.parseFloat(style.paddingLeft) || 0,
          font: style.font || FALLBACK_PRETEXT_FONT,
          lineHeightPx:
            Number.parseFloat(style.lineHeight) || FALLBACK_LINE_HEIGHT_PX,
        });
        setSnaps((prev) =>
          prev.length === next.length &&
          prev.every((s, i) => s.at === next[i].at && s.y === next[i].y)
            ? prev
            : next,
        );
      }
    };

    measureAndSet();
    const ro = new ResizeObserver(measureAndSet);
    ro.observe(el);
    return () => ro.disconnect();
  });

  return (
    <div className="mcp-hero-panel relative max-w-full min-w-0 overflow-hidden rounded-md border">
      <div className="mcp-hero-titlebar relative flex items-center border-b p-2">
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="mcp-hero-window-title pointer-events-none absolute inset-x-16 text-center font-mono text-[13px] leading-none tracking-[0.04em]">
          Terminal
        </div>
      </div>

      <div className="mcp-hero-body flex flex-col">
        <ClaudeCodeIntro />
        <div className="mcp-hero-separator h-px" aria-hidden={true} />
        <div
          ref={streamRef}
          className="mcp-hero-window relative min-h-0 flex-1 overflow-hidden"
        >
          <div className="mcp-hero-stream px-6 py-[18px] font-mono text-[13.5px] leading-[1.55] max-sm:px-[15px] max-sm:py-[14px] max-sm:text-[12px]">
            <div className="mcp-hero-session-lead mb-5">
              &gt; {activeHeroScript.sessionLead}
            </div>
            {heroRows.map((row, index) => (
              <HeroRowEl key={index} row={row} index={index} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .mcp-hero-panel {
          --mcp-hero-surface: #ffffff;
          --mcp-hero-titlebar: #fafafa;
          --mcp-hero-border: rgba(24, 24, 27, 0.11);
          --mcp-hero-separator: rgba(24, 24, 27, 0.08);
          --mcp-hero-strong: #27272a;
          --mcp-hero-text: #52525b;
          --mcp-hero-muted: #8a8a91;
          --mcp-hero-faint: #b5b5bc;
          --mcp-hero-tool: #c15f43;
          --mcp-hero-accent: #d97757;
          --mcp-hero-ok: #168044;
          --mcp-hero-error: #dc2626;
          --mcp-hero-flash-error: rgba(244, 63, 94, 0.09);
          --mcp-hero-flash-ok: rgba(22, 163, 74, 0.09);
          --mcp-hero-flash-info: rgba(217, 119, 87, 0.10);

          color: var(--mcp-hero-text);
          background: var(--mcp-hero-surface);
          border-color: var(--mcp-hero-border);
          box-shadow:
            0 1px 2px rgba(24, 24, 27, 0.04),
            0 18px 48px rgba(24, 24, 27, 0.08);
        }

        .dark .mcp-hero-panel {
          --mcp-hero-surface: #282826;
          --mcp-hero-titlebar: #232321;
          --mcp-hero-border: rgba(255, 255, 255, 0.08);
          --mcp-hero-separator: rgba(255, 255, 255, 0.06);
          --mcp-hero-strong: #d6d4cf;
          --mcp-hero-text: #aaa9a5;
          --mcp-hero-muted: #777571;
          --mcp-hero-faint: #6e6d69;
          --mcp-hero-tool: #e0835e;
          --mcp-hero-accent: #d97757;
          --mcp-hero-ok: #74b98f;
          --mcp-hero-error: #fb7185;
          --mcp-hero-flash-error: rgba(244, 63, 94, 0.18);
          --mcp-hero-flash-ok: rgba(16, 185, 129, 0.18);
          --mcp-hero-flash-info: rgba(245, 158, 11, 0.16);

          box-shadow:
            0 1px 1px rgba(0, 0, 0, 0.22),
            0 18px 48px rgba(0, 0, 0, 0.24);
        }

        .mcp-hero-titlebar {
          background: linear-gradient(180deg, var(--mcp-hero-titlebar), var(--mcp-hero-surface));
          border-color: var(--mcp-hero-border);
        }

        .mcp-hero-window {
          background: var(--mcp-hero-surface);
        }

        .mcp-hero-separator {
          background: var(--mcp-hero-separator);
        }

        .mcp-hero-window-title,
        .mcp-hero-muted {
          color: var(--mcp-hero-muted);
        }

        .mcp-hero-strong,
        .mcp-hero-final,
        .mcp-hero-session-lead {
          color: var(--mcp-hero-strong);
        }

        .mcp-hero-thought,
        .mcp-hero-info,
        .mcp-hero-result {
          color: var(--mcp-hero-text);
        }

        .mcp-hero-gutter,
        .mcp-hero-bullet,
        .mcp-hero-faint {
          color: var(--mcp-hero-faint);
        }

        .mcp-hero-tool {
          color: var(--mcp-hero-tool);
        }

        .mcp-hero-accent {
          color: var(--mcp-hero-accent);
        }

        .mcp-hero-args {
          color: var(--mcp-hero-muted);
        }

        .mcp-hero-ok {
          color: var(--mcp-hero-ok);
        }

        .mcp-hero-error {
          color: var(--mcp-hero-error);
        }

        .mcp-hero-body { height: ${BODY_HEIGHT_DESKTOP}px; }

        .mcp-hero-stream {
          animation: mcp-hero-stream-scroll ${HERO_CYCLE_S}s linear infinite;
          will-change: transform;
        }
        ${generateScrollKeyframes(snaps)}

        .mcp-hero-row {
          opacity: 0;
          padding: 1px ${ROW_INNER_PADDING_X}px;
          border-radius: 4px;
          will-change: opacity, background-color;
        }
        .mcp-hero-beat { margin-top: ${BEAT_MARGIN_PX}px; }

        .mcp-hero-cursor {
          animation: mcp-hero-cursor-blink 1.05s steps(2, end) infinite;
          background: var(--mcp-hero-accent);
        }
        @keyframes mcp-hero-cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        ${generateRowKeyframes()}
        ${generateTokenKeyframes()}

        @media (max-width: 640px) {
          .mcp-hero-body { height: ${BODY_HEIGHT_MOBILE}px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .mcp-hero-stream { animation: none !important; transform: none !important; }
          .mcp-hero-row {
            opacity: 1 !important;
            animation: none !important;
            background-color: transparent !important;
          }
          [class*="mcp-hero-tok-"] {
            opacity: 1 !important;
            animation: none !important;
          }
          .mcp-hero-cursor { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
