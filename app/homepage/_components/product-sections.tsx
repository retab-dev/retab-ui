import { cn } from "@/lib/utils"

import {
  productLanes,
  productVisualImages,
  type ProductLaneContent,
  type ProductVisual,
} from "./data"
import { SectionHeader } from "./section-header"

function ProductVisualImage({ visual }: { visual: ProductVisual }) {
  const image = productVisualImages[visual]

  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={image.mobileSrc} />
      <img
        src={image.desktopSrc}
        alt={image.alt}
        className="block min-h-[360px] w-full rounded-md border border-neutral-200 object-cover shadow-[0_20px_80px_rgba(0,0,0,0.06)] md:min-h-[420px]"
      />
    </picture>
  )
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <div>
      <div className="mb-3 font-mono text-sm text-neutral-500">Features</div>
      <ul className="space-y-3 font-mono text-sm font-semibold text-black uppercase">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  )
}

function ProductLane({
  lane,
  flip = false,
  isFirst = false,
}: {
  lane: ProductLaneContent
  flip?: boolean
  isFirst?: boolean
}) {
  const { title, description, proofCustomer, proof, features, visual } = lane

  return (
    <section className={cn(isFirst ? "mt-24 md:mt-[72px]" : "mt-40 md:mt-52")}>
      <SectionHeader title={title} description={description} />
      <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:items-start">
        <div className={cn("lg:col-span-8", flip && "lg:col-start-5")}>
          <ProductVisualImage visual={visual} />
        </div>
        <div
          className={cn(
            "space-y-8 lg:col-span-3",
            flip ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-10"
          )}
        >
          <p className="max-w-[360px] text-4xl leading-[1.12] text-black md:text-[40px]">
            <span className="text-neutral-500">{proofCustomer}</span> {proof}
          </p>
          <FeatureList features={features} />
        </div>
      </div>
    </section>
  )
}

export function ProductSections() {
  return (
    <>
      {productLanes.map((lane, index) => (
        <ProductLane
          key={lane.title}
          lane={lane}
          flip={index === 1}
          isFirst={index === 0}
        />
      ))}
    </>
  )
}
