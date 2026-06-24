import type { CSSProperties } from "react";

import { BAND, mono, PAD, primitive, transparent } from "./kit";

// /extract — pull structured JSON from the document using a schema.
// We draw crisp highlight rectangles exactly on real fields and tag each with
// its schema key.

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
    box: {
      top: number;
      height: number;
      left?: number;
      right?: number;
      width: string;
      color?: string;
      radius?: number;
    };
    tag: { top?: number; left?: number; right?: number; style?: CSSProperties };
  }> = [
    {
      key: "invoice_id",
      box: {
        top: BAND.header + 6.2,
        height: 3.1,
        right: PAD - 1.2,
        width: "13.2%",
        color: MID,
      },
      tag: { right: PAD + 13.6 },
    },
    {
      key: "bill_to",
      box: {
        top: BAND.parties - 2.5,
        height: 12.5,
        left: PAD - 2,
        width: "44%",
      },
      tag: { top: BAND.parties - 6.3, left: PAD - 2 },
    },
    {
      key: "issued_at",
      box: {
        top: BAND.parties - 0.2,
        height: 2.7,
        right: PAD - 1,
        width: "24.8%",
        color: MID,
      },
      tag: { right: PAD + 25 },
    },
    {
      key: "due_date",
      box: {
        top: BAND.parties + 4.7,
        height: 2.7,
        right: PAD - 1,
        width: "24.8%",
        color: MID,
      },
      tag: { right: PAD + 25 },
    },
    {
      key: "terms",
      box: {
        top: BAND.parties + 9.6,
        height: 2.7,
        right: PAD - 1,
        width: "15.2%",
        color: MID,
      },
      tag: { right: PAD + 15.4 },
    },
    {
      key: "line_item",
      box: {
        top: BAND.row2 - 0.1,
        height: 3.5,
        left: PAD + 15.7,
        width: "24%",
        color: MID,
      },
      tag: { top: BAND.row2 - 3.9, left: PAD + 15.7 },
    },
    {
      key: "amount",
      box: {
        top: BAND.row2 - 0.1,
        height: 3.5,
        right: PAD - 1.2,
        width: "7.4%",
        color: MID,
      },
      tag: { right: PAD + 7.8 },
    },
    {
      key: "total",
      box: {
        top: BAND.total + 1.2,
        height: 3.9,
        right: PAD - 1.2,
        width: "10.2%",
      },
      tag: { right: PAD + 10.4 },
    },
  ];

  return (
    <>
      {sources.map(({ key, box, tag }) => (
        <div key={key}>
          <FieldBox {...box} />
          <KeyTag {...tag} top={tag.top ?? box.top}>
            {key}
          </KeyTag>
        </div>
      ))}
    </>
  );
}
