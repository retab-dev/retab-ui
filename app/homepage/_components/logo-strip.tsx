import { cn } from "@/lib/utils";
import Image from "next/image";

import { type LogoContent } from "./homepage-types";

export function LogoStrip({ logos }: { logos: readonly LogoContent[] }) {
  const repeatedLogos = [...logos, ...logos];

  return (
    <div className="relative z-10 w-full overflow-hidden pb-12 max-md:-mx-6 max-md:w-[calc(100%+3rem)] md:pt-6 md:pb-10">
      <ul className="sr-only">
        {logos.map((logo) => (
          <li key={logo.id}>{logo.label}</li>
        ))}
      </ul>
      <div
        aria-hidden="true"
        className="animate-homepage-logo-marquee text-foreground flex h-11 w-max min-w-0 items-center gap-12 px-6 motion-reduce:hidden xl:hidden"
      >
        {repeatedLogos.map((logo, index) => (
          <BrandLogo key={`${logo.id}-${index}`} logo={logo} />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="text-foreground hidden min-h-11 flex-wrap items-center justify-center gap-x-10 gap-y-6 px-6 motion-reduce:flex xl:hidden"
      >
        {logos.map((logo) => (
          <BrandLogo key={logo.id} logo={logo} />
        ))}
      </div>
      <div className="text-foreground hidden h-11 w-full min-w-0 items-center justify-between gap-8 xl:flex">
        {logos.map((logo) => (
          <BrandLogo key={logo.id} logo={logo} />
        ))}
      </div>
    </div>
  );
}

function BrandLogo({ logo }: { logo: LogoContent }) {
  return (
    <Image
      alt={logo.label}
      className={cn(
        "block w-auto shrink-0 object-contain opacity-85 contrast-125 grayscale saturate-0 dark:invert",
        logo.image.className,
      )}
      height={logo.image.height}
      src={logo.image.src}
      width={logo.image.width}
    />
  );
}
