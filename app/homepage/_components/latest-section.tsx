import Link from "next/link";

import { cn } from "@/lib/utils";

import { featuredLatestCard, secondaryLatestCards } from "./homepage-content";
import {
  type FeaturedLatestCard as FeaturedLatestCardContent,
  type LatestMetric,
  type SecondaryLatestCard as SecondaryLatestCardContent,
  type SecondaryLatestCardVisual,
} from "./homepage-types";
import { focusRing } from "./primitives";
import { SectionHeader } from "./section-header";

const latestCardClass = cn(
  "group relative flex min-w-0 overflow-hidden rounded-md border border-border bg-card text-card-foreground transition-colors hover:bg-background active:bg-card motion-reduce:transition-none",
  focusRing,
);

const metricCardClass =
  "min-w-0 border-border bg-card/90 p-3 sm:flex sm:h-12 sm:items-center sm:justify-between sm:rounded-md sm:border sm:px-4 sm:py-0 sm:shadow-sm";

const secondaryLatestCardClass = cn(
  latestCardClass,
  "min-h-72 flex-col p-5 sm:p-6 md:aspect-video lg:h-homepage-latest-card lg:min-h-0 lg:aspect-auto",
);

const metricRowLayoutClasses = [
  "border-r border-b sm:border",
  "border-b sm:border sm:w-56",
  "border-r sm:border sm:ml-40 sm:w-56",
  "sm:ml-auto sm:w-40",
] as const;

export function LatestSection() {
  return (
    <section
      className="relative z-10 mt-16 md:mt-24 lg:mt-36"
      aria-label="Latest Vercel updates"
    >
      <SectionHeader
        title="Latest"
        description="Recent launches, events, and updates shaping what's next on Vercel."
      />
      <div className="mt-16 grid gap-5 lg:mt-20 lg:grid-cols-2 lg:items-stretch">
        <FeaturedLatestCardLink card={featuredLatestCard} />
        <div className="lg:grid-rows-homepage-latest grid gap-5">
          {secondaryLatestCards.map((card) => (
            <SecondaryLatestCardLink key={card.id} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedLatestCardLink({ card }: { card: FeaturedLatestCardContent }) {
  return (
    <Link
      href={card.href}
      aria-label={`${card.label}: ${card.alt}`}
      className={cn(
        latestCardClass,
        "aspect-video w-full items-center justify-center lg:aspect-auto lg:h-full",
      )}
    >
      <img
        src={card.imageSrc}
        width={690}
        height={576}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-contain"
      />
    </Link>
  );
}

function SecondaryLatestCardLink({
  card,
}: {
  card: SecondaryLatestCardContent;
}) {
  return (
    <Link
      href={card.href}
      aria-label={`${card.label}: ${card.body}`}
      className={secondaryLatestCardClass}
    >
      <SecondaryLatestVisual visual={card.visual} />
      <header className="absolute bottom-5 left-5 z-10 flex w-full flex-col gap-1.5 pr-10">
        <h3 className="min-w-0 text-2xl leading-tight font-medium break-words sm:text-3xl">
          {card.label}
        </h3>
        <p className="text-muted-foreground max-w-72 font-mono text-sm leading-5 break-words">
          {card.body}
        </p>
      </header>
    </Link>
  );
}

function SecondaryLatestVisual({
  visual,
}: {
  visual: SecondaryLatestCardVisual;
}) {
  switch (visual.kind) {
    case "metrics":
      return <WorkflowMetricStrip metrics={visual.metrics} />;
    case "sandbox":
      return <SandboxGraphic />;
  }
}

function WorkflowMetricStrip({
  metrics,
}: {
  metrics: readonly LatestMetric[];
}) {
  return (
    <dl
      aria-hidden="true"
      className="border-border bg-card/90 absolute top-5 right-5 left-5 z-0 grid max-w-md grid-cols-2 overflow-hidden rounded-md border font-mono text-xs opacity-80 shadow-sm backdrop-blur transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none sm:top-10 sm:right-10 sm:left-auto sm:w-96 sm:grid-cols-1 sm:gap-4 sm:overflow-visible sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none"
    >
      {metrics.map(([label, value], index) => (
        <div
          key={label}
          className={cn(metricCardClass, metricRowLayoutClasses[index])}
        >
          <dt className="text-muted-foreground truncate">{label}</dt>
          <dd className="text-foreground mt-2 sm:mt-0">
            <MetricValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function MetricValue({ value }: { value: string }) {
  if (!value.endsWith("ms")) {
    return <span className="font-semibold">{value}</span>;
  }

  return (
    <>
      <span className="font-semibold">{value.slice(0, -2)}</span>
      <span className="text-muted-foreground">ms</span>
    </>
  );
}

function SandboxGraphic() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden opacity-70 transition-opacity duration-300 group-hover:opacity-90 group-focus-visible:opacity-90 motion-reduce:transition-none"
    >
      <div className="from-background via-muted to-background absolute inset-0 bg-gradient-to-br" />
      <div className="border-border/50 bg-card/40 absolute top-8 right-8 h-24 w-40 rounded-full border blur-sm" />
      <div className="border-border/60 bg-card/55 absolute top-14 right-20 h-20 w-20 rotate-45 border shadow-xl" />
      <div className="via-border absolute right-10 bottom-8 h-px w-56 bg-gradient-to-r from-transparent to-transparent" />
    </div>
  );
}
