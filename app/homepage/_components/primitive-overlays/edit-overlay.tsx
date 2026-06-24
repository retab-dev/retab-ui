import type { CSSProperties, ReactNode } from "react";

import { BAND, Chip, mono, PAD, primitive, transparent } from "./kit";

const ACCENT = primitive.focus; // one restrained accent for the focus ring

function EditableField({
  top,
  left,
  right,
  width,
  children,
  style,
}: {
  top: number;
  left?: number;
  right?: number;
  width: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        width,
        ...(left !== undefined ? { left: `${left}%` } : {}),
        ...(right !== undefined ? { right: `${right}%` } : {}),
        boxSizing: "border-box",
        border: `1px solid ${transparent(ACCENT, 72)}`,
        borderRadius: "4px",
        background: primitive.paper,
        boxShadow: `0 0 0 2px ${transparent(ACCENT, 11)}`,
        display: "flex",
        alignItems: "center",
        minHeight: "4.6%",
        padding: "0 4px",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function EditOverlay() {
  const caret: CSSProperties = {
    width: "1.5px",
    height: "10px",
    background: primitive.ink,
    marginLeft: "2px",
  };

  return (
    <>
      <EditableField top={BAND.parties + 2.8} left={PAD - 1} width="43%">
        <span
          style={mono(6.5, primitive.ink, {
            fontWeight: 600,
            lineHeight: 1,
            whiteSpace: "nowrap",
          })}
        >
          Northwind Trading LLC
        </span>
      </EditableField>

      <EditableField
        top={BAND.parties + 1.6}
        right={PAD - 1.4}
        width="21%"
        style={{ minHeight: "3.4%" }}
      >
        <span style={mono(6.5, primitive.ink, { lineHeight: 1 })}>
          Apr 10, 2024
        </span>
      </EditableField>

      <EditableField
        top={BAND.row2 - 1.8}
        right={PAD - 1.4}
        width="14.5%"
        style={{ justifyContent: "flex-end" }}
      >
        <span style={mono(6.7, primitive.ink, { lineHeight: 1 })}>$120</span>
      </EditableField>

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
          background: primitive.paper,
          boxShadow: `0 0 0 3px ${transparent(ACCENT, 16)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 5px",
        }}
      >
        {/* label is preserved exactly as the document renders it */}
        <span style={mono(7, primitive.ink, { fontWeight: 600 })}>Total</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          {/* old value, ghosted + struck */}
          <span
            style={mono(7, primitive.muted, {
              textDecoration: "line-through",
              textDecorationColor: primitive.lineStrong,
            })}
          >
            $691
          </span>
          {/* new value being typed in place */}
          <span style={{ display: "flex", alignItems: "center" }}>
            <span style={mono(7.5, primitive.ink, { fontWeight: 600 })}>
              $715
            </span>
            <span style={caret} />
          </span>
        </span>
      </div>

      {/* tiny "edited" chip pinned just above the field's left edge, where the
          space is empty — keeps it off the Tax value on the row above */}
      <Chip
        bg={ACCENT}
        fg={primitive.focusFg}
        style={{ left: "46%", top: `${BAND.total - 6}%` }}
      >
        edited
      </Chip>
    </>
  );
}
