export type LinkItem = {
  readonly label: string
  readonly href: string
  readonly badge?: string
}

export type NavGroup = {
  readonly id: string
  readonly label: string
  readonly sections: readonly NavSection[]
}

export type NavSection = {
  readonly title: string
  readonly items: readonly LinkItem[]
}

export type LogoId =
  | "blackbox"
  | "hh"
  | "openai"
  | "doordash"
  | "schwab"
  | "weather"
  | "polymarket"

export type LogoContent = {
  readonly id: LogoId
  readonly label: string
}

export type ProductLaneLayout = "default" | "reversed"
export type ProductLaneSpacing = "first" | "standard"

export type ProductLaneContent = {
  readonly title: string
  readonly layout: ProductLaneLayout
  readonly spacing: ProductLaneSpacing
  readonly description: string
  readonly proofCustomer: string
  readonly proof: string
  readonly features: readonly string[]
  readonly image: ProductVisualImage
}

export type ProductVisualImage = {
  readonly desktopSrc: string
  readonly desktopWidth: number
  readonly desktopHeight: number
  readonly mobileSrc: string
  readonly alt: string
}

export type LatestMetric = readonly [label: string, value: string]

export type FeaturedLatestCard = {
  readonly label: string
  readonly title: string
  readonly badge: string
  readonly href: string
  readonly imageSrc: string
  readonly alt: string
}

export type SecondaryLatestCardTone = "light" | "dark"

export type SecondaryLatestCardVisual =
  | {
      readonly kind: "metrics"
      readonly metrics: readonly LatestMetric[]
    }
  | {
      readonly kind: "sandbox-terminal"
    }

export type SecondaryLatestCard = {
  readonly label: string
  readonly body: string
  readonly href: string
  readonly tone: SecondaryLatestCardTone
  readonly visual: SecondaryLatestCardVisual
}

export type FooterColumnContent = {
  readonly id: string
  readonly title: string
  readonly links: readonly LinkItem[]
}

export type ThemeValue = "system" | "light" | "dark"

export type ThemeOption = {
  readonly value: ThemeValue
  readonly label: string
}
