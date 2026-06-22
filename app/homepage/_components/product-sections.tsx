import { LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";
import { JsonFormSourcesBlock } from "@/registry/new-york-v4/blocks/json-form-sources-block";

import { CopyableFeatureItem } from "./copyable-feature-item";
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

function ProductVisual({ visual }: { visual: ProductVisualContent }) {
  if (visual.kind === "workflow") {
    return <WorkflowVisual />;
  }
  if (visual.kind === "extraction") {
    return <ExtractionVisual />;
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

function ExtractionVisual() {
  return (
    <div className="h-[680px] overflow-hidden rounded-xl border shadow-sm">
      <JsonFormSourcesBlock />
    </div>
  );
}

function ReliabilityVisual() {
  return <RetabReliabilityGrid />;
}

function AgentsVisual() {
  return (
    <div
      aria-hidden="true"
      className="mcp-product-terminal aspect-[16/9] w-full min-w-0 overflow-hidden"
    >
      <HeroTerminal />
      <style>{`
        .mcp-product-terminal .mcp-hero-panel {
          display: flex;
          height: 100%;
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
      <div className="bg-muted/30 absolute inset-0" />
      <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 px-5 py-7 text-center sm:px-8 md:gap-8">
        <svg
          viewBox="0 0 928 928"
          className="text-muted-foreground/20 pointer-events-none absolute top-1/2 left-1/2 w-[42rem] max-w-none -translate-x-1/2 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          style={{
            mask: "conic-gradient(transparent 15%, black 25%, transparent 35%, transparent 65%, black 75%, transparent 85%)",
            WebkitMask:
              "conic-gradient(transparent 15%, black 25%, transparent 35%, transparent 65%, black 75%, transparent 85%)",
          }}
        >
          <circle cx="464" cy="464" r="448" className="max-lg:hidden" />
          <circle cx="464" cy="464" r="384" className="max-lg:hidden" />
          <circle cx="464" cy="464" r="320" className="max-md:hidden" />
          <circle cx="464" cy="464" r="256" />
          <circle cx="464" cy="464" r="192" />
          <circle cx="464" cy="464" r="128" />
          <circle cx="464" cy="464" r="64" />
        </svg>

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="border-border bg-background flex size-16 items-center justify-center rounded-full border shadow-sm md:size-20">
            <LockKeyhole
              aria-hidden="true"
              className="text-foreground size-7 md:size-9"
              strokeWidth={1.75}
            />
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-xl leading-tight font-medium text-balance md:text-2xl">
              Secure, private, and compliant.
            </p>
            <p className="text-muted-foreground mx-auto max-w-md text-sm leading-6 text-balance">
              Industry-leading document processing without compromising trust.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex max-w-xl flex-wrap items-center justify-center gap-2.5">
          {enterpriseCertifications.map((certification) => (
            <span
              className="border-border bg-background/80 text-foreground rounded-md border px-3 py-2 font-mono text-xs leading-none font-semibold shadow-sm"
              key={certification}
            >
              {certification}
            </span>
          ))}
        </div>

        <div className="relative z-10 hidden w-full max-w-2xl grid-cols-3 gap-3 md:grid">
          {enterpriseControls.map(([label, detail]) => (
            <div
              className="border-border bg-card/80 rounded-md border p-3 text-left shadow-sm"
              key={label}
            >
              <p className="text-foreground text-sm font-medium">{label}</p>
              <p className="text-muted-foreground mt-1 font-mono text-xs leading-4">
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
  const {
    id,
    title,
    description,
    proofCustomer,
    proof,
    features,
    visual,
    layout,
  } = lane;
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
          <FeatureList features={features} />
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
