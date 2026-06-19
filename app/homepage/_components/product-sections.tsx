import { cn } from "@/lib/utils";

import { productLanes } from "./homepage-content";
import {
  type ProductVisualImage as ProductImageContent,
  type ProductLaneContent,
} from "./homepage-types";
import { SectionHeader } from "./section-header";

const productLaneSpacingClasses = [
  "mt-40 md:mt-24 lg:mt-52",
  "mt-16 md:mt-44 lg:mt-56",
  "mt-16 md:mt-44 lg:mt-52",
] as const;

function ProductVisualImage({ image }: { image: ProductImageContent }) {
  return (
    <>
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
    </>
  );
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul className="text-foreground m-0 flex list-none flex-col gap-1.5 p-0 font-mono text-sm leading-5 font-semibold break-words uppercase">
      <li className="text-muted-foreground font-normal normal-case">
        Features
      </li>
      {features.map((feature) => (
        <li key={feature}>{feature}</li>
      ))}
    </ul>
  );
}

function ProductLane({
  lane,
  spacingClass,
}: {
  lane: ProductLaneContent;
  spacingClass: string;
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
  } = lane;
  const isReversed = layout === "reversed";
  const sectionId = `homepage-product-${id}`;

  return (
    <section aria-labelledby={sectionId} className={spacingClass}>
      <SectionHeader
        id={sectionId}
        title={title}
        description={description}
        placement={isReversed ? "reversed" : "default"}
      />
      <div className="mt-10 grid gap-8 lg:mt-11 lg:grid-cols-12 lg:items-start lg:gap-5">
        <div
          className={cn(
            "min-w-0 lg:col-span-8",
            isReversed && "lg:col-start-5",
          )}
        >
          <ProductVisualImage image={image} />
        </div>
        <div
          className={cn(
            "mt-8 min-w-0 space-y-8 lg:col-span-3 lg:mt-0 lg:pt-8",
            isReversed ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-10",
          )}
        >
          <p className="text-foreground max-w-sm text-3xl leading-tight text-balance md:text-4xl">
            <span className="text-muted-foreground">{proofCustomer}</span>{" "}
            {proof}
          </p>
          <FeatureList features={features} />
        </div>
      </div>
    </section>
  );
}

export function ProductSections() {
  return (
    <>
      {productLanes.map((lane, index) => (
        <ProductLane
          key={lane.id}
          lane={lane}
          spacingClass={
            productLaneSpacingClasses[index] ?? productLaneSpacingClasses[1]
          }
        />
      ))}
    </>
  );
}
