"use client";

import { cn } from "@/lib/utils";
import { useDropzone } from "@/components/ui/dropzone";

import { type DropzoneExampleProps } from "./dropzone-example-shared";

export function DisabledDropzone({ className }: DropzoneExampleProps) {
  const dropzone = useDropzone({ disabled: true, multiple: true });

  return (
    <section
      {...dropzone.getRootProps(
        dropzone.getTriggerProps({
          "data-slot": "dropzone",
          className: cn(
            "flex min-h-40 flex-col justify-center rounded-lg border border-dashed bg-muted/20 p-4 opacity-60 outline-none",
            className,
          ),
        }),
      )}
    >
      <input {...dropzone.getInputProps({ className: "hidden" })} />
      <div className="text-sm font-medium">Disabled state</div>
      <div className="text-muted-foreground mt-1 text-xs">
        The primitive disables input, trigger focus, and drag state.
      </div>
    </section>
  );
}
