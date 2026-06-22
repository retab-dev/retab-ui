import type { DemoHandleType } from "./workflow-demo-types";

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getHandleIOType(
  handleId: string | null | undefined,
): DemoHandleType | null {
  if (!handleId) return null;

  const parts = handleId.split("-");
  if (parts.length < 2) return null;

  const ioType = parts[1] as DemoHandleType;
  if (ioType === "file" || ioType === "json") return ioType;
  return null;
}
