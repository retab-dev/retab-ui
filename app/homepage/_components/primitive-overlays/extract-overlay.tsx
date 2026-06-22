import type { CSSProperties } from "react";

import { BAND, mono, PAD } from "./kit";

// /extract — pull structured JSON from the document using a schema.
// We draw crisp highlight rectangles exactly on real fields, tag each with
// its schema key, and dock a compact JSON snippet in the corner to show the
// captured output.

const INK = "#171717";
const MID = "#525252";

function FieldBox({
  top,
  height,
  left,
  right,
  width,
  color = INK,
}: {
  top: number;
  height: number;
  left?: number;
  right?: number;
  width: string;
  color?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        height: `${height}%`,
        width,
        ...(left !== undefined ? { left: `${left}%` } : {}),
        ...(right !== undefined ? { right: `${right}%` } : {}),
        border: `1px solid ${color}`,
        borderRadius: "3px",
        background: `${color}0a`,
        boxShadow: `inset 0 0 0 2px #ffffff`,
      }}
    />
  );
}

function KeyTag({
  children,
  top,
  left,
  right,
}: {
  children: string;
  top: number;
  left?: number;
  right?: number;
}) {
  return (
    <div
      style={mono(7, "#fafafa", {
        position: "absolute",
        top: `${top}%`,
        ...(left !== undefined ? { left: `${left}%` } : {}),
        ...(right !== undefined ? { right: `${right}%` } : {}),
        fontWeight: 600,
        background: INK,
        padding: "1.5px 4px",
        borderRadius: "3px",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      })}
    >
      {children}
    </div>
  );
}

export function ExtractOverlay() {
  // JSON output panel — compact captured-data card docked low-left.
  const pairs: ReadonlyArray<[string, string, string]> = [
    ["bill_to", "Northwind", "#9a9a9a"],
    ["due_date", "Apr 3", "#9a9a9a"],
    ["amount", "$96", "#9a9a9a"],
    ["total", "$691", INK],
  ];

  return (
    <>
      {/* bill_to — wraps the BILL TO label + name + address */}
      <FieldBox top={BAND.parties - 2.5} height={12.5} left={PAD - 2} width="44%" />
      <KeyTag top={BAND.parties - 7} left={PAD - 2}>
        bill_to
      </KeyTag>

      {/* due_date — the "Apr 3, 2024" value (right column, middle row) */}
      <FieldBox
        top={BAND.parties + 3.4}
        height={3.6}
        right={PAD - 1.5}
        width="20%"
        color={MID}
      />
      <KeyTag top={BAND.parties + 2.6} right={PAD + 20}>
        due_date
      </KeyTag>

      {/* amount — far-right amount cell on a line item (row 2: $96) */}
      <FieldBox
        top={BAND.row2 - 1.8}
        height={3.6}
        right={PAD - 1.5}
        width="14%"
        color={MID}
      />
      <KeyTag top={BAND.row2 - 1.6} right={PAD + 14.5}>
        amount
      </KeyTag>

      {/* total — the Total $691 line */}
      <FieldBox top={BAND.total - 1.6} height={4.6} right={PAD - 2} width="42%" />
      <KeyTag top={BAND.total - 0.4} right={PAD + 42.5}>
        total
      </KeyTag>

      {/* captured JSON output panel */}
      <div
        style={{
          position: "absolute",
          left: `${PAD - 1}%`,
          bottom: "3.5%",
          width: "56%",
          background: "#fbfbfb",
          border: "1px solid #e7e7e7",
          borderRadius: "5px",
          padding: "5px 6px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={mono(6, "#9a9a9a", {
            letterSpacing: "0.06em",
            marginBottom: "3px",
          })}
        >
          {"{ extracted }"}
        </div>
        {pairs.map(([k, v, vColor]) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "8px",
              lineHeight: 1.5,
            }}
          >
            <span style={mono(6.5, MID)}>{`"${k}"`}</span>
            <span
              style={mono(6.5, vColor, {
                fontWeight: vColor === INK ? 600 : 400,
              })}
            >
              {`"${v}"`}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
