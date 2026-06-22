import type { CSSProperties, ReactNode } from "react";

// Decorative, faithful reproductions of the "Retab Primitives - Grid" design.
// The illustrations render document-style mockups on a fixed light "paper"
// surface (intentional — a rendered document is light in any theme), while the
// surrounding card chrome (name, description, border) uses theme tokens.

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

const bar = (width: string, color = "#ededed"): CSSProperties => ({
  height: "4px",
  width,
  borderRadius: "3px",
  background: color,
});

type Primitive = {
  name: string;
  Art: () => ReactNode;
};

function PrimitiveCard({ name, Art }: Primitive) {
  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <div className="text-foreground font-mono text-base leading-none font-medium">
          <span className="text-muted-foreground/50">/</span>
          {name}
        </div>
      </div>
      <div className="border-border relative aspect-[210/297] w-full overflow-hidden rounded-[10px] border">
        <Art />
      </div>
    </div>
  );
}

function ParseArt() {
  return (
    <>
      {/* truth layer: the lower part of the page, parsed to markdown */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "0 16px 13px",
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          ...mono(8.5, "#777", { lineHeight: 1.25 }),
        }}
      >
        <div style={{ height: "44%", flex: "none" }} />
        <div
          style={{
            flex: "1 1 0",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingTop: "11px",
          }}
        >
          <div>
            <span style={{ color: "#171717", fontWeight: 700 }}>## </span>
            <span style={{ color: "#3f3f46", fontWeight: 600 }}>Totals</span>
          </div>
          <div>
            <span style={{ color: "#9a9a9a" }}>Subtotal </span>
            <span style={{ color: "#777" }}>$634</span>
          </div>
          <div>
            <span style={{ color: "#9a9a9a" }}>Tax (9%) </span>
            <span style={{ color: "#777" }}>$57</span>
          </div>
          <div>
            <span style={{ color: "#171717" }}>**</span>
            <span style={{ color: "#3f3f46", fontWeight: 600 }}>Total due</span>
            <span style={{ color: "#171717" }}>**</span>
            <span style={{ color: "#777" }}> $691</span>
          </div>
          <div style={{ marginTop: "1px" }}>
            <span style={{ color: "#171717", fontWeight: 700 }}>## </span>
            <span style={{ color: "#3f3f46", fontWeight: 600 }}>Payment</span>
          </div>
          <div>
            <span style={{ color: "#9a9a9a" }}>Remit to acct </span>
            <span style={{ color: "#777" }}>0042-118</span>
            <span style={{ color: "#9a9a9a" }}> · ABA </span>
            <span style={{ color: "#777" }}>021000021</span>
          </div>
          <div>
            <span style={{ color: "#9a9a9a" }}>Terms: </span>
            <span style={{ color: "#777" }}>Net 30</span>
            <span style={{ color: "#9a9a9a" }}> · 1.5%/mo late fee</span>
          </div>
          <div style={{ marginTop: "1px" }}>
            <span style={{ color: "#171717", fontWeight: 700 }}>## </span>
            <span style={{ color: "#3f3f46", fontWeight: 600 }}>Notes</span>
          </div>
          <div style={{ color: "#9a9a9a" }}>
            Bulk pricing applied to line A-1.
          </div>
          <div>
            <span style={{ color: "#9a9a9a" }}>Questions? </span>
            <span style={{ color: "#3552d6", textDecoration: "underline" }}>
              billing@acmecorp.example
            </span>
          </div>
        </div>
      </div>

      {/* raw layer: the source document, clipped to above the slider */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "15px 16px",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          clipPath: "inset(0 0 56% 0)",
          boxShadow: "0 14px 18px -10px rgba(0,0,0,0.12)",
        }}
      >
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "14px",
            marginTop: "1px",
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
            <span style={{ fontSize: "8px", fontWeight: 600, color: "#3f3f46" }}>
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
            style={mono(6, "#9a9a9a", { width: "26px", letterSpacing: "0.06em" })}
          >
            ITEM
          </span>
          <span
            style={mono(6, "#9a9a9a", { flex: 1, letterSpacing: "0.06em" })}
          >
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
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {[
            ["A-1", "Widget assembly", "$480"],
            ["A-2", "USB-C cable", "$96"],
            ["A-3", "Mount bracket", "$58"],
          ].map(([id, desc, amt]) => (
            <div
              key={id}
              style={{ display: "flex", gap: "7px", alignItems: "center" }}
            >
              <span style={mono(7, "#777", { width: "26px" })}>{id}</span>
              <span style={mono(7, "#525252", { flex: 1 })}>{desc}</span>
              <span
                style={mono(7, "#777", { width: "32px", textAlign: "right" })}
              >
                {amt}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* reveal slider */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "44%",
          height: "2px",
          background: "#171717",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "44%",
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
      <div
        style={mono(7, "#9a9a9a", {
          position: "absolute",
          top: "calc(44% - 22px)",
          right: "13px",
          fontWeight: 600,
          letterSpacing: "0.04em",
        })}
      >
        scanned
      </div>
      <div
        style={mono(7, "#171717", {
          position: "absolute",
          top: "calc(44% + 10px)",
          right: "13px",
          fontWeight: 600,
          letterSpacing: "0.04em",
        })}
      >
        parsed
      </div>
    </>
  );
}

function ExtractArt() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "14px 15px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "3px",
              background: "#171717",
            }}
          />
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "#1a1a1a",
              whiteSpace: "nowrap",
            }}
          >
            Acme Corp
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#1a1a1a",
              lineHeight: 1,
            }}
          >
            INVOICE
          </div>
          <div style={mono(7, "#b0b0b0", { marginTop: "2px" })}>#2042</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          marginTop: "1px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            flex: 1,
            border: "1.5px solid #171717",
            borderRadius: "5px",
            padding: "6px 8px",
            background: "rgba(23,23,23,0.02)",
          }}
        >
          <span style={mono(6, "#9a9a9a", { letterSpacing: "0.06em" })}>
            BILL TO
          </span>
          <div style={bar("80%", "#d8d8d8")} />
          <div style={bar("60%", "#e2e2e2")} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            width: "42%",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={mono(6.5, "#9a9a9a")}>Date</span>
            <span
              style={mono(6.5, "#171717", {
                border: "1.5px solid #525252",
                borderRadius: "4px",
                padding: "1px 5px",
              })}
            >
              Mar 4
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={mono(6.5, "#9a9a9a")}>Due</span>
            <span style={mono(6.5, "#777")}>Apr 3</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={mono(6.5, "#9a9a9a")}>Terms</span>
            <span style={mono(6.5, "#777")}>Net 30</span>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #eee", margin: "2px 0" }} />
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span
          style={mono(6, "#9a9a9a", { width: "30px", letterSpacing: "0.04em" })}
        >
          ITEM
        </span>
        <span style={mono(6, "#9a9a9a", { flex: 1, letterSpacing: "0.04em" })}>
          DESCRIPTION
        </span>
        <span
          style={mono(6, "#9a9a9a", {
            width: "34px",
            textAlign: "right",
            letterSpacing: "0.04em",
          })}
        >
          AMOUNT
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={mono(7, "#777", { width: "30px" })}>A-1</span>
          <div style={{ flex: 1, ...bar("100%", "#efefef") }} />
          <span style={mono(7, "#777", { width: "34px", textAlign: "right" })}>
            $480
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={mono(7, "#777", { width: "30px" })}>A-2</span>
          <div style={{ flex: 1, ...bar("100%", "#efefef") }} />
          <span
            style={mono(7, "#171717", {
              width: "34px",
              textAlign: "right",
              border: "1.5px solid #737373",
              borderRadius: "3px",
              padding: "0 2px",
              boxSizing: "border-box",
            })}
          >
            $96
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={mono(7, "#777", { width: "30px" })}>A-3</span>
          <div style={{ flex: 1, ...bar("100%", "#efefef") }} />
          <span style={mono(7, "#777", { width: "34px", textAlign: "right" })}>
            $58
          </span>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #eee", margin: "2px 0" }} />
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", width: "56%" }}>
          <span style={mono(6.5, "#9a9a9a")}>Subtotal</span>
          <span style={mono(6.5, "#777")}>$634</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: "56%" }}>
          <span style={mono(6.5, "#9a9a9a")}>Tax</span>
          <span style={mono(6.5, "#777")}>$57</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "56%",
            border: "1.5px solid #737373",
            borderRadius: "5px",
            padding: "4px 8px",
            boxSizing: "border-box",
            background: "rgba(115,115,115,0.03)",
          }}
        >
          <span style={mono(7, "#171717", { fontWeight: 600 })}>Total</span>
          <span style={mono(7.5, "#171717", { fontWeight: 600 })}>$691</span>
        </div>
      </div>

      {/* field tags */}
      <div
        style={mono(8, "#fafafa", {
          position: "absolute",
          top: "25%",
          left: "7px",
          fontWeight: 600,
          background: "#171717",
          padding: "2px 6px",
          borderRadius: "4px",
        })}
      >
        bill_to
      </div>
      <div
        style={mono(8, "#fafafa", {
          position: "absolute",
          top: "20%",
          right: "7px",
          fontWeight: 600,
          background: "#525252",
          padding: "2px 6px",
          borderRadius: "4px",
        })}
      >
        date
      </div>
      <div
        style={mono(8, "#fafafa", {
          position: "absolute",
          top: "42%",
          right: "7px",
          fontWeight: 600,
          background: "#737373",
          padding: "2px 6px",
          borderRadius: "4px",
        })}
      >
        amount
      </div>
      <div
        style={mono(8, "#fafafa", {
          position: "absolute",
          bottom: "30px",
          right: "7px",
          fontWeight: 600,
          background: "#525252",
          padding: "2px 6px",
          borderRadius: "4px",
        })}
      >
        total
      </div>
    </div>
  );
}

