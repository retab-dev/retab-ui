import type { ReactNode } from "react";

import { UniversalDocument } from "./primitive-overlays/kit";
import { ClassifyOverlay } from "./primitive-overlays/classify-overlay";
import { EditOverlay } from "./primitive-overlays/edit-overlay";
import { ExtractOverlay } from "./primitive-overlays/extract-overlay";
import { ParseOverlay } from "./primitive-overlays/parse-overlay";
import { PartitionOverlay } from "./primitive-overlays/partition-overlay";
import { SplitOverlay } from "./primitive-overlays/split-overlay";

// Every primitive card renders the same UniversalDocument; the primitive is
// expressed purely as an overlay annotation layer on top of it.

type Primitive = {
  name: string;
  Overlay: () => ReactNode;
};

function PrimitiveCard({ name, Overlay }: Primitive) {
  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <div className="text-foreground font-mono text-base leading-none font-medium">
          <span className="text-muted-foreground/50">/</span>
          {name}
        </div>
      </div>
      <div className="border-border relative aspect-[210/297] w-full overflow-hidden rounded-[10px] border">
        <UniversalDocument />
        <div style={{ position: "absolute", inset: 0 }}>
          <Overlay />
        </div>
      </div>
    </div>
  );
}

const primitives: readonly Primitive[] = [
  { name: "parse", Overlay: ParseOverlay },
  { name: "extract", Overlay: ExtractOverlay },
  { name: "edit", Overlay: EditOverlay },
  { name: "split", Overlay: SplitOverlay },
  { name: "partition", Overlay: PartitionOverlay },
  { name: "classify", Overlay: ClassifyOverlay },
];

export function DocumentApiPrimitiveGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-x-16 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
    >
      {primitives.map((primitive) => (
        <PrimitiveCard key={primitive.name} {...primitive} />
      ))}
    </div>
  );
}
