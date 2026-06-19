import Link from "next/link"

import { featuredLatestCard, secondaryLatestCards } from "./homepage-content"
import { type LatestMetric } from "./homepage-types"
import { SectionHeader } from "./section-header"

export function LatestSection() {
  return (
    <section className="mt-40 md:mt-52">
      <SectionHeader
        title="Latest"
        description="Recent launches, events, and updates shaping what's next on Vercel."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Link
          href={featuredLatestCard.href}
          aria-label={featuredLatestCard.label}
          className="relative block min-h-[360px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none lg:min-h-[520px]"
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
        </Link>

        <div className="grid gap-5">
          {secondaryLatestCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="flex min-h-[250px] items-end rounded-md border border-neutral-200 bg-white p-6 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
            >
              <div>
                <h3 className="text-3xl leading-tight font-medium text-black">
                  {card.label}
                </h3>
                {card.metrics ? (
                  <WorkflowMetricStrip metrics={card.metrics} />
                ) : null}
                <p className="mt-3 max-w-md font-mono text-sm leading-6 text-neutral-700">
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
    <div className="mt-6 grid max-w-md grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-md border border-neutral-200 p-3">
          <div className="text-neutral-500">{label}</div>
          <div className="mt-2 font-semibold text-black">{value}</div>
        </div>
      ))}
    </div>
  )
}
