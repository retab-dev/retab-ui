import { cn } from "@/lib/utils"

import { productLanes } from "./homepage-content"
import {
  type ProductVisualImage as ProductImageContent,
  type ProductLaneContent,
} from "./homepage-types"
import { SectionHeader } from "./section-header"

function ProductVisualImage({ image }: { image: ProductImageContent }) {
  return (
    <div className="block">
      <img
        src={image.mobileSrc}
        width={image.mobileWidth}
        height={image.mobileHeight}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="pointer-events-none block h-auto w-full select-none md:hidden dark:hidden"
      />
      <img
        src={image.mobileDarkSrc}
        width={image.mobileWidth}
        height={image.mobileHeight}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="pointer-events-none hidden h-auto w-full select-none dark:block md:dark:hidden"
      />
      <img
        src={image.desktopSrc}
        width={image.desktopWidth}
        height={image.desktopHeight}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="pointer-events-none hidden h-auto w-full select-none md:block md:dark:hidden"
      />
      <img
        src={image.desktopDarkSrc}
        width={image.desktopWidth}
        height={image.desktopHeight}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="pointer-events-none hidden h-auto w-full select-none md:dark:block"
      />
    </div>
  )
}

function FeatureList({
  headingId,
  features,
}: {
  headingId: string
  features: readonly string[]
}) {
  return (
    <div>
      <h3
        id={headingId}
        className="font-mono text-sm leading-5 text-neutral-500"
      >
        Features
      </h3>
      <ul
        aria-labelledby={headingId}
        className="mt-3 space-y-3 font-mono text-sm leading-5 font-semibold break-words text-black uppercase"
      >
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  )
}

function ProductLane({
  isFirst,
  lane,
}: {
  isFirst: boolean
  lane: ProductLaneContent
}) {
  const {
    id,
    title,
    description,
    proofCustomer,
    proof,
    features,
    image,
    layout,
  } = lane
  const isReversed = layout === "reversed"
  const sectionId = `homepage-product-${id}`
  const featuresHeadingId = `${sectionId}-features`

  return (
    <section
      aria-labelledby={sectionId}
      className={cn(
        isFirst ? "mt-20 md:mt-24 lg:mt-[208px]" : "mt-32 md:mt-44 lg:mt-52"
      )}
    >
      <SectionHeader
        id={sectionId}
        title={title}
        description={description}
        placement={isReversed ? "reversed" : "default"}
      />
      <div className="mt-10 grid gap-8 lg:mt-11 lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className={cn("lg:col-span-8", isReversed && "lg:col-start-5")}>
          <ProductVisualImage image={image} />
        </div>
        <div
          className={cn(
            "hidden min-w-0 space-y-8 border-t border-neutral-200 pt-6 lg:col-span-3 lg:block lg:border-t-0 lg:pt-0",
            isReversed ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-10"
          )}
        >
          <p className="max-w-[380px] text-[28px] leading-[1.14] break-words text-black md:text-4xl xl:text-[40px]">
            <span className="text-neutral-500">{proofCustomer}</span> {proof}
          </p>
          <FeatureList headingId={featuresHeadingId} features={features} />
        </div>
      </div>
    </section>
  )
}

export function ProductSections() {
  return (
    <>
      {productLanes.map((lane, index) => (
        <ProductLane key={lane.id} lane={lane} isFirst={index === 0} />
      ))}
    </>
  )
}
