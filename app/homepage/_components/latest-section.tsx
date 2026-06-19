import Link from "next/link"

import { cn } from "@/lib/utils"

import { featuredLatestCard, secondaryLatestCards } from "./data"
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
          className="relative grid min-h-[360px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 transition-colors hover:bg-white lg:min-h-[520px]"
        >
          <LatestPattern />
          <div className="relative z-10 grid place-items-center">
            <h3 className="flex items-center gap-2 text-5xl leading-none font-semibold text-black md:text-6xl">
              {featuredLatestCard.title}
              <span className="rounded-md border-2 border-black px-1.5 py-0.5 text-3xl leading-none md:text-4xl">
                {featuredLatestCard.badge}
              </span>
            </h3>
          </div>
        </Link>

        <div className="grid gap-5">
          {secondaryLatestCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="flex min-h-[250px] items-end rounded-md border border-neutral-200 bg-white p-6 transition-colors hover:bg-neutral-50"
            >
              <div>
                <h3 className="text-3xl leading-tight font-medium text-black">
                  {card.label}
                </h3>
                {card.label === "Workflows" ? <WorkflowMetricStrip /> : null}
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

function WorkflowMetricStrip() {
  const metrics = [
    ["workflow()", "420 ms"],
    ["gen()", "252 ms"],
    ["eval()", "168 ms"],
    ["pub()", "168 ms"],
  ]

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

function LatestPattern() {
  const cells = Array.from({ length: 54 }, (_, index) => index)

  return (
    <div className="absolute inset-0 opacity-45">
      <div className="absolute inset-0 grid grid-cols-9 gap-3 p-6">
        {cells.map((cell) => (
          <span
            key={cell}
            className={cn(
              "size-9 border border-neutral-300",
              cell % 4 === 0 && "border-dashed",
              cell % 5 === 0 && "bg-white",
              cell % 7 === 0 && "rounded-full",
              cell % 3 !== 0 && "opacity-0"
            )}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/35 to-transparent" />
    </div>
  )
}
