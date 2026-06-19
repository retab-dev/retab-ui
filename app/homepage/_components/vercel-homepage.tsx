import { MarketingFooter } from "./footer";
import { MarketingHeader } from "./header";
import { Hero } from "./hero";
import {
  homepageFooter,
  homepageHeader,
  startBuildingContent,
} from "./homepage-content";
import { LatestSection } from "./latest-section";
import { MarketingContainer } from "./primitives";
import { ProductSections } from "./product-sections";
import { StartBuilding } from "./start-building";

export function VercelHomepage() {
  return (
    <div className="bg-background/50 min-h-svh text-black">
      <a
        href="#homepage-main"
        className="fixed top-3 left-3 z-50 -translate-y-24 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black focus:outline-none motion-reduce:transition-none"
      >
        Skip to content
      </a>
      <MarketingHeader content={homepageHeader} />
      <main id="homepage-main" tabIndex={-1}>
        <Hero />
        <MarketingContainer>
          <ProductSections />
          <LatestSection />
          <StartBuilding content={startBuildingContent} />
        </MarketingContainer>
      </main>
      <MarketingFooter content={homepageFooter} />
    </div>
  );
}
