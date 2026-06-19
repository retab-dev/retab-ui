"use client";

import { CalendarIcon, ClockIcon } from "lucide-react";

import type { DataCellKind } from "@/registry/new-york-v4/ui/data-cell-types";

export function DataCellPickerIcon({ kind }: { kind: DataCellKind }) {
  if (kind === "time") return <ClockIcon />;
  return <CalendarIcon />;
}
