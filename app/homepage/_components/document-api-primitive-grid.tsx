"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

import {
  PrimitiveBackdrop,
  PrimitiveStage,
  UniversalDocument,
} from "./primitive-overlays/kit";
import { ClassifyOverlay } from "./primitive-overlays/classify-overlay";
import { EditOverlay } from "./primitive-overlays/edit-overlay";
import { ExtractOverlay } from "./primitive-overlays/extract-overlay";
import { ParseOverlay } from "./primitive-overlays/parse-overlay";
import { PartitionOverlay } from "./primitive-overlays/partition-overlay";
import { SplitOverlay } from "./primitive-overlays/split-overlay";

// Every primitive card renders the same UniversalDocument; the primitive is
// expressed purely as an overlay annotation layer on top of it.

type Primitive = {
  name: PrimitiveName;
  Overlay: () => ReactNode;
  hasFrameChrome?: boolean;
  hasSharedBackdrop?: boolean;
};

type PrimitiveName =
  | "parse"
  | "extract"
  | "edit"
  | "split"
  | "partition"
  | "classify";

function PrimitivePreview({
  Overlay,
  hasFrameChrome = true,
  hasSharedBackdrop = true,
}: Primitive) {
  return (
    <div
      className={cn(
        "relative aspect-[210/297] w-full overflow-hidden rounded-[10px]",
        hasFrameChrome &&
          "border-border bg-card border shadow-sm dark:shadow-black/30",
      )}
    >
      <PrimitiveStage>
        <UniversalDocument />
        {hasSharedBackdrop ? <PrimitiveBackdrop /> : null}
        <div style={{ position: "absolute", inset: 0 }}>
          <Overlay />
        </div>
      </PrimitiveStage>
    </div>
  );
}

function PrimitiveCard(primitive: Primitive) {
  return (
    <div className="homepage-primitive-card flex flex-col">
      <div className="mb-4">
        <div className="text-foreground font-mono text-base leading-none font-medium">
          <span className="text-muted-foreground/50">/</span>
          {primitive.name}
        </div>
      </div>
      <PrimitivePreview {...primitive} />
    </div>
  );
}

const primitives: readonly Primitive[] = [
  { name: "parse", Overlay: ParseOverlay },
  { name: "extract", Overlay: ExtractOverlay },
  { name: "edit", Overlay: EditOverlay },
  {
    name: "split",
    Overlay: SplitOverlay,
    hasFrameChrome: false,
    hasSharedBackdrop: false,
  },
  { name: "partition", Overlay: PartitionOverlay },
  { name: "classify", Overlay: ClassifyOverlay },
];

function MobilePrimitiveTabs() {
  const idPrefix = useId();
  const [activeName, setActiveName] = useState<PrimitiveName>("extract");
  const tabRefs = useRef(new Map<PrimitiveName, HTMLButtonElement>());
  const activePrimitive =
    primitives.find((primitive) => primitive.name === activeName) ??
    primitives[0];

  function selectPrimitive(name: PrimitiveName, shouldFocus = false) {
    setActiveName(name);

    if (shouldFocus) {
      requestAnimationFrame(() => tabRefs.current.get(name)?.focus());
    }
  }

  function onTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    name: PrimitiveName,
  ) {
    const currentIndex = primitives.findIndex(
      (primitive) => primitive.name === name,
    );
    const lastIndex = primitives.length - 1;
    let nextIndex = currentIndex;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextPrimitive = primitives[nextIndex];
    if (nextPrimitive) selectPrimitive(nextPrimitive.name, true);
  }

  return (
    <div data-homepage-primitive-mobile-tabs className="sm:hidden">
      <div
        role="tablist"
        aria-label="Document API primitives"
        className="bg-muted/60 border-border mb-5 grid grid-cols-3 gap-1 rounded-lg border p-1 shadow-sm"
      >
        {primitives.map((primitive) => {
          const isActive = primitive.name === activeName;
          const tabId = `${idPrefix}-${primitive.name}-tab`;
          const panelId = `${idPrefix}-${primitive.name}-panel`;

          return (
            <button
              key={primitive.name}
              ref={(node) => {
                if (node) tabRefs.current.set(primitive.name, node);
                else tabRefs.current.delete(primitive.name);
              }}
              type="button"
              id={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              data-primitive-tab={primitive.name}
              data-active={isActive ? "true" : undefined}
              onClick={() => selectPrimitive(primitive.name)}
              onKeyDown={(event) => onTabKeyDown(event, primitive.name)}
              className={cn(
                "focus-visible:ring-ring flex h-9 min-w-0 items-center justify-center rounded-md px-2 font-mono text-sm leading-none font-medium transition-colors outline-none focus-visible:ring-2",
                isActive
                  ? "bg-background text-foreground dark:bg-input shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "text-muted-foreground/50",
                  isActive && "text-muted-foreground",
                )}
              >
                /
              </span>
              {primitive.name}
            </button>
          );
        })}
      </div>

      <div
        id={`${idPrefix}-${activePrimitive.name}-panel`}
        role="tabpanel"
        aria-labelledby={`${idPrefix}-${activePrimitive.name}-tab`}
        data-primitive-tabpanel={activePrimitive.name}
        className="homepage-primitive-card mx-auto w-full max-w-[360px]"
      >
        <PrimitivePreview {...activePrimitive} />
      </div>
    </div>
  );
}

export function DocumentApiPrimitiveGrid() {
  return (
    <>
      <MobilePrimitiveTabs />
      <div
        aria-hidden="true"
        data-homepage-primitive-desktop-grid
        className="hidden gap-x-16 gap-y-10 sm:grid sm:grid-cols-2 lg:grid-cols-3"
      >
        {primitives.map((primitive) => (
          <PrimitiveCard key={primitive.name} {...primitive} />
        ))}
      </div>
    </>
  );
}