function Squiggle({
  d,
  width = "100%",
  height = 8,
  viewBox = "0 0 100 12",
}: {
  d: string;
  width?: string;
  height?: number;
  viewBox?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      preserveAspectRatio="none"
    >
      <path
        d={d}
        stroke="#171717"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#171717"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function EditArt() {
  const fieldBox: CSSProperties = {
    flex: 1,
    height: "15px",
    border: "1.5px solid #171717",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    padding: "0 5px",
    boxSizing: "border-box",
  };
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "14px 15px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "9px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "3px",
              background: "#171717",
            }}
          />
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "#1a1a1a",
              whiteSpace: "nowrap",
            }}
          >
            Acme Corp
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "#1a1a1a",
              lineHeight: 1,
            }}
          >
            INVOICE
          </div>
          <div style={mono(7, "#b0b0b0", { marginTop: "2px" })}>#2042</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          marginTop: "1px",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={mono(7, "#9a9a9a", { width: "30%" })}>Bill to</span>
          <div style={fieldBox}>
            <Squiggle d="M2 6 C 10 1, 18 11, 28 6 S 46 1, 54 6 S 72 11, 82 6 S 96 2, 98 6" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={mono(7, "#9a9a9a", { width: "30%" })}>Date</span>
          <div style={fieldBox}>
            <Squiggle d="M2 6 C 12 2, 16 10, 26 6 S 44 2, 56 6 S 70 10, 84 6 S 95 3, 98 6" />
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={mono(7, "#9a9a9a", { width: "30%" })}>Amount</span>
          <div style={{ ...fieldBox, gap: "4px", padding: "0 6px" }}>
            <span style={mono(7, "#171717")}>$</span>
            <Squiggle
              d="M2 6 C 10 2, 16 10, 26 6 S 42 2, 52 6 S 66 10, 80 6 S 86 4, 88 6"
              viewBox="0 0 90 12"
              width="60%"
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={mono(7, "#9a9a9a", { width: "30%" })}>Terms</span>
          <div
            style={{ ...fieldBox, justifyContent: "space-between", padding: "0 6px" }}
          >
            <span style={mono(7, "#171717")}>Net 30</span>
            <Chevron />
          </div>
        </div>
      </div>
      <span
        style={{
          fontSize: "8px",
          fontWeight: 700,
          color: "#3f3f46",
          marginTop: "1px",
        }}
      >
        Confirm details
      </span>
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: "13px",
              height: "13px",
              borderRadius: "3px",
              background: "#171717",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 13 4 4L19 7" />
            </svg>
          </div>
          <span style={mono(6.5, "#777")}>Yes</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div
            style={{
              width: "13px",
              height: "13px",
              borderRadius: "3px",
              border: "1.5px solid #d4d4d8",
            }}
          />
          <span style={mono(6.5, "#bbb")}>No</span>
        </div>
      </div>
      <span
        style={{
          fontSize: "8px",
          fontWeight: 700,
          color: "#3f3f46",
          marginTop: "2px",
        }}
      >
        Payment method
      </span>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div
          style={{ ...fieldBox, justifyContent: "space-between", padding: "0 6px" }}
        >
          <span style={mono(7, "#171717")}>Bank transfer</span>
          <Chevron />
        </div>
      </div>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <span style={mono(6.5, "#9a9a9a")}>Signature</span>
        <div
          style={{
            height: "24px",
            border: "1.5px solid #171717",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            padding: "0 6px",
            boxSizing: "border-box",
          }}
        >
          <Squiggle
            d="M2 8 C 18 2, 26 13, 42 7 S 70 1, 86 7 S 116 13, 134 7 S 168 2, 186 8 S 196 6, 198 7"
            viewBox="0 0 200 14"
            height={13}
          />
        </div>
      </div>
    </div>
  );
}

