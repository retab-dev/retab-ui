"use client";

import type * as React from "react";

import { Label } from "@/components/ui/label";

export function ArrayItemsField({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-muted-foreground text-xs">List item type</Label>
      {children}
    </div>
  );
}
