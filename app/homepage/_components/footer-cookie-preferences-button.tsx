"use client";

import { type LinkItem } from "./homepage-types";
import { MarketingLinkLabel } from "./primitives";

type CookiePreferenceWindow = Window & {
  CookieConsent?: { renew?: () => void };
  OneTrust?: { ToggleInfoDisplay?: () => void };
};

function openCookiePreferences() {
  const cookieWindow = window as CookiePreferenceWindow;

  cookieWindow.OneTrust?.ToggleInfoDisplay?.();
  cookieWindow.CookieConsent?.renew?.();
}

export function FooterCookiePreferencesButton({
  ariaLabel,
  className,
  item,
}: {
  ariaLabel: string;
  className: string;
  item: LinkItem;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={openCookiePreferences}
      className={className}
    >
      <MarketingLinkLabel item={item} />
    </button>
  );
}
