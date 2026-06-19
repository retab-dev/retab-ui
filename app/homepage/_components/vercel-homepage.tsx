import { MarketingFooter } from "./footer"
import { MarketingHeader } from "./header"
import { Hero } from "./hero"
import { LatestSection } from "./latest-section"
import { ProductSections } from "./product-sections"
import { StartBuilding } from "./start-building"

export function VercelHomepage() {
  return (
    <div className="min-h-svh bg-white text-black dark:bg-white dark:text-black">
      <a
        href="#homepage-main"
        className="sr-only z-[60] rounded-md bg-black px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="homepage-main" tabIndex={-1}>
        <Hero />
        <div className="mx-auto w-[calc(100%-48px)] max-w-[1400px]">
          <ProductSections />
          <LatestSection />
          <StartBuilding />
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