function SplitDoc({
  swatch,
  title,
  page,
  bars,
}: {
  swatch: string;
  title: string;
  page: ReactNode;
  bars: string[];
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        background: "#fff",
        border: "1px solid #e4e4e4",
        borderRadius: "6px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: "11px 12px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              background: swatch,
            }}
          />
          <span
            style={{
              fontSize: "8.5px",
              fontWeight: 700,
              color: "#1a1a1a",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
        </div>
        <span
          style={mono(6.5, "#171717", {
            fontWeight: 600,
            background: "#f0f0f0",
            borderRadius: "3px",
            padding: "2px 5px",
          })}
        >
          {page}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {bars.map((w, i) => (
          <div key={i} style={bar(w)} />
        ))}
      </div>
    </div>
  );
}

function SplitBoundary() {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 2px" }}
    >
      <div style={{ flex: 1, borderTop: "1.5px dashed #cfcfcf" }} />
      <span style={mono(6, "#a0a0a0", { fontWeight: 600, letterSpacing: "0.1em" })}>
        SPLIT
      </span>
      <div style={{ flex: 1, borderTop: "1.5px dashed #cfcfcf" }} />
    </div>
  );
}

function SplitArt() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "15px",
        background: "#fafafa",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <SplitDoc
        swatch="#171717"
        title="Acme Corp"
        page="p.1"
        bars={["88%", "62%"]}
      />
      <SplitBoundary />
      <SplitDoc
        swatch="#525252"
        title="Statement"
        page="p.2–3"
        bars={["80%", "70%", "54%"]}
      />
      <SplitBoundary />
      <SplitDoc
        swatch="#8a8a8a"
        title="Receipt"
        page="p.4"
        bars={["84%", "58%"]}
      />
    </div>
  );
}

