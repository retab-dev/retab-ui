import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

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
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Link
          href={featuredLatestCard.href}
          aria-label={`${featuredLatestCard.label}: ${featuredLatestCard.alt}`}
          className="group relative block min-h-[191px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 transition-[border-color,box-shadow] hover:border-neutral-300 hover:shadow-[0_18px_60px_rgba(0,0,0,0.08)] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none sm:min-h-[360px] lg:min-h-[580px]"
        >
          <img
            src={featuredLatestCard.imageSrc}
            width={690}
            height={576}
            alt={featuredLatestCard.alt}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 opacity-80 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
            aria-hidden="true"
          />
          <div className="absolute top-5 left-5 inline-flex items-center overflow-hidden rounded-full border border-white/30 bg-black font-mono text-xs text-white shadow-lg shadow-black/20">
            <span className="border-r border-white/20 px-3 py-1.5">
              {featuredLatestCard.title}
            </span>
            <span className="px-3 py-1.5">{featuredLatestCard.badge}</span>
          </div>
          <div className="absolute right-5 bottom-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white px-3 py-1.5 text-sm font-medium text-black shadow-lg shadow-black/15">
            View release
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </div>
        </Link>

        <div className="grid gap-5 lg:grid-rows-2">
          {secondaryLatestCards.map((card) => {
            const isDark = card.tone === "dark"

            return (
              <Link
                key={card.label}
                href={card.href}
                aria-label={`${card.label}: ${card.body}`}
                className={cn(
                  "group relative flex min-h-[191px] flex-col justify-between overflow-hidden rounded-md border p-6 transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none lg:min-h-[280px]",
                  isDark
                    ? "border-black bg-black text-white hover:bg-neutral-950 hover:shadow-[0_18px_60px_rgba(0,0,0,0.16)]"
                    : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-[0_18px_60px_rgba(0,0,0,0.08)]"
                )}
              >
                <div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs",
                      isDark
                        ? "border-white/15 bg-white/10 text-white"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isDark ? "bg-white" : "bg-black"
                      )}
                      aria-hidden="true"
                    />
                    {card.label}
                  </div>
                  {card.visual.kind === "metrics" ? (
                    <WorkflowMetricStrip metrics={card.visual.metrics} />
                  ) : (
                    <SandboxTerminal />
                  )}
                </div>

                <div className="mt-8">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-3xl leading-tight font-medium">
                      {card.label}
                    </h3>
                    <ArrowUpRight
                      aria-hidden="true"
                      className={cn(
                        "size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0",
                        isDark ? "text-white" : "text-black"
                      )}
                    />
                  </div>
                  <p
                    className={cn(
                      "mt-3 max-w-md font-mono text-sm leading-6",
                      isDark ? "text-white/70" : "text-neutral-700"
                    )}
                  >
                    {card.body}
                  </p>
                </div>
              </Link>
            )
          })}
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
    <div className="mt-7 grid overflow-hidden rounded-md border border-neutral-200 bg-white font-mono text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div
          key={label}
          className="border-b border-neutral-200 p-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
        >
          <div className="text-neutral-500">{label}</div>
          <div className="mt-2 text-black">
            <MetricValue value={value} />
          </div>
        </div>
      ))}
    </div>
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

function SandboxTerminal() {
  return (
    <div className="mt-7 overflow-hidden rounded-md border border-white/15 bg-neutral-950 font-mono text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-white/55">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-white/30" />
          <span className="size-2 rounded-full bg-white/20" />
          <span className="size-2 rounded-full bg-white/10" />
        </div>
        <span>isolated-vm</span>
      </div>
      <div className="space-y-3 p-4">
        <div className="text-white">
          <span className="text-white/40">$</span> vercel sandbox run agent.ts
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-3 text-white/60">
          <span>mount</span>
          <span className="text-white">/workspace</span>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-3 text-white/60">
          <span>network</span>
          <span className="text-white">locked</span>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-3 text-white/60">
          <span>stdout</span>
          <span className="text-white">streaming</span>
        </div>
      </div>
    </div>
  )
}
