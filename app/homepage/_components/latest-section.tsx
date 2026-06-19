import Link from "next/link";

import { cn } from "@/lib/utils";

import { featuredLatestCard, secondaryLatestCards } from "./homepage-content";
import { type LatestMetric } from "./homepage-types";
import { SectionHeader } from "./section-header";

export function LatestSection() {
  return (
    <section className="-mt-14 md:mt-[76px]" aria-label="Latest Vercel updates">
      <SectionHeader
        title="Latest"
        description="Recent launches, events, and updates shaping what's next on Vercel."
      />
      <div className="mt-20 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Link
          href={featuredLatestCard.href}
          aria-label={`${featuredLatestCard.label}: ${featuredLatestCard.alt}`}
          className="group relative flex aspect-[340/191] items-center justify-center overflow-hidden rounded-[6px] border border-neutral-200 bg-[#fafafa] transition-[border-color,background-color] duration-150 ease-out hover:border-neutral-300 hover:bg-white focus-visible:border-neutral-300 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none active:bg-neutral-50 motion-reduce:transition-none lg:aspect-auto lg:min-h-[580px]"
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
              className="group relative flex aspect-[340/191] min-w-0 flex-col overflow-hidden rounded-[6px] border border-neutral-200 bg-[#fafafa] bg-[linear-gradient(#eeeeee_1px,transparent_1px),linear-gradient(90deg,#eeeeee_1px,transparent_1px)] bg-[length:76px_76px] bg-[position:top_right] p-5 text-black transition-[border-color,background-color] duration-150 ease-out hover:border-neutral-300 hover:bg-white focus-visible:border-neutral-300 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-none active:bg-neutral-50 motion-reduce:transition-none sm:p-6 lg:aspect-auto lg:h-[280px] lg:min-h-0"
            >
              {card.visual.kind === "metrics" ? (
                <WorkflowMetricStrip metrics={card.visual.metrics} />
              ) : (
                <SandboxGraphic />
              )}

              <div className="relative z-10 mt-auto max-w-[440px] pt-24 sm:pt-36 lg:pt-36">
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
    "min-[520px]:w-full",
    "min-[520px]:w-[230px]",
    "min-[520px]:ml-[154px] min-[520px]:w-[230px]",
    "min-[520px]:ml-auto min-[520px]:w-[154px]",
  ] as const;

  return (
    <dl
      aria-hidden="true"
      className="absolute top-5 right-5 left-5 z-0 grid max-w-[430px] grid-cols-2 overflow-hidden rounded-[6px] border border-neutral-200 bg-white/90 font-mono text-xs opacity-80 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none min-[520px]:top-10 min-[520px]:right-10 min-[520px]:left-auto min-[520px]:w-[420px] min-[520px]:max-w-none min-[520px]:grid-cols-1 min-[520px]:gap-4 min-[520px]:overflow-visible min-[520px]:rounded-none min-[520px]:border-0 min-[520px]:bg-transparent min-[520px]:shadow-none min-[520px]:backdrop-blur-none"
    >
      {metrics.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "min-w-0 border-neutral-200 bg-white/90 p-3 min-[520px]:flex min-[520px]:h-12 min-[520px]:items-center min-[520px]:justify-between min-[520px]:rounded-[6px] min-[520px]:border min-[520px]:px-4 min-[520px]:py-0 min-[520px]:shadow-[0_1px_0_rgba(0,0,0,0.04)]",
            index % 2 === 0 && "border-r",
            index < 2 && "border-b",
            desktopRows[index],
          )}
        >
          <dt className="truncate text-neutral-500">{label}</dt>
          <dd className="mt-2 text-black min-[520px]:mt-0">
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_22%,rgba(23,23,23,0.06),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,245,245,0.7)_52%,rgba(255,255,255,0.94))]" />
      <div className="absolute top-8 right-8 h-24 w-40 rounded-full border border-neutral-200/50 bg-white/40 blur-[1px]" />
      <div className="absolute top-14 right-20 h-20 w-20 rotate-45 border border-neutral-300/40 bg-white/55 shadow-[0_16px_48px_rgba(0,0,0,0.04)]" />
      <div className="absolute right-10 bottom-8 h-px w-56 bg-gradient-to-r from-transparent via-neutral-300/60 to-transparent" />
    </div>
  );
}
