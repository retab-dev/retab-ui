import type { CSSProperties } from "react";

import { BAND, Chip, mono, PAD } from "./kit";

// One strong idea: the Total is the single active edit target. A focused
// field outline lands exactly on the real Total row beneath, the label stays
// untouched (formatting preserved) and the value shows a before -> after
// change — old "$691" ghosted/struck, new "$715" with a live caret.
const ACCENT = "#2563eb"; // one restrained accent for the focus ring

export function EditOverlay() {
  const caret: CSSProperties = {
    width: "1.5px",
    height: "10px",
    background: "#171717",
    marginLeft: "2px",
  };

  return (
    <>
      {/* focused field outline — overlays the Total row's right-aligned block
          (52% wide, flush to the right inset) so the layout stays intact */}
      <div
        style={{
          position: "absolute",
          right: `${PAD - 1.4}%`,
          top: `${BAND.total - 1.6}%`,
          width: "47%",
          height: "8.4%",
          boxSizing: "border-box",
          border: `1.5px solid ${ACCENT}`,
          borderRadius: "4px",
          background: "#fff",
          boxShadow: `0 0 0 3px ${ACCENT}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 5px",
        }}
      >
        {/* label is preserved exactly as the document renders it */}
        <span style={mono(7, "#171717", { fontWeight: 600 })}>Total</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          {/* old value, ghosted + struck */}
          <span
            style={mono(7, "#9a9a9a", {
              textDecoration: "line-through",
              textDecorationColor: "#c4c4c4",
            })}
          >
            $691
          </span>
          {/* new value being typed in place */}
          <span style={{ display: "flex", alignItems: "center" }}>
            <span style={mono(7.5, "#171717", { fontWeight: 600 })}>$715</span>
            <span style={caret} />
          </span>
        </span>
      </div>

      {/* tiny "edited" chip pinned just above the field's left edge, where the
          space is empty — keeps it off the Tax value on the row above */}
      <Chip bg={ACCENT} style={{ left: "46%", top: `${BAND.total - 6}%` }}>
        edited
      </Chip>
    </>
  );
}
