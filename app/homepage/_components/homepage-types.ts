export type LinkItem = {
  label: string
  href: string
  badge?: string
}

export type NavGroup = {
  label: string
  sections: readonly {
    title: string
    items: readonly LinkItem[]
  }[]
}

export type ProductVisual = "agents" | "apps" | "platforms"

export type ProductLaneContent = {
  title: string
  description: string
  proofCustomer: string
  proof: string
  features: readonly string[]
  visual: ProductVisual
}

export type ProductVisualImage = {
  desktopSrc: string
  desktopWidth: number
  desktopHeight: number
  mobileSrc: string
  mobileWidth: number
  mobileHeight: number
  alt: string
}

export type LatestMetric = readonly [label: string, value: string]

export type SecondaryLatestCard = {
  label: string
  body: string
  href: string
  metrics?: readonly LatestMetric[]
}

export type FooterColumnContent = {
  title: string
  links: readonly LinkItem[]
}

export type ThemeOption = "system" | "light" | "dark"
