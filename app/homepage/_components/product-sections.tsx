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

const enterpriseRibbonLines = [0, 1, 2, 3, 4, 5, 6, 7] as const;

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
      className="border-border bg-card relative aspect-[4/5] w-full overflow-hidden rounded-md border shadow-sm sm:aspect-[16/11]"
    >
      <div className="bg-card absolute inset-0" />
      <div className="absolute inset-4 overflow-hidden rounded-sm md:inset-6">
        <svg
          aria-hidden="true"
          className="text-muted-foreground/28 absolute inset-0 size-full"
          fill="none"
          viewBox="0 0 960 660"
        >
          <g
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="0.95"
            vectorEffect="non-scaling-stroke"
          >
            {enterpriseRibbonLines.map((line) => (
              <path
                d={`M -72 ${118 + line * 10} C 72 ${56 + line * 4} 188 ${
                  74 + line * 7
                } 306 ${152 + line * 7} S 532 ${238 + line * 5} 670 ${
                  126 + line * 8
                }`}
                key={`enterprise-wave-top-${line}`}
              />
            ))}
            {enterpriseRibbonLines.map((line) => (
              <path
                d={`M ${604 + line * 12} ${126 + line * 9} C ${
                  722 + line * 16
                } ${78 + line * 6} ${812 + line * 18} ${
                  122 + line * 8
                } ${1034 + line * 12} ${54 + line * 9}`}
                key={`enterprise-wave-right-${line}`}
              />
            ))}
            {enterpriseRibbonLines.map((line) => (
              <path
                d={`M ${14 + line * 10} ${552 + line * 12} L ${
                  354 + line * 12
                } ${406 + line * 7}`}
                key={`enterprise-diagonal-left-${line}`}
              />
            ))}
            {enterpriseRibbonLines.slice(0, 6).map((line) => (
              <path
                d={`M ${578 + line * 22} ${560 + line * 8} C ${
                  666 + line * 18
                } ${498 - line * 4} ${756 + line * 18} ${
                  610 + line * 2
                } 966 ${486 + line * 10}`}
                key={`enterprise-wave-bottom-${line}`}
              />
            ))}
          </g>
        </svg>

        <div className="border-border/80 bg-card absolute top-1/2 left-1/2 z-10 flex w-[min(90%,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-md border p-4 text-center shadow-sm sm:w-[30rem] md:top-[43%] md:gap-4 md:p-6">
          <div className="border-border bg-background flex size-12 items-center justify-center rounded-md border shadow-sm sm:size-14">
            <LockKeyhole
              aria-hidden="true"
              className="text-foreground size-6 sm:size-7"
              strokeWidth={1.8}
            />
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-lg leading-tight font-medium text-balance sm:text-xl md:text-2xl">
              Secure, private, and compliant.
            </p>
            <p className="text-muted-foreground mx-auto max-w-[17rem] text-xs leading-5 text-balance sm:max-w-sm sm:text-sm sm:leading-6">
              Document automation with policies, traces, and deployment controls
              built in.
            </p>
          </div>

          <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
            {enterpriseCertifications.map((certification) => (
              <span
                className="border-border bg-background text-foreground rounded-md border px-2.5 py-1.5 font-mono text-[11px] leading-none font-semibold shadow-sm sm:px-3 sm:py-2 sm:text-xs"
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