function PartitionRecord({ id }: { id: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <div
          style={{
            width: "11px",
            height: "11px",
            borderRadius: "2px",
            background: "#171717",
          }}
        />
        <span style={{ fontSize: "9px", fontWeight: 700, color: "#1a1a1a" }}>
          Record
        </span>
      </div>
      <span
        style={mono(7, "#171717", {
          border: "1px solid #d4d4d4",
          borderRadius: "3px",
          padding: "1px 4px",
        })}
      >
        id: {id}
      </span>
    </div>
  );
}

function PartitionDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <div
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "#171717",
        }}
      />
      <div style={{ flex: 1, borderTop: "1.5px dashed #c2c2c2" }} />
    </div>
  );
}

function PartitionArt() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "14px 15px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "9px",
      }}
    >
      <div style={mono(6.5, "#9a9a9a", { letterSpacing: "0.06em" })}>
        PARTITION BY id
      </div>
      <PartitionRecord id="A-001" />
      <div style={bar("78%", "#ececec")} />
      <div style={bar("60%", "#ececec")} />
      <PartitionDivider />
      <PartitionRecord id="A-002" />
      <div style={bar("72%", "#ececec")} />
      <div style={bar("54%", "#ececec")} />
      <PartitionDivider />
      <PartitionRecord id="A-003" />
      <div style={bar("66%", "#ececec")} />
    </div>
  );
}

