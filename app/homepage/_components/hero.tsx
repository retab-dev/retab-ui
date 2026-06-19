import { heroKickers, logoStrip } from "./homepage-content";
import styles from "./homepage.module.css";
import { LogoStrip } from "./logo-strip";
import { MarketingButton, VercelMark } from "./primitives";

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div className={styles.heroIntro}>
          <h1 className={styles.heroTitle}>Agentic Infrastructure</h1>
          <p className={styles.heroMobileKicker}>{heroKickers[0].label}</p>
          <div className={styles.heroActions}>
            <MarketingButton href="/new" className={styles.heroAction}>
              Deploy Now
            </MarketingButton>
            <MarketingButton
              href="/contact/sales/demo"
              variant="secondary"
              className={styles.heroAction}
            >
              Talk to Sales
            </MarketingButton>
          </div>
        </div>

        <div className={styles.heroMarkWrap}>
          <div className={styles.heroMarkFrame}>
            <VercelMark className={styles.heroMark} />
          </div>
        </div>

        <div className={styles.heroKickers}>
          {heroKickers.map((kicker) => (
            <p key={kicker.label} className={styles.heroKicker}>
              <span>
                <span className={styles.heroKickerLabel}>{kicker.label}</span>
                <span aria-hidden="true" className={styles.heroKickerBody}>
                  {" "}
                  {kicker.body}
                </span>
              </span>
            </p>
          ))}
        </div>
      </div>
      <LogoStrip logos={logoStrip} />
    </section>
  );
}
