import { MarketingFooter } from "./footer"
import { MarketingHeader } from "./header"
import { Hero, HeroPillars } from "./hero"
import { LatestSection } from "./latest-section"
import { ProductSections } from "./product-sections"
import { StartBuilding } from "./start-building"

export function VercelHomepage() {
  return (
    <div className="min-h-svh bg-white text-black dark:bg-white dark:text-black">
      <MarketingHeader />
      <main>
        <Hero />
        <HeroPillars />
        <div className="mx-auto max-w-[1400px] px-6">
          <ProductSections />
          <LatestSection />
          <StartBuilding />
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
