"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";
import {
  SchemaRowGrip,
  type SchemaRowGripMode,
} from "@/components/schema-editor/primitives/schema-row-grip";

interface SchemaFieldRowProps {
  id?: string;
  grip: SchemaRowGripMode;
  name: React.ReactNode;
  description: React.ReactNode;
  actions?: React.ReactNode;
  type: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SchemaFieldRow({
  id,
  grip,
  name,
  description,
  actions,
  type,
  children,
  className,
  bodyClassName,
}: SchemaFieldRowProps) {
  return (
    <div
      id={id}
      data-slot="schema-field-row"
      className={cn("group/row", className)}
    >
      <div className="hover:bg-accent flex min-h-12 flex-col items-start justify-between py-0 sm:flex-row sm:items-center">
        <SchemaRowGrip mode={grip} />
        <div className="flex min-w-0 flex-1 items-center space-x-2">
          {name}
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {description}
          </div>
        </div>
        <div className="flex items-center gap-2 pr-1">
          {actions}
          {type}
        </div>
      </div>
      {children ? <div className={bodyClassName}>{children}</div> : null}
    </div>
  );
}
