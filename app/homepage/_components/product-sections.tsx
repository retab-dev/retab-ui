import { cn } from "@/lib/utils"

import { productLanes } from "./homepage-content"
import {
  type ProductLaneContent,
  type ProductVisualImage as ProductVisualImageContent,
} from "./homepage-types"
import { SectionHeader } from "./section-header"

function ProductVisualImage({ image }: { image: ProductVisualImageContent }) {
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet={image.mobileSrc} />
      <img
        src={image.desktopSrc}
        width={image.desktopWidth}
        height={image.desktopHeight}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
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

function ProductLane({ lane }: { lane: ProductLaneContent }) {
  const {
    title,
    description,
    proofCustomer,
    proof,
    features,
    image,
    layout,
    spacing,
  } = lane
  const isReversed = layout === "reversed"
  const isFirst = spacing === "first"

  return (
    <section className={cn(isFirst ? "mt-24 md:mt-[72px]" : "mt-40 md:mt-52")}>
      <SectionHeader
        title={title}
        description={description}
        titleClassName={isReversed ? "lg:col-span-4 lg:col-start-5" : undefined}
        descriptionClassName={
          isReversed ? "lg:col-span-3 lg:col-start-9" : undefined
        }
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className={cn("lg:col-span-9", isReversed && "lg:col-start-4")}>
          <ProductVisualImage image={image} />
        </div>
        <div
          className={cn(
            "space-y-8 lg:col-span-3",
            isReversed ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-10"
          )}
        >
          <p className="max-w-[360px] text-3xl leading-[1.12] text-black md:text-4xl xl:text-[40px]">
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
      {productLanes.map((lane) => (
        <ProductLane key={lane.title} lane={lane} />
      ))}
    </>
  )
}
