import type { CSSProperties } from "react";

import { mono, primitive, transparent } from "./kit";

// Classifier result: the document is categorized among candidate types, with
// the matched type selected + a confidence value, the rest dimmed — a labeled
// model prediction rather than a rubber stamp. The faded document backdrop
// keeps the verdict on top.
const ACCENT = primitive.success; // single restrained accent (matched check)

type Candidate = {
  label: string;
  confidence: number;
  matched?: boolean;
};

const CANDIDATES: ReadonlyArray<Candidate> = [
  { label: "Invoice", confidence: 96, matched: true },
  { label: "Receipt", confidence: 3 },
  { label: "Statement", confidence: 1 },
  { label: "Contract", confidence: 0 },
];

const CHECK: CSSProperties = {
  width: "11px",
  height: "11px",
  flexShrink: 0,
};

export function ClassifyOverlay() {
  return (
    <>
      {/* fade the document so the verdict reads on top */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: primitive.overlayFade,
          backdropFilter: "saturate(0.9)",
        }}
      />

      {/* classifier result card */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "70%",
          background: primitive.panel,
          border: `1px solid ${primitive.lineStrong}`,
          borderRadius: "10px",
          boxShadow: primitive.panelShadow,
          overflow: "hidden",
        }}
      >
        {/* header: model output label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "7px 9px",
            borderBottom: `1px solid ${primitive.lineSoft}`,
          }}
        >
          <span style={mono(6.5, primitive.muted, { letterSpacing: "0.1em" })}>
            CLASSIFY
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <span
              style={{
                width: "4px",
                height: "4px",
                borderRadius: "50%",
                background: ACCENT,
              }}
            />
            <span style={mono(6, primitive.mid, { letterSpacing: "0.06em" })}>
              4 types
            </span>
          </span>
        </div>

        {/* candidate categories */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "5px",
            gap: "2px",
          }}
        >
          {CANDIDATES.map(({ label, confidence, matched }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "4px 6px",
                borderRadius: "6px",
                background: matched ? transparent(ACCENT, 9) : "transparent",
                border: matched
                  ? `1px solid ${transparent(ACCENT, 36)}`
                  : "1px solid transparent",
              }}
            >
              {matched ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={CHECK}
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <span
                  style={{
                    ...CHECK,
                    borderRadius: "50%",
                    border: `1.5px solid ${primitive.lineStrong}`,
                  }}
                />
              )}

              <span
                style={mono(
                  matched ? 9 : 8,
                  matched ? primitive.ink : primitive.muted,
                  {
                    fontWeight: matched ? 700 : 400,
                    flex: 1,
                  },
                )}
              >
                {label}
              </span>

              {/* confidence bar */}
              <span
                style={{
                  position: "relative",
                  width: "34px",
                  height: "3px",
                  borderRadius: "2px",
                  background: primitive.lineStrong,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    // give any nonzero confidence a perceptible nub so 1–3%
                    // reads as "low" rather than as an empty track
                    width: confidence === 0 ? "0%" : `max(${confidence}%, 9%)`,
                    background: matched ? ACCENT : primitive.faint,
                  }}
                />
              </span>

              <span
                style={mono(7.5, matched ? primitive.ink : primitive.muted, {
                  fontWeight: matched ? 700 : 400,
                  width: "22px",
                  textAlign: "right",
                })}
              >
                {confidence}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
