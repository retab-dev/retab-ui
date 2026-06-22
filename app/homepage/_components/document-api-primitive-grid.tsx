import type { CSSProperties, ReactNode } from "react";

// One "universal document" (the Acme invoice) is rendered identically in every
// card; each primitive is expressed purely as an overlay annotation layer on
// top of that same document. The document is decorative (aria-hidden) and lives
// on a fixed light "paper" surface — intentional, since a rendered document is
// light in any theme — while the card chrome uses theme tokens.

const mono = (
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
const PAD = 7; // horizontal inset, %
const BAND = {
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

function Row({
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

const items: ReadonlyArray<[string, string, string]> = [
  ["A-1", "Widget assembly", "$480"],
  ["A-2", "USB-C cable", "$96"],
  ["A-3", "Mount bracket", "$58"],
];

function UniversalDocument() {
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

function Chip({
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

// ── Overlays ────────────────────────────────────────────────────────────────

function ParseOverlay() {
  return (
    <>
      {/* scan band sweeping the page */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "0%",
          height: "50%",
          background:
            "linear-gradient(180deg, rgba(23,23,23,0.06), rgba(23,23,23,0))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          height: "2px",
          background: "#171717",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "30px",
          height: "13px",
          borderRadius: "7px",
          background: "#171717",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
          display: "flex",
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
      <Chip bg="#171717" style={{ top: "calc(50% - 26px)", right: `${PAD}%` }}>
        → markdown
      </Chip>
      {/* floating markdown snippet, the "parsed" truth */}
      <div
        style={{
          position: "absolute",
          left: `${PAD}%`,
          bottom: "6%",
          width: "58%",
          background: "#fafafa",
          border: "1px solid #ececec",
          borderRadius: "6px",
          padding: "7px 8px",
          boxShadow: "0 8px 18px -10px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          ...mono(7.5, "#777", { lineHeight: 1.3 }),
        }}
      >
        <div>
          <span style={{ color: "#171717", fontWeight: 700 }}>## </span>
          <span style={{ color: "#3f3f46", fontWeight: 600 }}>Totals</span>
        </div>
        <div>
          <span style={{ color: "#9a9a9a" }}>Subtotal </span>$634
        </div>
        <div>
          <span style={{ color: "#171717" }}>**</span>
          <span style={{ color: "#3f3f46", fontWeight: 600 }}>Total</span>
          <span style={{ color: "#171717" }}>**</span> $691
        </div>
      </div>
    </>
  );
}

function ExtractOverlay() {
  const fieldBox = (style: CSSProperties): CSSProperties => ({
    position: "absolute",
    border: "1.5px solid #171717",
    borderRadius: "5px",
    background: "rgba(23,23,23,0.04)",
    ...style,
  });
  return (
    <>
      {/* bill_to */}
      <div
        style={fieldBox({
          left: `${PAD - 1.5}%`,
          top: `${BAND.parties - 2}%`,
          width: "48%",
          height: "13%",
        })}
      />
      <Chip style={{ left: `${PAD}%`, top: `${BAND.parties - 8}%` }}>
        bill_to
      </Chip>
      {/* date */}
      <Chip bg="#525252" style={{ right: `${PAD}%`, top: `${BAND.parties - 8}%` }}>
        date
      </Chip>
      {/* amount on a line item */}
      <div
        style={fieldBox({
          right: `${PAD - 1.5}%`,
          top: `${BAND.row2 - 2}%`,
          width: "20%",
          height: "6%",
          borderColor: "#737373",
        })}
      />
      <Chip bg="#737373" style={{ right: `${PAD}%`, top: `${BAND.row1 - 6}%` }}>
        amount
      </Chip>
      {/* total */}
      <div
        style={fieldBox({
          right: `${PAD - 1.5}%`,
          top: `${BAND.total - 2}%`,
          width: "40%",
          height: "7%",
          borderColor: "#525252",
        })}
      />
      <Chip bg="#525252" style={{ right: `${PAD}%`, bottom: "9%" }}>
        total
      </Chip>
    </>
  );
}

function EditOverlay() {
  const input = (style: CSSProperties): CSSProperties => ({
    position: "absolute",
    border: "1.5px solid #171717",
    borderRadius: "4px",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    padding: "0 5px",
    boxSizing: "border-box",
    ...style,
  });
  const caret: CSSProperties = {
    width: "1.5px",
    height: "9px",
    background: "#171717",
    marginLeft: "1px",
  };
  return (
    <>
      {/* editing the Due date */}
      <div
        style={input({
          right: `${PAD}%`,
          top: `${BAND.parties + 4}%`,
          width: "26%",
          height: "8%",
          justifyContent: "space-between",
        })}
      >
        <span style={mono(6.5, "#171717")}>Apr 3</span>
        <span style={caret} />
      </div>
      {/* editing the Total */}
      <div
        style={input({
          right: `${PAD}%`,
          top: `${BAND.total - 1}%`,
          width: "40%",
          height: "8%",
          justifyContent: "space-between",
        })}
      >
        <span style={mono(6.5, "#9a9a9a")}>Total</span>
        <span style={{ display: "flex", alignItems: "center" }}>
          <span style={mono(7, "#171717", { fontWeight: 600 })}>$691</span>
          <span style={caret} />
        </span>
      </div>
      <Chip style={{ right: `${PAD}%`, top: `${BAND.total - 7}%` }}>editing</Chip>
    </>
  );
}

function SplitOverlay() {
  const boundary = (top: number, label: string): ReactNode => (
    <div
      style={{
        position: "absolute",
        left: `${PAD}%`,
        right: `${PAD}%`,
        top: `${top}%`,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <div style={{ flex: 1, borderTop: "1.5px dashed #171717" }} />
      <span style={mono(6, "#171717", { fontWeight: 600, letterSpacing: "0.1em" })}>
        {label}
      </span>
      <div style={{ flex: 1, borderTop: "1.5px dashed #171717" }} />
    </div>
  );
  const page = (top: number, label: string): ReactNode => (
    <Chip bg="#171717" style={{ right: `${PAD}%`, top: `${top}%` }}>
      {label}
    </Chip>
  );
  return (
    <>
      {/* dim, then carve the page into documents */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.35)",
        }}
      />
      {boundary(34, "SPLIT")}
      {boundary(64, "SPLIT")}
      {page(8, "p.1")}
      {page(38, "p.2")}
      {page(67, "p.3")}
    </>
  );
}

function PartitionOverlay() {
  const idChip = (top: number, id: string): ReactNode => (
    <div
      style={mono(7, "#171717", {
        position: "absolute",
        right: `${PAD}%`,
        top: `${top - 1}%`,
        border: "1px solid #d4d4d4",
        borderRadius: "3px",
        padding: "1px 4px",
        background: "#fff",
      })}
    >
      id: {id}
    </div>
  );
  return (
    <>
      <Chip style={{ left: `${PAD}%`, top: `${BAND.tableHead - 8}%` }}>
        partition by id
      </Chip>
      {/* bracket grouping the records */}
      <div
        style={{
          position: "absolute",
          left: `${PAD - 3}%`,
          top: `${BAND.row1 - 1}%`,
          height: `${BAND.row3 - BAND.row1 + 5}%`,
          width: "8px",
          borderLeft: "1.5px solid #171717",
          borderTop: "1.5px solid #171717",
          borderBottom: "1.5px solid #171717",
          borderTopLeftRadius: "4px",
          borderBottomLeftRadius: "4px",
        }}
      />
      {idChip(BAND.row1, "A-001")}
      {idChip(BAND.row2, "A-002")}
      {idChip(BAND.row3, "A-003")}
    </>
  );
}

function ClassifyOverlay() {
  return (
    <>
      {/* fade the document so the verdict reads on top */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(255,255,255,0.55)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%) rotate(-7deg)",
          border: "2.5px solid #171717",
          borderRadius: "9px",
          padding: "11px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
          background: "rgba(252,252,252,0.86)",
          boxShadow: "0 6px 22px rgba(23,23,23,0.14)",
        }}
      >
        <span
          style={mono(19, "#171717", {
            fontWeight: 700,
            letterSpacing: "0.09em",
            lineHeight: 1,
          })}
        >
          INVOICE
        </span>
        <span style={mono(8, "#737373", { letterSpacing: "0.05em" })}>
          classified · 96%
        </span>
      </div>
    </>
  );
}

type Primitive = {
  name: string;
  Overlay: () => ReactNode;
};

function PrimitiveCard({ name, Overlay }: Primitive) {
  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <div className="text-foreground font-mono text-base leading-none font-medium">
          <span className="text-muted-foreground/50">/</span>
          {name}
        </div>
      </div>
      <div className="border-border relative aspect-[210/297] w-full overflow-hidden rounded-[10px] border">
        <UniversalDocument />
        <div style={{ position: "absolute", inset: 0 }}>
          <Overlay />
        </div>
      </div>
    </div>
  );
}

const primitives: readonly Primitive[] = [
  { name: "parse", Overlay: ParseOverlay },
  { name: "extract", Overlay: ExtractOverlay },
  { name: "edit", Overlay: EditOverlay },
  { name: "split", Overlay: SplitOverlay },
  { name: "partition", Overlay: PartitionOverlay },
  { name: "classify", Overlay: ClassifyOverlay },
];

export function DocumentApiPrimitiveGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-x-16 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {primitives.map((primitive) => (
        <PrimitiveCard key={primitive.name} {...primitive} />
      ))}
    </div>
  );
}
