import type { CSSProperties, ReactNode } from "react";

import { BAND, Chip, items, mono, PAD } from "./kit";

// Each line-item record is wrapped in its own chunk, keyed by a unique id and
// stamped with a "n of 3" count badge, so the grouping reads as
// "repeated records → chunks keyed by id".
const ROW_TOPS = [BAND.row1, BAND.row2, BAND.row3] as const;
const CHUNK_H = 4.6; // chunk band height, % of page
const ROW_OFFSET = 1.1; // lift band so the row text sits centered inside it

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
            left: `${PAD - 1}%`,
            right: `${PAD - 1}%`,
            top: `${bandTop}%`,
            height: `${CHUNK_H}%`,
            background: alt ? "rgba(23,23,23,0.04)" : "rgba(23,23,23,0.02)",
            border: "1px solid rgba(23,23,23,0.10)",
            borderRadius: "5px",
          }}
        />
        {/* unique id key, pinned to the chunk's left edge */}
        <div
          style={mono(6.5, "#171717", {
            position: "absolute",
            left: `${PAD + 0.5}%`,
            top: `${bandTop - 0.2}%`,
            transform: "translateY(-100%)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          } as CSSProperties)}
        >
          id: {id}
        </div>
        {/* count badge, "n of 3" */}
        <div
          style={mono(6, "#525252", {
            position: "absolute",
            right: `${PAD + 0.5}%`,
            top: `${bandTop - 0.2}%`,
            transform: "translateY(-100%)",
            letterSpacing: "0.04em",
          } as CSSProperties)}
        >
          {n} of {items.length}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* key label for the partition primitive */}
      <Chip style={{ left: `${PAD}%`, top: `${BAND.tableHead - 8}%` }}>
        partition by id
      </Chip>

      {/* left rail brace spanning all chunks */}
      <div
        style={{
          position: "absolute",
          left: `${PAD - 3.5}%`,
          top: `${BAND.row1 - ROW_OFFSET}%`,
          height: `${BAND.row3 - BAND.row1 + CHUNK_H}%`,
          width: "7px",
          borderLeft: "1.5px solid #171717",
          borderTop: "1.5px solid #171717",
          borderBottom: "1.5px solid #171717",
          borderTopLeftRadius: "5px",
          borderBottomLeftRadius: "5px",
        }}
      />

      {ROW_TOPS.map((top, i) => chunk(top, items[i][0], i + 1))}
    </>
  );
}
