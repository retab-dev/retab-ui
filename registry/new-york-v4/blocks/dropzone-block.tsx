"use client";

import { DropzoneShowcase } from "./dropzone-showcase";

export function DropzoneBlock() {
  return (
    <div className="bg-background h-full min-h-[760px] overflow-auto p-5">
      <DropzoneShowcase />
    </div>
  );
}
