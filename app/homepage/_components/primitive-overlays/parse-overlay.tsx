import type { CSSProperties } from "react";

import { Chip, mono, PAD } from "./kit";

// Token colors for the markdown source — restrained, monochrome ink with a
// single subtle accent for inline-code so the snippet reads as real,
// syntax-tinted markdown rather than placeholder text.
const SYNTAX = "#171717"; // markers: #, **, |, -
const KEY = "#3f3f46"; // bold-key / heading text
const TEXT = "#525252"; // plain text
const MUTED = "#9a9a9a"; // dim text / table rule
const NUM = "#525252"; // numbers

// The parsed markdown source for THIS invoice. Rendered as discrete tinted
// tokens so each markdown construct reads correctly.
function MdHeading({ level, children }: { level: 1 | 2; children: string }) {
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      <span style={{ color: SYNTAX, fontWeight: 700 }}>
        {"#".repeat(level)}
      </span>
      <span style={{ color: KEY, fontWeight: level === 1 ? 700 : 600 }}>
        {children}
      </span>
    </div>
  );
}

export function ParseOverlay() {
  // The reveal seam: left of it = rendered document, right = markdown source.
  const seam = 50; // %

  return (
    <>
      {/* Fade the rendered (left) side into the seam so it reads as dissolving
          into the parsed panel — and, crucially, so the document's
          right-aligned totals block (whose labels cross the 50% mark) dissolves
          rather than leaving orphaned "S / T / T" letters stranded at the seam. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${seam}%`,
          background:
            "linear-gradient(90deg, rgba(250,250,250,0) 84%, rgba(250,250,250,0.92) 96%, rgb(250,250,250) 100%)",
        }}
      />

      {/* The parsed markdown source panel covering the right half. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${seam}%`,
          right: 0,
          background: "#fafafa",
          borderLeft: "1px solid #e7e7e7",
          boxShadow: "-10px 0 22px -16px rgba(0,0,0,0.35)",
        }}
      />

      {/* Vertical reveal seam + handle straddling the split. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${seam}%`,
          width: "1.5px",
          marginLeft: "-0.75px",
          background: "#171717",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: `${seam}%`,
          transform: "translate(-50%,-50%)",
          width: "16px",
          height: "26px",
          borderRadius: "5px",
          background: "#171717",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2.5px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "2px",
              height: "2px",
              borderRadius: "50%",
              background: "#fafafa",
            }}
          />
        ))}
      </div>

      {/* "→ markdown" label anchored to the seam, top. */}
      <Chip
        bg="#171717"
        style={{ top: `${PAD}%`, left: `${seam}%`, transform: "translateX(6px)" }}
      >
        → markdown
      </Chip>

      {/* The markdown source itself, laid out down the right panel. */}
      <div
        style={{
          position: "absolute",
          top: "17%",
          left: `${seam}%`,
          right: 0,
          paddingLeft: "9px",
          paddingRight: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          ...mono(7, TEXT, { lineHeight: 1.35 }),
        }}
      >
        <MdHeading level={1}>Invoice #2042</MdHeading>

        <div>
          <span style={{ color: SYNTAX, fontWeight: 700 }}>**</span>
          <span style={{ color: KEY, fontWeight: 600 }}>Bill to</span>
          <span style={{ color: SYNTAX, fontWeight: 700 }}>**</span>
          <span style={{ color: TEXT }}> Northwind Trading Co.</span>
        </div>

        <MdHeading level={2}>Line items</MdHeading>

        {/* a small pipe table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5px" }}>
          <div>
            <span style={{ color: SYNTAX }}>| </span>
            <span style={{ color: MUTED }}>Item </span>
            <span style={{ color: SYNTAX }}>| </span>
            <span style={{ color: MUTED }}>Amt </span>
            <span style={{ color: SYNTAX }}>|</span>
          </div>
          <div style={{ color: MUTED }}>|---|---|</div>
          {[
            ["Widget assembly", "$480"],
            ["USB-C cable", "$96"],
            ["Mount bracket", "$58"],
          ].map(([desc, amt]) => (
            <div key={desc}>
              <span style={{ color: SYNTAX }}>| </span>
              <span style={{ color: TEXT }}>{desc} </span>
              <span style={{ color: SYNTAX }}>| </span>
              <span style={{ color: NUM }}>{amt} </span>
              <span style={{ color: SYNTAX }}>|</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "1px" }}>
          <span style={{ color: SYNTAX, fontWeight: 700 }}>**</span>
          <span style={{ color: KEY, fontWeight: 600 }}>Total</span>
          <span style={{ color: SYNTAX, fontWeight: 700 }}>**</span>
          <span style={{ color: NUM }}> $691</span>
        </div>
      </div>

      {/* Tiny status caption bottom-left over the rendered side. */}
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          left: `${PAD}%`,
          ...(mono(6, MUTED, {
            letterSpacing: "0.06em",
          }) as CSSProperties),
        }}
      >
        scanned → parsed
      </div>
    </>
  );
}
