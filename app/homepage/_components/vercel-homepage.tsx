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
import styles from "./homepage.module.css";

export function VercelHomepage() {
  return (
    <div className={styles.root}>
      <a href="#homepage-main" className={styles.skipLink}>
        Skip to content
      </a>
      <MarketingHeader content={homepageHeader} />
      <main id="homepage-main" tabIndex={-1}>
        <Hero />
        <div className={styles.contentShell}>
          <ProductSections />
          <LatestSection />
          <StartBuilding content={startBuildingContent} />
        </div>
      </main>
      <MarketingFooter content={homepageFooter} />
    </div>
  );
}
