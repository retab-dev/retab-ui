import Link from "next/link";

import { cn } from "@/lib/utils";

import { featuredLatestCard, secondaryLatestCards } from "./homepage-content";
import { type LatestMetric } from "./homepage-types";
import { focusRing } from "./primitives";
import { SectionHeader } from "./section-header";

const latestCardClass = cn(
  "group relative flex min-w-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 text-black transition-colors hover:border-neutral-300 hover:bg-white active:bg-neutral-50 motion-reduce:transition-none",
  focusRing,
);

const metricCardClass =
  "min-w-0 border-neutral-200 bg-white/90 p-3 sm:flex sm:h-12 sm:items-center sm:justify-between sm:rounded-md sm:border sm:px-4 sm:py-0 sm:shadow-sm";

export function LatestSection() {
  return (
    <section
      className="mt-16 md:mt-24 lg:mt-48"
      aria-label="Latest Vercel updates"
    >
      <SectionHeader
        title="Latest"
        description="Recent launches, events, and updates shaping what's next on Vercel."
      />
      <div className="mt-16 grid gap-5 lg:mt-20 lg:grid-cols-2 lg:items-stretch">
        <Link
          href={featuredLatestCard.href}
          aria-label={`${featuredLatestCard.label}: ${featuredLatestCard.alt}`}
          className={cn(
            latestCardClass,
            "aspect-video w-full items-center justify-center lg:aspect-auto lg:h-full",
          )}
        >
          <img
            src={featuredLatestCard.imageSrc}
            width={690}
            height={576}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-contain"
          />
        </Link>

        <div className="grid gap-5 lg:grid-rows-2">
          {secondaryLatestCards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              aria-label={`${card.label}: ${card.body}`}
              className={cn(
                latestCardClass,
                "min-h-72 flex-col p-5 sm:p-6 md:aspect-video lg:aspect-auto lg:min-h-72",
              )}
            >
              {card.visual.kind === "metrics" ? (
                <WorkflowMetricStrip metrics={card.visual.metrics} />
              ) : (
                <SandboxGraphic />
              )}

              <header className="absolute bottom-5 left-5 z-10 flex w-full flex-col gap-1.5 pr-10">
                <h3 className="min-w-0 text-2xl leading-tight font-medium break-words sm:text-3xl">
                  {card.label}
                </h3>
                <p className="max-w-72 font-mono text-sm leading-5 break-words text-neutral-700">
                  {card.body}
                </p>
              </header>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowMetricStrip({
  metrics,
}: {
  metrics: readonly LatestMetric[];
}) {
  return (
    <dl
      aria-hidden="true"
      className="absolute top-5 right-5 left-5 z-0 grid max-w-md grid-cols-2 overflow-hidden rounded-md border border-neutral-200 bg-white/90 font-mono text-xs opacity-80 shadow-sm backdrop-blur transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none sm:top-10 sm:right-10 sm:left-auto sm:w-96 sm:grid-cols-1 sm:gap-4 sm:overflow-visible sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none"
    >
      {metrics.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            metricCardClass,
            index % 2 === 0 && "border-r sm:border",
            index < 2 && "border-b sm:border",
          )}
        >
          <dt className="truncate text-neutral-500">{label}</dt>
          <dd className="mt-2 text-black sm:mt-0">
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
      <span className="text-neutral-500">ms</span>
    </>
  );
}

function SandboxGraphic() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden opacity-70 transition-opacity duration-300 group-hover:opacity-90 group-focus-visible:opacity-90 motion-reduce:transition-none"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-100 to-white" />
      <div className="absolute top-8 right-8 h-24 w-40 rounded-full border border-neutral-200/50 bg-white/40 blur-sm" />
      <div className="absolute top-14 right-20 h-20 w-20 rotate-45 border border-neutral-300/40 bg-white/55 shadow-xl" />
      <div className="absolute right-10 bottom-8 h-px w-56 bg-gradient-to-r from-transparent via-neutral-300/60 to-transparent" />
    </div>
  );
}
