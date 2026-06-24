import type { CSSProperties, ReactNode } from "react";

import { mono, PAD, primitive } from "./kit";

// One file → several documents. The shared invoice is carved into three
// distinct pieces along natural seams. Because the underlying document is a
// single shared render, each piece is conveyed as its own "sheet" — a rounded
// outline, a soft drop shadow, and a slight alternating horizontal offset so
// the three read as separated, fanned documents rather than dashed lines drawn
// across one page. A scissors affordance sits on the primary cut line.

const SEAM_INK = primitive.ink;

function GapMask({ top, height }: { top: number; height: number }): ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        left: 0,
        right: 0,
        height: `${height}%`,
        background: primitive.paper,
      }}
    />
  );
}

// A resulting document drawn as its own sheet: rounded outline + shadow, nudged
// sideways so the stack reads as several pages, not one.
function Sheet({ top, height }: { top: number; height: number }): ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        height: `${height}%`,
        left: "2%",
        right: "2%",
        border: `1px solid ${primitive.sheetBorder}`,
        borderRadius: "7px",
        boxShadow: primitive.splitShadow,
      }}
    />
  );
}

// A piece tag: document type + page range.
function Tag({
  top,
  type,
  range,
}: {
  top: number;
  type: string;
  range: string;
}): ReactNode {
  return (
    <div
      style={{
        position: "absolute",
        right: `${PAD - 1}%`,
        top: `${top}%`,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: primitive.panel,
        padding: "2px 6px",
        borderRadius: "4px",
        border: `1px solid ${primitive.lineStrong}`,
        boxShadow: primitive.tagShadow,
      }}
    >
      <span
        style={mono(6.5, SEAM_INK, {
          fontWeight: 600,
          letterSpacing: "0.02em",
        })}
      >
        {type}
      </span>
      <span style={mono(6, primitive.muted)}>{range}</span>
    </div>
  );
}

// A cut line: a dashed rule with scissors riding on it.
function Cut({ top }: { top: number }): ReactNode {
  const line: CSSProperties = {
    position: "absolute",
    left: `${PAD - 1}%`,
    right: `${PAD - 1}%`,
    top: `${top}%`,
    borderTop: `1px dashed ${SEAM_INK}`,
  };
  return (
    <>
      <div style={line} />
      <svg
        viewBox="0 0 24 24"
        width="10"
        height="10"
        style={{
          position: "absolute",
          left: `${PAD - 3}%`,
          top: `${top}%`,
          transform: "translateY(-50%)",
          color: SEAM_INK,
        }}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <line x1="20" y1="4" x2="8.12" y2="15.88" />
        <line x1="14.47" y1="14.48" x2="20" y2="20" />
        <line x1="8.12" y1="8.12" x2="12" y2="12" />
      </svg>
    </>
  );
}

export function SplitOverlay() {
  return (
    <>
      {/* lightly dim the whole page so the carved pieces read as foreground */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: primitive.overlayDim,
        }}
      />

      <GapMask top={30} height={3.8} />
      <GapMask top={83.5} height={3.8} />

      {/* three resulting documents, each its own offset sheet */}
      <Sheet top={1.5} height={28.5} />
      <Sheet top={33.8} height={49.7} />
      <Sheet top={87.3} height={12.7} />

      {/* cuts between the three resulting documents */}
      <Cut top={31.9} />
      <Cut top={85.4} />

      {/* one tag per resulting document, each in a clear zone of its sheet */}
      <Tag top={13.5} type="Invoice" range="p.1" />
      <Tag top={36.3} type="Statement" range="p.2" />
      <Tag top={92.6} type="Receipt" range="p.3" />
    </>
  );
}
