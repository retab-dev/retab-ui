import { mono, PAD, primitive } from "./kit";

const SYNTAX = primitive.ink;
const KEY = primitive.textSecondary;
const TEXT = primitive.text;
const MUTED = primitive.muted;
const NUM = primitive.text;

const LINE_ITEMS = [
  ["A-1", "Widget assembly", "$480"],
  ["A-2", "USB-C cable", "$96"],
  ["A-3", "Mount bracket", "$58"],
] as const;

const TOTALS = [
  ["Subtotal", "$634", false],
  ["Tax", "$57", false],
  ["Total", "$691", true],
] as const;

export function ParseOverlay() {
  // The reveal seam: above it = rendered document, below it = parsed source.
  const seam = 47; // %
  const parseFade = `linear-gradient(180deg, transparent 76%, color-mix(in srgb, ${primitive.panelMuted} 92%, transparent) 94%, ${primitive.panelMuted} 100%)`;
  const parseShadow =
    "0 -10px 22px -16px color-mix(in srgb, var(--homepage-primitive-ink) 35%, transparent)";

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: `${seam}%`,
          background: parseFade,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: `${seam}%`,
          bottom: 0,
          left: 0,
          right: 0,
          background: primitive.panelMuted,
          borderTop: `1px solid ${primitive.lineStrong}`,
          boxShadow: parseShadow,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${seam}%`,
          height: "1.5px",
          marginTop: "-0.75px",
          background: primitive.seam,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: `${seam}%`,
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "26px",
          height: "16px",
          borderRadius: "5px",
          background: primitive.seamHandle,
          border: `1px solid ${primitive.lineStrong}`,
          boxShadow: primitive.tagShadow,
          display: "flex",
          flexDirection: "row",
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
              background: primitive.seamDot,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: `calc(${seam}% + 12px)`,
          left: `${PAD}%`,
          right: `${PAD}%`,
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          ...mono(7, TEXT, { lineHeight: 1.35 }),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5px" }}>
          <div>
            <span style={{ color: SYNTAX }}>| </span>
            <span style={{ color: MUTED }}>Item </span>
            <span style={{ color: SYNTAX }}>| </span>
            <span style={{ color: MUTED }}>Description </span>
            <span style={{ color: SYNTAX }}>| </span>
            <span style={{ color: MUTED }}>Amt </span>
            <span style={{ color: SYNTAX }}>|</span>
          </div>
          <div style={{ color: MUTED }}>|---|---|---:|</div>
          {LINE_ITEMS.map(([item, description, amount]) => (
            <div key={item}>
              <span style={{ color: SYNTAX }}>| </span>
              <span style={{ color: TEXT }}>{item} </span>
              <span style={{ color: SYNTAX }}>| </span>
              <span style={{ color: TEXT }}>{description} </span>
              <span style={{ color: SYNTAX }}>| </span>
              <span style={{ color: NUM }}>{amount} </span>
              <span style={{ color: SYNTAX }}>|</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5px",
            marginTop: "3px",
          }}
        >
          {TOTALS.map(([label, value, strong]) => (
            <div key={label}>
              <span style={{ color: SYNTAX }}>| </span>
              <span
                style={{
                  color: strong ? KEY : MUTED,
                  fontWeight: strong ? 600 : 400,
                }}
              >
                {label}{" "}
              </span>
              <span style={{ color: SYNTAX }}>| </span>
              <span
                style={{
                  color: strong ? NUM : MUTED,
                  fontWeight: strong ? 600 : 400,
                }}
              >
                {value}{" "}
              </span>
              <span style={{ color: SYNTAX }}>|</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "3px" }}>
          <span style={{ color: SYNTAX }}>| </span>
          <span style={{ color: MUTED }}>Authorized signature </span>
          <span style={{ color: SYNTAX }}>| </span>
          <span style={{ color: MUTED }}>Date </span>
          <span style={{ color: SYNTAX }}>|</span>
        </div>
      </div>
    </>
  );
}
