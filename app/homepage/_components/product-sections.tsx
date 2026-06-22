import { LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";

import { CopyableFeatureItem } from "./copyable-feature-item";
import { DocumentApiPrimitiveGrid } from "./document-api-primitive-grid";
import { productLanes } from "./homepage-content";
import {
  type ProductFeatureContent,
  type ProductLaneContent,
  type ProductVisualContent,
} from "./homepage-types";
import { HeroTerminal } from "./mcp-hero-terminal";
import { RetabReliabilityGrid } from "./retab-reliability/reliability-grid";
import { SectionHeader } from "./section-header";
import { RetabWorkflowDemo } from "./workflow-demo/retab-workflow-demo";

const productLaneSpacingClasses = [
  "mt-40 md:mt-24 lg:mt-52",
  "mt-16 md:mt-44 lg:mt-56",
  "mt-16 md:mt-44 lg:mt-52",
  "mt-16 md:mt-44 lg:mt-56",
  "mt-16 md:mt-44 lg:mt-52",
] as const;

const enterpriseCertifications = ["SOC2 Type II", "HIPAA", "CCPA", "GDPR"];

const enterpriseControls = [
  ["Data controls", "privacy by design"],
  ["Deployment", "cloud or self-hosted"],
  ["Governance", "audit-ready traces"],
] as const;

const enterpriseFrames = [
  "left-[6%] top-[10%] h-[22%] w-[13%]",
  "left-[22%] top-[11%] h-[9%] w-[6%]",
  "left-[31%] top-[9%] h-[15%] w-[11%]",
  "right-[8%] top-[13%] h-[12%] w-[7%]",
  "left-[8%] bottom-[18%] h-[12%] w-[7%]",
  "left-[22%] bottom-[9%] h-[10%] w-[8%]",
  "right-[23%] bottom-[11%] h-[11%] w-[7%]",
  "right-[7%] bottom-[16%] h-[18%] w-[8%]",
] as const;

const enterpriseSignalClusters = [
  {
    className: "left-[8%] top-[37%]",
    shapes: ["triangle", "square", "circle", "triangle", "circle", "square"],
  },
  {
    className: "left-[25%] top-[31%]",
    shapes: ["square", "circle", "triangle", "square", "circle", "triangle"],
  },
  {
    className: "right-[16%] top-[30%]",
    shapes: ["circle", "square", "triangle", "circle", "triangle", "square"],
  },
  {
    className: "left-[14%] bottom-[9%]",
    shapes: ["square", "triangle", "circle", "square", "circle", "triangle"],
  },
  {
    className: "right-[12%] bottom-[8%]",
    shapes: ["triangle", "circle", "square", "triangle", "square", "circle"],
  },
] as const satisfies readonly {
  className: string;
  shapes: readonly EnterpriseSignalShape[];
}[];

type EnterpriseSignalShape = "circle" | "square" | "triangle";

function ProductVisual({ visual }: { visual: ProductVisualContent }) {
  if (visual.kind === "workflow") {
    return <WorkflowVisual />;
  }
  if (visual.kind === "extraction") {
    return <DocumentApiPrimitiveGrid />;
  }
  if (visual.kind === "agents") {
    return <AgentsVisual />;
  }
  if (visual.kind === "enterprise") {
    return <EnterpriseVisual />;
  }
  return <ReliabilityVisual />;
}

function WorkflowVisual() {
  return (
    <div
      aria-label="Interactive workflow demo"
      className="border-border bg-card relative aspect-[16/11] w-full overflow-hidden rounded-md border shadow-sm"
      role="group"
    >
      <RetabWorkflowDemo className="absolute inset-0" />
    </div>
  );
}

function ReliabilityVisual() {
  return <RetabReliabilityGrid />;
}

function AgentsVisual() {
  return (
    <div aria-hidden="true" className="mcp-product-terminal w-full min-w-0">
      <HeroTerminal />
      <style>{`
        .mcp-product-terminal .mcp-hero-panel {
          display: flex;
          aspect-ratio: 16 / 9;
          width: 100%;
          flex-direction: column;
        }

        .mcp-product-terminal .mcp-hero-body {
          min-height: 0;
          flex: 1 1 0;
          height: auto;
        }
      `}</style>
    </div>
  );
}

function EnterpriseVisual() {
  return (
    <div
      aria-hidden="true"
      className="border-border bg-card relative aspect-[16/11] w-full overflow-hidden rounded-md border shadow-sm"
    >
      <div className="bg-card absolute inset-0" />
      <div className="absolute inset-4 overflow-hidden rounded-sm md:inset-6">
        <svg
          viewBox="0 0 960 660"
          className="text-muted-foreground/25 absolute inset-0 size-full"
          fill="none"
          stroke="currentColor"
          strokeDasharray="9 11"
          strokeLinecap="round"
          strokeWidth="1.5"
        >
          <path d="M122 196 C258 224 312 316 454 320" />
          <path d="M838 186 C694 218 650 314 506 320" />
          <path d="M148 506 C278 458 320 392 454 366" />
          <path d="M812 512 C680 458 632 394 506 366" />
          <path d="M480 182 V474" strokeDasharray="4 16" />
        </svg>

        {enterpriseFrames.map((className) => (
          <EnterpriseFrame className={className} key={className} />
        ))}

        {enterpriseSignalClusters.map((cluster) => (
          <EnterpriseSignalCluster
            className={cluster.className}
            key={cluster.className}
            shapes={cluster.shapes}
          />
        ))}

        <div className="border-border/80 bg-card absolute top-[46%] left-1/2 z-10 flex w-[min(84%,34rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-md border p-4 text-center shadow-sm sm:w-[30rem] md:top-[43%] md:gap-4 md:p-6">
          <div className="border-border bg-background flex size-14 items-center justify-center rounded-md border shadow-sm">
            <LockKeyhole
              aria-hidden="true"
              className="text-foreground size-7"
              strokeWidth={1.8}
            />
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-xl leading-tight font-medium text-balance md:text-2xl">
              Secure, private, and compliant.
            </p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-6 text-balance">
              Document automation with policies, traces, and deployment controls
              built in.
            </p>
          </div>

          <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
            {enterpriseCertifications.map((certification) => (
              <span
                className="border-border bg-background text-foreground rounded-md border px-3 py-2 font-mono text-xs leading-none font-semibold shadow-sm"
                key={certification}
              >
                {certification}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute right-5 bottom-5 left-5 z-20 hidden grid-cols-3 gap-3 md:grid">
          {enterpriseControls.map(([label, detail]) => (
            <div
              className="border-border bg-card/95 rounded-md border p-4 text-left shadow-sm"
              key={label}
            >
              <p className="text-foreground text-sm font-medium">{label}</p>
              <p className="text-muted-foreground mt-2 font-mono text-xs leading-4">
                {detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EnterpriseFrame({ className }: { className: string }) {
  return (
    <div
      className={cn(
        "border-muted-foreground/25 absolute rounded-[2px] border border-dashed",
        className,
      )}
    />
  );
}

function EnterpriseSignalCluster({
  className,
  shapes,
}: {
  className: string;
  shapes: readonly EnterpriseSignalShape[];
}) {
  return (
    <div className={cn("absolute grid grid-cols-3 gap-2", className)}>
      {shapes.map((shape, index) => (
        <EnterpriseSignalShapeMark key={`${shape}-${index}`} shape={shape} />
      ))}
    </div>
  );
}

function EnterpriseSignalShapeMark({
  shape,
}: {
  shape: EnterpriseSignalShape;
}) {
  if (shape === "triangle") {
    return (
      <span className="border-b-muted-foreground/30 block size-0 border-x-[5px] border-b-[9px] border-x-transparent" />
    );
  }
  if (shape === "circle") {
    return (
      <span className="bg-muted-foreground/30 block size-2.5 rounded-full" />
    );
  }
  return <span className="bg-muted-foreground/30 block size-2.5" />;
}

function isCopyableFeature(
  feature: ProductFeatureContent,
): feature is Extract<ProductFeatureContent, { command: string }> {
  return typeof feature !== "string";
}

function FeatureList({
  features,
}: {
  features: readonly ProductFeatureContent[];
}) {
  return (
    <ul className="text-foreground m-0 flex list-none flex-col gap-1.5 p-0 font-mono text-sm leading-5 font-semibold break-words uppercase">
      <li className="text-muted-foreground font-normal normal-case">
        Features
      </li>
      {features.map((feature) =>
        isCopyableFeature(feature) ? (
          <CopyableFeatureItem feature={feature} key={feature.label} />
        ) : (
          <li key={feature}>{feature}</li>
        ),
      )}
    </ul>
  );
}

function ProductLane({
  lane,
  spacingClass,
}: {
  lane: ProductLaneContent;
  spacingClass: string;
}) {
  const { id, title, description, proofCustomer, proof, visual, layout } = lane;
  const isReversed = layout === "reversed";
  const sectionId = `homepage-product-${id}`;

  return (
    <section aria-labelledby={sectionId} className={spacingClass}>
      <SectionHeader
        id={sectionId}
        title={title}
        description={description}
        placement={isReversed ? "reversed" : "default"}
      />
      <div className="mt-10 grid gap-8 lg:mt-11 lg:grid-cols-12 lg:items-start lg:gap-5">
        <div
          className={cn(
            "min-w-0 lg:col-span-8",
            isReversed && "lg:col-start-5",
          )}
        >
          <ProductVisual visual={visual} />
        </div>
        <div
          className={cn(
            "mt-8 min-w-0 space-y-8 lg:col-span-3 lg:mt-0 lg:pt-8",
            isReversed ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-10",
          )}
        >
          <p className="text-foreground max-w-sm text-3xl leading-tight text-balance md:text-4xl">
            <span className="text-muted-foreground">{proofCustomer}</span>{" "}
            {proof}
          </p>
          <FeatureList features={lane.features} />
        </div>
      </div>
    </section>
  );
}

export function ProductSections() {
  return (
    <>
      {productLanes.map((lane, index) => (
        <ProductLane
          key={lane.id}
          lane={lane}
          spacingClass={
            productLaneSpacingClasses[index] ?? productLaneSpacingClasses[1]
          }
        />
      ))}
    </>
  );
}
