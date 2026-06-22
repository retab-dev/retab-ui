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

const enterpriseStripeGroups = [
  {
    className: "left-[7%] top-[16%] w-60 -rotate-6",
    stripes: ["w-28", "w-48", "w-36", "w-56", "w-40"],
  },
  {
    className: "right-[8%] top-[18%] w-56 rotate-6",
    stripes: ["ml-auto w-32", "ml-auto w-52", "ml-auto w-40", "ml-auto w-48"],
  },
  {
    className: "left-[11%] bottom-[22%] w-52 rotate-[-10deg]",
    stripes: ["w-44", "w-32", "w-52", "w-24"],
  },
  {
    className: "right-[12%] bottom-[21%] w-64 rotate-[9deg]",
    stripes: ["ml-auto w-48", "ml-auto w-28", "ml-auto w-60", "ml-auto w-36"],
  },
  {
    className: "left-1/2 top-[9%] hidden w-72 -translate-x-1/2 md:flex",
    stripes: ["mx-auto w-44", "mx-auto w-72", "mx-auto w-56"],
  },
] as const satisfies readonly {
  className: string;
  stripes: readonly string[];
}[];

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
        <div className="bg-muted-foreground/10 absolute inset-x-[8%] top-[46%] h-px" />
        <div className="bg-muted-foreground/10 absolute inset-y-[14%] left-1/2 w-px" />

        {enterpriseStripeGroups.map((group) => (
          <EnterpriseStripeGroup
            className={group.className}
            key={group.className}
            stripes={group.stripes}
          />
        ))}

        <div className="border-border/80 bg-card absolute top-1/2 left-1/2 z-10 flex w-[min(90%,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-md border p-4 text-center shadow-sm sm:w-[30rem] md:top-[43%] md:gap-4 md:p-6">
          <div className="flex items-center gap-3">
            <span className="bg-muted-foreground/15 h-1.5 w-14 rounded-full" />
            <span className="bg-muted-foreground/10 h-1.5 w-7 rounded-full" />
            <div className="border-border bg-background flex size-12 items-center justify-center rounded-md border shadow-sm sm:size-14">
              <LockKeyhole
                aria-hidden="true"
                className="text-foreground size-6 sm:size-7"
                strokeWidth={1.8}
              />
            </div>
            <span className="bg-muted-foreground/10 h-1.5 w-7 rounded-full" />
            <span className="bg-muted-foreground/15 h-1.5 w-14 rounded-full" />
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

function EnterpriseStripeGroup({
  className,
  stripes,
}: {
  className: string;
  stripes: readonly string[];
}) {
  return (
    <div className={cn("absolute flex flex-col gap-2.5", className)}>
      {stripes.map((stripe, index) => (
        <span
          className={cn(
            "bg-muted-foreground/15 block h-2 rounded-full shadow-[0_1px_0_rgba(0,0,0,0.03)]",
            index % 2 === 0 && "bg-muted-foreground/20",
            stripe,
          )}
          key={`${stripe}-${index}`}
        />
      ))}
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
