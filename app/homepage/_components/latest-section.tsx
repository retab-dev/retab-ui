import Link from "next/link";

import { cn } from "@/lib/utils";

import { featuredLatestCard, secondaryLatestCards } from "./homepage-content";
import { type LatestMetric } from "./homepage-types";
import { SectionHeader } from "./section-header";

export function LatestSection() {
  return (
    <section
      className="-mt-14 md:mt-56"
      aria-label="Latest Vercel updates"
    >
      <SectionHeader
        title="Latest"
        description="Recent launches, events, and updates shaping what's next on Vercel."
      />
      <div className="mt-20 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Link
          href={featuredLatestCard.href}
          aria-label={`${featuredLatestCard.label}: ${featuredLatestCard.alt}`}
          className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 transition-[border-color,background-color] duration-150 ease-out hover:border-neutral-300 hover:bg-white focus-visible:border-neutral-300 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none active:bg-neutral-50 motion-reduce:transition-none lg:min-h-96"
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
              className="group relative flex aspect-video min-w-0 flex-col overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 bg-[linear-gradient(#eeeeee_1px,transparent_1px),linear-gradient(90deg,#eeeeee_1px,transparent_1px)] bg-[size:5rem_5rem] bg-right-top p-5 text-black transition-[border-color,background-color] duration-150 ease-out hover:border-neutral-300 hover:bg-white focus-visible:border-neutral-300 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none active:bg-neutral-50 motion-reduce:transition-none sm:p-6 lg:min-h-72"
            >
              {card.visual.kind === "metrics" ? (
                <WorkflowMetricStrip metrics={card.visual.metrics} />
              ) : (
                <SandboxGraphic />
              )}

              <div className="relative z-10 mt-auto max-w-md pt-24 sm:pt-36 lg:pt-32">
                <h3 className="min-w-0 text-2xl leading-tight font-medium break-words sm:text-3xl">
                  {card.label}
                </h3>
                <p className="mt-3 max-w-md font-mono text-sm leading-6 break-words text-neutral-700">
                  {card.body}
                </p>
              </div>
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
  const desktopRows = [
    "sm:w-full",
    "sm:w-56",
    "sm:ml-40 sm:w-56",
    "sm:ml-auto sm:w-40",
  ] as const;

  return (
    <dl
      aria-hidden="true"
      className="absolute top-5 right-5 left-5 z-0 grid max-w-md grid-cols-2 overflow-hidden rounded-md border border-neutral-200 bg-white/90 font-mono text-xs opacity-80 shadow-sm backdrop-blur transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none sm:top-10 sm:right-10 sm:left-auto sm:w-96 sm:max-w-none sm:grid-cols-1 sm:gap-4 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none"
    >
      {metrics.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "min-w-0 border-neutral-200 bg-white/90 p-3 sm:flex sm:h-12 sm:items-center sm:justify-between sm:rounded-md sm:border sm:px-4 sm:py-0 sm:shadow-sm",
            index % 2 === 0 && "border-r",
            index < 2 && "border-b",
            desktopRows[index],
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
      className="absolute inset-0 z-0 overflow-hidden opacity-70 transition-opacity duration-300 ease-out group-hover:opacity-90 group-focus-visible:opacity-90 motion-reduce:transition-none"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-neutral-50 to-white" />
      <div className="absolute top-8 right-8 h-24 w-40 rounded-full border border-neutral-200/50 bg-white/40 blur-[1px]" />
      <div className="absolute top-14 right-20 h-20 w-20 rotate-45 border border-neutral-300/40 bg-white/55 shadow-xl" />
      <div className="absolute right-10 bottom-8 h-px w-56 bg-gradient-to-r from-transparent via-neutral-300/60 to-transparent" />
    </div>
  );
}
