import type { CSSProperties, ReactNode } from "react";

import { mono, PAD } from "./kit";

// One file → several documents. The shared invoice is carved into three
// distinct pieces along natural seams: a translucent gap separates each piece,
// each is nudged sideways with a soft shadow so it reads as its own document,
// and a scissors affordance sits on the primary cut line.

const SEAM_INK = "#171717";
const GAP = "rgba(250,250,250,0.94)"; // scrim that opens a "cut" between pieces

// A piece tag: document type + page range, sitting on the right edge of a seam.
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
        right: `${PAD}%`,
        top: `${top}%`,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "#fff",
        padding: "2px 6px",
        borderRadius: "4px",
        border: "1px solid #e4e4e4",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
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
      <span style={mono(6, "#9a9a9a")}>{range}</span>
    </div>
  );
}

// A cut seam: a thin gap band scrim with a dashed cut line through its middle.
function Seam({
  top,
  scissors = false,
}: {
  top: number;
  scissors?: boolean;
}): ReactNode {
  const band: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: `${top}%`,
    height: "3.4%",
    transform: "translateY(-50%)",
    background: GAP,
    boxShadow:
      "inset 0 5px 5px -5px rgba(0,0,0,0.12), inset 0 -5px 5px -5px rgba(0,0,0,0.12)",
  };
  const line: CSSProperties = {
    position: "absolute",
    left: `${PAD}%`,
    right: `${PAD}%`,
    top: `${top}%`,
    borderTop: `1px dashed ${SEAM_INK}`,
  };
  return (
    <>
      <div style={band} />
      <div style={line} />
      {scissors && (
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          style={{
            position: "absolute",
            left: `${PAD - 2}%`,
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
      )}
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
          background: "rgba(255,255,255,0.18)",
        }}
      />

      {/* primary cut after the parties block; secondary cut before signature */}
      <Seam top={32} scissors />
      <Seam top={86} />

      {/* one tag per resulting document */}
      <Tag top={3} type="Invoice" range="p.1" />
      <Tag top={35} type="Statement" range="p.2" />
      <Tag top={88.5} type="Receipt" range="p.3" />
    </>
  );
}
