import type { CSSProperties } from "react";

import { BAND, mono, PAD, primitive, transparent } from "./kit";

// /extract — pull structured JSON from the document using a schema.
// We draw crisp highlight rectangles exactly on real fields, tag each with
// its schema key, and dock a compact JSON snippet in the corner to show the
// captured output.

const INK = primitive.ink;
const MID = primitive.text;

function FieldBox({
  top,
  height,
  left,
  right,
  width,
  color = INK,
  radius = 3,
}: {
  top: number;
  height: number;
  left?: number;
  right?: number;
  width: string;
  color?: string;
  radius?: number;
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
        borderRadius: `${radius}px`,
        background: transparent(color, 4),
        zIndex: 1,
      }}
    />
  );
}

function KeyTag({
  children,
  top,
  left,
  right,
  style,
}: {
  children: string;
  top: number;
  left?: number;
  right?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={mono(7, primitive.chipFg, {
        position: "absolute",
        top: `${top}%`,
        ...(left !== undefined ? { left: `${left}%` } : {}),
        ...(right !== undefined ? { right: `${right}%` } : {}),
        fontWeight: 600,
        background: primitive.chipBg,
        padding: "1.5px 4px",
        borderRadius: "3px",
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
        zIndex: 2,
        ...style,
      })}
    >
      {children}
    </div>
  );
}

export function ExtractOverlay() {
  const sources: ReadonlyArray<{
    key: string;
    value: string;
    box: {
      top: number;
      height: number;
      left?: number;
      right?: number;
      width: string;
      color?: string;
      radius?: number;
    };
    tag: { top: number; left?: number; right?: number; style?: CSSProperties };
    valueColor: string;
  }> = [
    {
      key: "invoice_id",
      value: "#2042",
      box: {
        top: BAND.header + 2.1,
        height: 3,
        right: PAD - 1.2,
        width: "8.8%",
        color: MID,
      },
      tag: { top: BAND.header + 2.25, right: PAD + 8.7 },
      valueColor: primitive.muted,
    },
    {
      key: "bill_to",
      value: "Northwind",
      box: {
        top: BAND.parties - 2.5,
        height: 12.5,
        left: PAD - 2,
        width: "44%",
      },
      tag: { top: BAND.parties - 6.3, left: PAD - 2 },
      valueColor: primitive.muted,
    },
    {
      key: "issued_at",
      value: "Mar 4",
      box: {
        top: BAND.parties - 0.2,
        height: 2.2,
        right: PAD - 1,
        width: "13.5%",
        color: MID,
      },
      tag: { top: BAND.parties - 0.15, right: PAD + 13.8 },
      valueColor: primitive.muted,
    },
    {
      key: "due_date",
      value: "Apr 3",
      box: {
        top: BAND.parties + 2.1,
        height: 2.2,
        right: PAD - 1,
        width: "13.5%",
        color: MID,
      },
      tag: { top: BAND.parties + 2.15, right: PAD + 13.8 },
      valueColor: primitive.muted,
    },
    {
      key: "terms",
      value: "Net 30",
      box: {
        top: BAND.parties + 4.4,
        height: 2.2,
        right: PAD - 1,
        width: "8.5%",
        color: MID,
      },
      tag: { top: BAND.parties + 4.45, right: PAD + 8.8 },
      valueColor: primitive.muted,
    },
    {
      key: "line_item",
      value: "USB-C cable",
      box: {
        top: BAND.row2 - 0.5,
        height: 2.6,
        left: PAD + 7.1,
        width: "15.5%",
        color: MID,
      },
      tag: { top: BAND.row2 - 2.35, left: PAD + 7.1 },
      valueColor: primitive.muted,
    },
    {
      key: "amount",
      value: "$96",
      box: {
        top: BAND.row2 - 0.5,
        height: 2.6,
        right: PAD - 1.2,
        width: "7.4%",
        color: MID,
      },
      tag: { top: BAND.row2 - 0.45, right: PAD + 7.8 },
      valueColor: primitive.muted,
    },
    {
      key: "total",
      value: "$691",
      box: {
        top: BAND.total + 0.1,
        height: 2.8,
        right: PAD - 1.2,
        width: "8.6%",
      },
      tag: { top: BAND.total + 0.15, right: PAD + 9 },
      valueColor: INK,
    },
  ];

  // JSON output panel — compact captured-data card docked low-left.
  const pairs: ReadonlyArray<readonly [string, string, string]> = [
    ...sources.map(({ key, value, valueColor }) => [key, value, valueColor] as const),
  ];

  return (
    <>
      {sources.map(({ key, box, tag }) => (
        <div key={key}>
          <FieldBox {...box} />
          <KeyTag {...tag}>{key}</KeyTag>
        </div>
      ))}

      {/* captured JSON output panel */}
      <div
        style={{
          position: "absolute",
          left: `${PAD - 1}%`,
          bottom: "3.2%",
          width: "48%",
          background: primitive.panel,
          border: `1px solid ${primitive.lineStrong}`,
          borderRadius: "5px",
          padding: "4.5px 6px",
          boxShadow: primitive.softShadow,
          zIndex: 3,
        }}
      >
        <div
          style={mono(5.8, primitive.muted, {
            letterSpacing: "0.06em",
            marginBottom: "2px",
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
              gap: "7px",
              lineHeight: 1.32,
            }}
          >
            <span style={mono(5.9, MID)}>{`"${k}"`}</span>
            <span
              style={mono(5.9, vColor, {
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
