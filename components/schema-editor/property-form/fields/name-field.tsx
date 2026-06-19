"use client";

import { AlertCircle } from "lucide-react";

import type { FieldValidation } from "@/components/schema-editor/property-form/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NameField({
  value,
  disabled,
  validation,
  onChange,
}: {
  value: string;
  disabled: boolean;
  validation: FieldValidation;
  onChange: (name: string) => void;
}) {
  const message =
    validation.status === "invalid" ? validation.message : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor="name">Name</Label>
      <Input
        id="name"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${message ? "border-destructive" : ""} ${disabled ? "disabled:opacity-100" : ""}`}
        placeholder="e.g. first_name or firstName"
        required
        aria-invalid={Boolean(message)}
      />
      {message && (
        <p className="text-destructive mt-1 flex items-center gap-1 text-sm font-medium">
          <AlertCircle className="h-3 w-3" />
          {message}
        </p>
      )}
    </div>
  );
}
