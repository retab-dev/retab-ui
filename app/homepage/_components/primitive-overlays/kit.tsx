import type { CSSProperties, ReactNode } from "react";

// Shared building blocks for the primitive overlays. One "universal document"
// (the Acme invoice) is rendered identically in every primitive card; each
// primitive is expressed purely as an overlay annotation layer on top of this
// same document. The drawing uses scoped homepage CSS variables so the paper,
// text, and annotation chrome can adapt with the page theme.

export const primitive = {
  paper: "var(--homepage-primitive-paper)",
  panel: "var(--homepage-primitive-panel)",
  panelMuted: "var(--homepage-primitive-panel-muted)",
  ink: "var(--homepage-primitive-ink)",
  inkStrong: "var(--homepage-primitive-ink-strong)",
  textSecondary: "var(--homepage-primitive-text-secondary)",
  text: "var(--homepage-primitive-text)",
  mid: "var(--homepage-primitive-mid)",
  muted: "var(--homepage-primitive-muted)",
  faint: "var(--homepage-primitive-faint)",
  line: "var(--homepage-primitive-line)",
  lineSoft: "var(--homepage-primitive-line-soft)",
  lineStrong: "var(--homepage-primitive-line-strong)",
  lineFaint: "var(--homepage-primitive-line-faint)",
  chipBg: "var(--homepage-primitive-chip-bg)",
  chipFg: "var(--homepage-primitive-chip-fg)",
  seam: "var(--homepage-primitive-seam)",
  seamHandle: "var(--homepage-primitive-seam-handle)",
  seamDot: "var(--homepage-primitive-seam-dot)",
  focus: "var(--homepage-primitive-focus)",
  focusFg: "var(--homepage-primitive-focus-fg)",
  success: "var(--homepage-primitive-success)",
  overlayFade: "var(--homepage-primitive-overlay-fade)",
  overlayDim: "var(--homepage-primitive-overlay-dim)",
  parseFade: "var(--homepage-primitive-parse-fade)",
  partitionBand: "var(--homepage-primitive-partition-band)",
  partitionBandAlt: "var(--homepage-primitive-partition-band-alt)",
  partitionBorder: "var(--homepage-primitive-partition-border)",
  partitionCell: "var(--homepage-primitive-partition-cell)",
  partitionCellBorder: "var(--homepage-primitive-partition-cell-border)",
  sheetBorder: "var(--homepage-primitive-sheet-border)",
  panelShadow: "var(--homepage-primitive-panel-shadow)",
  softShadow: "var(--homepage-primitive-soft-shadow)",
  tagShadow: "var(--homepage-primitive-tag-shadow)",
  splitShadow: "var(--homepage-primitive-split-shadow)",
  parseShadow: "var(--homepage-primitive-parse-shadow)",
} as const;

export function transparent(color: string, amount: number): string {
  return `color-mix(in srgb, ${color} ${amount}%, transparent)`;
}

export const PRIMITIVE_STAGE = {
  width: 210,
  height: 297,
} as const;

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
  bg = primitive.chipBg,
  fg = primitive.chipFg,
  style,
}: {
  children: ReactNode;
  bg?: string;
  fg?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={mono(8, fg, {
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

export function PrimitiveStage({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
      style={{
        display: "block",
        height: "100%",
        inset: 0,
        position: "absolute",
        width: "100%",
      }}
      viewBox={`0 0 ${PRIMITIVE_STAGE.width} ${PRIMITIVE_STAGE.height}`}
    >
      <foreignObject
        height={PRIMITIVE_STAGE.height}
        width={PRIMITIVE_STAGE.width}
        x={0}
        y={0}
      >
        <div
          style={{
            height: "100%",
            overflow: "hidden",
            position: "relative",
            width: "100%",
          }}
        >
          {children}
        </div>
      </foreignObject>
    </svg>
  );
}

export function PrimitiveBackdrop() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: primitive.overlayFade,
        backdropFilter: "saturate(0.9)",
      }}
    />
  );
}

export function UniversalDocument() {
  return (
    <div
      style={{ position: "absolute", inset: 0, background: primitive.paper }}
    >
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
                background: primitive.ink,
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
                  border: `1.5px solid ${primitive.paper}`,
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
                  color: primitive.inkStrong,
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                }}
              >
                Acme Corp
              </span>
              <span
                style={mono(6, primitive.faint, { letterSpacing: "0.04em" })}
              >
                12 Market St, Boston MA
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: primitive.inkStrong,
                lineHeight: 1,
                letterSpacing: "0.05em",
              }}
            >
              INVOICE
            </div>
            <div style={mono(7, primitive.faint, { marginTop: "3px" })}>
              #2042
            </div>
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
            <span style={mono(6, primitive.muted, { letterSpacing: "0.08em" })}>
              BILL TO
            </span>
            <span
              style={{
                fontSize: "8px",
                fontWeight: 600,
                color: primitive.textSecondary,
              }}
            >
              Northwind Trading Co.
            </span>
            <span style={mono(6.5, primitive.muted)}>
              88 Harbor Rd, Seattle WA
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
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
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  lineHeight: 1,
                }}
              >
                <span style={mono(6.5, primitive.muted, { lineHeight: 1 })}>
                  {k}
                </span>
                <span style={mono(6.5, primitive.mid, { lineHeight: 1 })}>
                  {v}
                </span>
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
            borderTop: `1px solid ${primitive.line}`,
            borderBottom: `1px solid ${primitive.line}`,
            padding: "4px 0",
          }}
        >
          <span
            style={mono(6, primitive.muted, {
              width: "26px",
              letterSpacing: "0.06em",
            })}
          >
            ITEM
          </span>
          <span
            style={mono(6, primitive.muted, {
              flex: 1,
              letterSpacing: "0.06em",
            })}
          >
            DESCRIPTION
          </span>
          <span
            style={mono(6, primitive.muted, {
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
            <span style={mono(7, primitive.mid, { width: "26px" })}>{id}</span>
            <span style={mono(7, primitive.text, { flex: 1 })}>{desc}</span>
            <span
              style={mono(7, primitive.mid, {
                width: "32px",
                textAlign: "right",
              })}
            >
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
                ? {
                    borderTop: `1px solid ${primitive.line}`,
                    paddingTop: "3px",
                  }
                : {}),
            }}
          >
            <span
              style={mono(
                strong ? 7 : 6.5,
                strong ? primitive.ink : primitive.muted,
                {
                  fontWeight: strong ? 600 : 400,
                },
              )}
            >
              {label as string}
            </span>
            <span
              style={mono(
                strong ? 7.5 : 6.5,
                strong ? primitive.ink : primitive.mid,
                {
                  fontWeight: strong ? 600 : 400,
                },
              )}
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
            <span style={mono(5.5, primitive.muted)}>Authorized signature</span>
            <div
              style={{
                height: "12px",
                borderBottom: `1px solid ${primitive.lineFaint}`,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              width: "34%",
            }}
          >
            <span style={mono(5.5, primitive.muted)}>Date</span>
            <div
              style={{
                height: "12px",
                borderBottom: `1px solid ${primitive.lineFaint}`,
              }}
            />
          </div>
        </div>
      </Row>
    </div>
  );
}
