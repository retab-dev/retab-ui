import type { CSSProperties, ReactNode } from "react";

// Shared building blocks for the primitive overlays. One "universal document"
// (the Acme invoice) is rendered identically in every primitive card; each
// primitive is expressed purely as an overlay annotation layer on top of this
// same document. The document is decorative (aria-hidden) and lives on a fixed
// light "paper" surface — intentional, since a rendered document is light in
// any theme — while the card chrome uses theme tokens.

export const mono = (
  size: number,
  color: string,
  extra?: CSSProperties,
): CSSProperties => ({
  fontFamily: "var(--font-mono)",
  fontSize: `${size}px`,
  color,
  ...extra,
});

// Shared vertical bands (% of page height) so overlays line up with the
// document rows beneath them.
export const PAD = 7; // horizontal inset, %
export const BAND = {
  header: 6,
  parties: 19,
  tableHead: 39,
  row1: 46,
  row2: 52,
  row3: 58,
  subtotal: 69,
  tax: 74,
  total: 79,
  sign: 90,
} as const;

export function Row({
  top,
  children,
  style,
}: {
  top: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        left: `${PAD}%`,
        right: `${PAD}%`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const items: ReadonlyArray<[string, string, string]> = [
  ["A-1", "Widget assembly", "$480"],
  ["A-2", "USB-C cable", "$96"],
  ["A-3", "Mount bracket", "$58"],
];

export function Chip({
  children,
  bg = "#171717",
  style,
}: {
  children: ReactNode;
  bg?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={mono(8, "#fafafa", {
        position: "absolute",
        fontWeight: 600,
        background: bg,
        padding: "2px 6px",
        borderRadius: "4px",
        whiteSpace: "nowrap",
        ...style,
      })}
    >
      {children}
    </div>
  );
}

export function UniversalDocument() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#fff" }}>
      {/* header */}
      <Row top={BAND.header}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <div
              style={{
                width: "17px",
                height: "17px",
                borderRadius: "4px",
                background: "#171717",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  border: "1.5px solid #fff",
                }}
              />
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#1a1a1a",
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                }}
              >
                Acme Corp
              </span>
              <span style={mono(6, "#b0b0b0", { letterSpacing: "0.04em" })}>
                12 Market St, Boston MA
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#1a1a1a",
                lineHeight: 1,
                letterSpacing: "0.05em",
              }}
            >
              INVOICE
            </div>
            <div style={mono(7, "#b0b0b0", { marginTop: "3px" })}>#2042</div>
          </div>
        </div>
      </Row>

      {/* parties */}
      <Row top={BAND.parties}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              flex: 1,
            }}
          >
            <span style={mono(6, "#9a9a9a", { letterSpacing: "0.08em" })}>
              BILL TO
            </span>
            <span
              style={{ fontSize: "8px", fontWeight: 600, color: "#3f3f46" }}
            >
              Northwind Trading Co.
            </span>
            <span style={mono(6.5, "#9a9a9a")}>88 Harbor Rd, Seattle WA</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              width: "42%",
            }}
          >
            {[
              ["Issued", "Mar 4, 2024"],
              ["Due", "Apr 3, 2024"],
              ["Terms", "Net 30"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span style={mono(6.5, "#9a9a9a")}>{k}</span>
                <span style={mono(6.5, "#777")}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </Row>

      {/* table header */}
      <Row top={BAND.tableHead}>
        <div
          style={{
            display: "flex",
            gap: "7px",
            alignItems: "center",
            borderTop: "1px solid #eee",
            borderBottom: "1px solid #eee",
            padding: "4px 0",
          }}
        >
          <span
            style={mono(6, "#9a9a9a", {
              width: "26px",
              letterSpacing: "0.06em",
            })}
          >
            ITEM
          </span>
          <span style={mono(6, "#9a9a9a", { flex: 1, letterSpacing: "0.06em" })}>
            DESCRIPTION
          </span>
          <span
            style={mono(6, "#9a9a9a", {
              width: "32px",
              textAlign: "right",
              letterSpacing: "0.06em",
            })}
          >
            AMT
          </span>
        </div>
      </Row>

      {/* item rows */}
      {items.map(([id, desc, amt], i) => (
        <Row key={id} top={[BAND.row1, BAND.row2, BAND.row3][i]}>
          <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
            <span style={mono(7, "#777", { width: "26px" })}>{id}</span>
            <span style={mono(7, "#525252", { flex: 1 })}>{desc}</span>
            <span style={mono(7, "#777", { width: "32px", textAlign: "right" })}>
              {amt}
            </span>
          </div>
        </Row>
      ))}

      {/* totals */}
      {[
        [BAND.subtotal, "Subtotal", "$634", false],
        [BAND.tax, "Tax", "$57", false],
        [BAND.total, "Total", "$691", true],
      ].map(([top, label, value, strong]) => (
        <Row key={label as string} top={top as number}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "52%",
              marginLeft: "auto",
              ...(strong
                ? { borderTop: "1px solid #eee", paddingTop: "3px" }
                : {}),
            }}
          >
            <span
              style={mono(strong ? 7 : 6.5, strong ? "#171717" : "#9a9a9a", {
                fontWeight: strong ? 600 : 400,
              })}
            >
              {label as string}
            </span>
            <span
              style={mono(strong ? 7.5 : 6.5, strong ? "#171717" : "#777", {
                fontWeight: strong ? 600 : 400,
              })}
            >
              {value as string}
            </span>
          </div>
        </Row>
      ))}

      {/* signature */}
      <Row top={BAND.sign}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              flex: 1,
            }}
          >
            <span style={mono(5.5, "#9a9a9a")}>Authorized signature</span>
            <div style={{ height: "12px", borderBottom: "1px solid #efefef" }} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              width: "34%",
            }}
          >
            <span style={mono(5.5, "#9a9a9a")}>Date</span>
            <div style={{ height: "12px", borderBottom: "1px solid #efefef" }} />
          </div>
        </div>
      </Row>
    </div>
  );
}
