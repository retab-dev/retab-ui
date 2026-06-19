import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";
import { Hero } from "./hero";
import {
  homepageFooter,
  homepageHeader,
  startBuildingContent,
} from "./homepage-content";
import { LatestSection } from "./latest-section";
import { ProductSections } from "./product-sections";
import { StartBuilding } from "./start-building";

export function VercelHomepage() {
  return (
    <div className="min-h-svh bg-white text-black">
      <a
        href="#homepage-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-black focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <MarketingHeader content={homepageHeader} />
      <main id="homepage-main" tabIndex={-1}>
        <Hero />
        <div className="mx-auto w-full max-w-screen-2xl px-6">
          <ProductSections />
          <LatestSection />
          <StartBuilding content={startBuildingContent} />
        </div>
      </main>
      <MarketingFooter content={homepageFooter} />
    </div>
  );
}
