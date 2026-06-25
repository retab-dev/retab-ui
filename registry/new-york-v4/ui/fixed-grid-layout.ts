import type * as React from "react";

type CssLength = number | string;
type CssLengthProperty =
  | "height"
  | "marginTop"
  | "minWidth"
  | "width";

export function getFixedGridCanvasStyle({
  width,
  minWidth = "100%",
  contain = false,
}: {
  width?: CssLength;
  minWidth?: CssLength;
  contain?: boolean;
}): React.CSSProperties {
  return {
    position: "relative",
    ...cssLengthProperty("width", width),
    ...cssLengthProperty("minWidth", minWidth),
    ...(contain ? { contain: "layout paint style" } : null),
  };
}

export function getFixedGridRowWindowStyle({
  height,
  minWidth,
}: {
  height: CssLength;
  minWidth?: CssLength;
}): React.CSSProperties {
  return {
    position: "relative",
    ...cssLengthProperty("height", height),
    ...cssLengthProperty("minWidth", minWidth),
  };
}

export function getFixedGridInverseRowOffsetStyle({
  height,
  minWidth,
}: {
  height: CssLength;
  minWidth?: CssLength;
}): React.CSSProperties {
  return {
    ...cssLengthProperty("height", height),
    ...cssLengthProperty("minWidth", minWidth),
  };
}

export function getFixedGridInverseStickyRowWindowStyle({
  height,
  minWidth,
  viewportHeight,
}: {
  height: number;
  minWidth?: CssLength;
  viewportHeight: number;
}): React.CSSProperties {
  const stickyOffset = fixedGridInverseStickyOffset({
    viewportSize: viewportHeight,
    windowSize: height,
  });

  return {
    position: "sticky",
    ...cssLengthProperty("height", height),
    ...cssLengthProperty("minWidth", minWidth),
    top: `${stickyOffset}px`,
    bottom: `${stickyOffset}px`,
  };
}

export function getFixedGridInverseRowWindowStyle({
  height,
  minWidth,
  top,
  viewportHeight,
}: {
  height: number;
  minWidth?: CssLength;
  top: number;
  viewportHeight: number;
}): React.CSSProperties {
  const stickyOffset = fixedGridInverseStickyOffset({
    viewportSize: viewportHeight,
    windowSize: height,
  });

  return {
    position: "sticky",
    ...cssLengthProperty("height", height),
    ...cssLengthProperty("marginTop", top),
    ...cssLengthProperty("minWidth", minWidth),
    top: `${stickyOffset}px`,
    bottom: `${stickyOffset}px`,
  };
}

export function fixedGridInverseStickyOffset({
  viewportSize,
  windowSize,
}: {
  viewportSize: number;
  windowSize: number;
}) {
  const offset = Math.max(
    0,
    safeCssNumber(windowSize) - safeCssNumber(viewportSize),
  );
  return offset === 0 ? 0 : -offset;
}

function formatCssLength(value: CssLength | undefined) {
  if (typeof value === "string") return value.trim() ? value : undefined;
  if (typeof value !== "number") return value;
  return Number.isFinite(value) && value >= 0 ? `${value}px` : undefined;
}

function cssLengthProperty<Property extends CssLengthProperty>(
  property: Property,
  value: CssLength | undefined,
): Pick<React.CSSProperties, Property> | object {
  const formattedValue = formatCssLength(value);
  return formattedValue === undefined ? {} : { [property]: formattedValue };
}

function safeCssNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}
