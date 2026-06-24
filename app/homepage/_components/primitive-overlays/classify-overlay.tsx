import { mono, primitive, transparent } from "./kit";

export function ClassifyOverlay() {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%) rotate(-7deg)",
          border: `2.5px solid ${primitive.ink}`,
          borderRadius: "9px",
          padding: "11px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "3px",
          background: transparent(primitive.panel, 86),
          boxShadow: primitive.panelShadow,
        }}
      >
        <span
          style={mono(19, primitive.ink, {
            fontWeight: 700,
            letterSpacing: "0.09em",
            lineHeight: 1,
          })}
        >
          INVOICE
        </span>
        <span style={mono(8, primitive.mid, { letterSpacing: "0.05em" })}>
          classified
        </span>
      </div>
    </>
  );
}
