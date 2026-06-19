import Link from "next/link"

import { cn } from "@/lib/utils"

import { featuredLatestCard, secondaryLatestCards } from "./homepage-content"
import { type LatestMetric } from "./homepage-types"
import { SectionHeader } from "./section-header"

export function LatestSection() {
  return (
    <section className="mt-40 md:mt-52" aria-label="Latest Vercel updates">
      <SectionHeader
        title="Latest"
        description="Recent launches, events, and updates shaping what's next on Vercel."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Link
          href={featuredLatestCard.href}
          aria-label={`${featuredLatestCard.label}: ${featuredLatestCard.alt}`}
          className="group relative flex aspect-[690/576] items-center justify-center overflow-hidden rounded-md border border-neutral-200 bg-[#fafafa] p-6 transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-1 hover:border-neutral-300 hover:shadow-[0_18px_60px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transform-none motion-reduce:transition-none sm:p-10 lg:aspect-auto lg:min-h-[580px]"
        >
          <img
            src={featuredLatestCard.imageSrc}
            width={690}
            height={576}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="block h-full w-full object-contain transition-transform duration-300 ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
          />
        </Link>

        <div className="grid gap-5 lg:grid-rows-2">
          {secondaryLatestCards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              aria-label={`${card.label}: ${card.body}`}
              className="group relative flex min-h-[240px] min-w-0 flex-col overflow-hidden rounded-md border border-neutral-200 bg-[#fafafa] p-5 text-black transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-1 hover:border-neutral-300 hover:bg-white hover:shadow-[0_18px_60px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transform-none motion-reduce:transition-none sm:p-6 lg:min-h-[280px]"
            >
              {card.visual.kind === "metrics" ? (
                <WorkflowMetricStrip metrics={card.visual.metrics} />
              ) : (
                <SandboxGraphic />
              )}

              <div className="relative z-10 mt-auto max-w-[440px] pt-28">
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
  )
}

function WorkflowMetricStrip({
  metrics,
}: {
  metrics: readonly LatestMetric[]
}) {
  return (
    <dl
      aria-hidden="true"
      className="absolute top-5 right-5 left-5 z-0 grid max-w-[430px] grid-cols-2 overflow-hidden rounded-md border border-neutral-200 bg-white/90 font-mono text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur transition-transform duration-300 ease-out group-hover:-translate-y-1 motion-reduce:transition-none min-[520px]:left-auto min-[520px]:w-[420px] min-[520px]:grid-cols-4"
    >
      {metrics.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "min-w-0 border-neutral-200 p-3 min-[520px]:border-r min-[520px]:border-b-0 min-[520px]:last:border-r-0",
            index % 2 === 0 && "border-r",
            index < 2 && "border-b"
          )}
        >
          <dt className="truncate text-neutral-500">{label}</dt>
          <dd className="mt-2 text-black">
            <MetricValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MetricValue({ value }: { value: string }) {
  if (!value.endsWith("ms")) {
    return <span className="font-semibold">{value}</span>
  }

  return (
    <>
      <span className="font-semibold">{value.slice(0, -2)}</span>{" "}
      <span className="text-neutral-500">ms</span>
    </>
  )
}

function SandboxGraphic() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-5 right-5 left-5 z-0 h-32 overflow-hidden rounded-md border border-neutral-200 bg-white/80 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-transform duration-300 ease-out group-hover:-translate-y-1 motion-reduce:transition-none"
    >
      <div className="flex h-8 items-center justify-between border-b border-neutral-200 px-3 font-mono text-[11px] text-neutral-500">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-neutral-300" />
          <span className="size-2 rounded-full bg-neutral-200" />
          <span className="size-2 rounded-full bg-neutral-100" />
        </div>
        isolated-vm
      </div>
      <div className="grid gap-3 p-4 font-mono text-xs">
        <div className="h-2 w-3/4 rounded-full bg-neutral-200" />
        <div className="h-2 w-1/2 rounded-full bg-neutral-100" />
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <span className="h-2 rounded-full bg-neutral-200" />
          <span className="h-2 rounded-full bg-neutral-100" />
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <span className="h-2 rounded-full bg-neutral-200" />
          <span className="h-2 rounded-full bg-neutral-100" />
        </div>
      </div>
    </div>
  )
}
