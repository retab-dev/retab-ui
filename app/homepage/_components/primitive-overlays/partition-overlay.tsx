import type { CSSProperties, ReactNode } from "react";

import { BAND, items, mono, PAD, primitive } from "./kit";

// Repeated records → chunks keyed by id. Each line-item row is wrapped in its
// own grouping band; the id column it is keyed on (already visible as A-1/A-2/
// A-3) is highlighted in place, and each chunk gets a compact key badge inside
// the row so the overlay reads as structured output instead of a bracketed
// table selection.
const ROW_TOPS = [BAND.row1, BAND.row2, BAND.row3] as const;
const CHUNK_H = 4.6; // chunk band height, % of page
const ROW_OFFSET = 1.1; // lift band so the row text sits centered inside it
const ROW_X_OUTSET = 2;

export function PartitionOverlay() {
  const chunk = (top: number, id: string, n: number): ReactNode => {
    const bandTop = top - ROW_OFFSET;
    const alt = n % 2 === 0;
    return (
      <div key={id}>
        {/* grouping band wrapping the whole record */}
        <div
          style={{
            position: "absolute",
            left: `${PAD - ROW_X_OUTSET}%`,
            right: `${PAD - ROW_X_OUTSET}%`,
            top: `${bandTop}%`,
            height: `${CHUNK_H}%`,
            background: alt
              ? primitive.partitionBandAlt
              : primitive.partitionBand,
            border: `1px solid ${primitive.partitionBorder}`,
            borderRadius: "5px",
          }}
        />
        {/* highlight the id cell this record is keyed on (sits over the
            document's own "A-n" column, centered in the band) */}
        <div
          style={{
            position: "absolute",
            left: `${PAD - 0.5}%`,
            top: `${bandTop + CHUNK_H / 2}%`,
            transform: "translateY(-50%)",
            width: "7.5%",
            height: "3.1%",
            background: primitive.partitionCell,
            border: `1px solid ${primitive.partitionCellBorder}`,
            borderRadius: "3px",
          }}
        />
        {/* output key label, dropped into the empty middle of the row */}
        <div
          style={mono(6, primitive.muted, {
            position: "absolute",
            right: `${PAD + 11}%`,
            top: `${bandTop + CHUNK_H / 2}%`,
            transform: "translateY(-50%)",
            minWidth: "29px",
            textAlign: "center",
            color: primitive.chipFg,
            background: primitive.chipBg,
            padding: "1.5px 5px",
            borderRadius: "3px",
            boxShadow: primitive.tagShadow,
          } as CSSProperties)}
        >
          key {n}
        </div>
      </div>
    );
  };

  return <>{ROW_TOPS.map((top, i) => chunk(top, items[i][0], i + 1))}</>;
}