function ClassifyArt() {
  const g = "#c4c4c4";
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: "20px 22px",
        background: "#fcfcfc",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
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
              width: "16px",
              height: "16px",
              borderRadius: "4px",
              background: "#dadada",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                border: "1.5px solid #fcfcfc",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                fontSize: "9.5px",
                fontWeight: 700,
                color: "#bcbcbc",
                whiteSpace: "nowrap",
                lineHeight: 1,
              }}
            >
              Acme Corp
            </span>
            <span style={mono(5.5, "#d2d2d2", { letterSpacing: "0.04em" })}>
              12 Market St, Boston MA
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#bcbcbc",
              lineHeight: 1,
              letterSpacing: "0.04em",
            }}
          >
            INVOICE
          </div>
          <div style={mono(6.5, "#d0d0d0", { marginTop: "3px" })}>#2042</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          marginTop: "1px",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}
        >
          <span style={mono(5.5, "#cfcfcf", { letterSpacing: "0.08em" })}>
            BILL TO
          </span>
          <span style={{ fontSize: "7px", fontWeight: 600, color: "#c2c2c2" }}>
            Northwind Trading Co.
          </span>
          <span style={mono(6, "#d0d0d0")}>88 Harbor Rd, Seattle WA</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
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
              <span style={mono(6, "#cfcfcf")}>{k}</span>
              <span style={mono(6, "#c2c2c2")}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: "6px",
          alignItems: "center",
          borderTop: "1px solid #f0f0f0",
          borderBottom: "1px solid #f0f0f0",
          padding: "3px 0",
        }}
      >
        <span
          style={mono(5.5, "#cfcfcf", { width: "26px", letterSpacing: "0.06em" })}
        >
          ITEM
        </span>
        <span style={mono(5.5, "#cfcfcf", { flex: 1, letterSpacing: "0.06em" })}>
          DESCRIPTION
        </span>
        <span
          style={mono(5.5, "#cfcfcf", {
            width: "32px",
            textAlign: "right",
            letterSpacing: "0.06em",
          })}
        >
          AMT
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {[
          ["A-1", "Widget assembly", "$480"],
          ["A-2", "USB-C cable", "$96"],
          ["A-3", "Mount bracket", "$58"],
        ].map(([id, desc, amt]) => (
          <div
            key={id}
            style={{ display: "flex", gap: "6px", alignItems: "center" }}
          >
            <span style={mono(6.5, g, { width: "26px" })}>{id}</span>
            <span style={mono(6.5, "#c8c8c8", { flex: 1 })}>{desc}</span>
            <span style={mono(6.5, "#c2c2c2", { width: "32px", textAlign: "right" })}>
              {amt}
            </span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          alignItems: "flex-end",
          marginTop: "1px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", width: "50%" }}>
          <span style={mono(6, "#cfcfcf")}>Subtotal</span>
          <span style={mono(6, "#c2c2c2")}>$634</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", width: "50%" }}>
          <span style={mono(6, "#cfcfcf")}>Tax</span>
          <span style={mono(6, "#c2c2c2")}>$57</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "50%",
            borderTop: "1px solid #f0f0f0",
            paddingTop: "3px",
          }}
        >
          <span style={mono(6.5, "#bcbcbc", { fontWeight: 600 })}>Total</span>
          <span style={mono(7, "#bcbcbc", { fontWeight: 600 })}>$691</span>
        </div>
      </div>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "flex-end",
          gap: "10px",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}
        >
          <span style={mono(5.5, "#cfcfcf")}>Authorized signature</span>
          <div style={{ height: "13px", borderBottom: "1px solid #efefef" }} />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            width: "34%",
          }}
        >
          <span style={mono(5.5, "#cfcfcf")}>Date</span>
          <div style={{ height: "13px", borderBottom: "1px solid #efefef" }} />
        </div>
      </div>

      {/* the classification stamp */}
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
          background: "rgba(252,252,252,0.78)",
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
    </div>
  );
}

const primitives: readonly Primitive[] = [
  { name: "parse", Art: ParseArt },
  { name: "extract", Art: ExtractArt },
  { name: "edit", Art: EditArt },
  { name: "split", Art: SplitArt },
  { name: "partition", Art: PartitionArt },
  { name: "classify", Art: ClassifyArt },
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
