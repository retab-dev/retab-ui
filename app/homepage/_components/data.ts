export type LinkItem = {
  label: string
  href: string
  badge?: string
}

export type NavGroup = {
  label: string
  sections: {
    title: string
    items: LinkItem[]
  }[]
}

export type ProductVisual = "agents" | "apps" | "platforms"

export type ProductLaneContent = {
  title: string
  description: string
  proofCustomer: string
  proof: string
  features: string[]
  visual: ProductVisual
}

export type ProductVisualImage = {
  desktopSrc: string
  mobileSrc: string
  alt: string
}

const vercelHref = (path: string) => `https://vercel.com${path}`

const vercelLink = (label: string, path: string, badge?: string): LinkItem => ({
  label,
  href: vercelHref(path),
  badge,
})

export const navGroups: NavGroup[] = [
  {
    label: "Products",
    sections: [
      {
        title: "Agent Stack",
        items: [
          vercelLink("AI SDK", "/ai-sdk"),
          vercelLink("AI Gateway", "/ai-gateway"),
          vercelLink("Sandbox", "/sandbox"),
          vercelLink("Workflows", "/workflows"),
          vercelLink("Eve", "/eve", "New"),
        ],
      },
      {
        title: "Core Platform",
        items: [
          vercelLink("Security", "/security"),
          vercelLink("Content Delivery", "/features/infrastructure"),
          vercelLink("Fluid Compute", "/features/fluid-compute"),
          vercelLink("Observability", "/features/observability"),
          vercelLink("CI/CD", "/features/previews"),
        ],
      },
      {
        title: "Tools",
        items: [
          vercelLink("Next.js", "/frameworks/nextjs"),
          vercelLink("Vercel Agent", "/agent"),
          vercelLink("Vercel Plugin", "/plugins", "New"),
          vercelLink("Domains", "/domains"),
          { label: "v0", href: "https://v0.dev" },
        ],
      },
    ],
  },
  {
    label: "Resources",
    sections: [
      {
        title: "Learn",
        items: [
          vercelLink("Docs", "/docs"),
          vercelLink("About", "/about"),
          vercelLink("Blog", "/blog"),
          vercelLink("Changelog", "/changelog"),
          vercelLink("Knowledge Base", "/guides"),
        ],
      },
      {
        title: "Build",
        items: [
          vercelLink("AI Apps", "/solutions/ai"),
          vercelLink("Web Apps", "/solutions/web-apps"),
          vercelLink("Marketing Sites", "/solutions/marketing"),
          vercelLink("Platforms", "/solutions/platforms"),
          vercelLink("Commerce", "/solutions/composable-commerce"),
        ],
      },
      {
        title: "Explore",
        items: [
          vercelLink("Customers", "/customers"),
          vercelLink("Marketplace", "/marketplace"),
          vercelLink("Partner Finder", "/partners"),
          vercelLink("Community", "/community"),
          vercelLink("AWS", "/partners/aws"),
        ],
      },
    ],
  },
]

export const mobileNavLinks = [
  vercelLink("Products", "/features"),
  vercelLink("Resources", "/resources"),
  vercelLink("Enterprise", "/enterprise"),
  vercelLink("Pricing", "/pricing"),
]

export const logoStrip = [
  "BLACKBOX.AI",
  "HH",
  "OpenAI",
  "DOORDASH",
  "charles SCHWAB",
  "The Weather Company",
  "Polymarket",
]

export const heroKickers = [
  "For coding agents",
  "To ship apps and agents",
  "Automated by agents",
]

export const heroPillars = [
  "For coding agents to deploy in their native language, with Vercel's API, CLI, MCP, and Skills.",
  "To ship apps and agents in Sandboxed VMs, with durable backends, powered by hundreds of models.",
  "Automated by agents who autonomously investigate errors, plan fixes, and open PRs.",
]

export const productLanes: ProductLaneContent[] = [
  {
    title: "Agents",
    description:
      "Build systems that reason, execute code in isolation, run for hours, and recover from failure.",
    proofCustomer: "Notion",
    proof: "powers millions of agent conversations daily on Vercel.",
    features: [
      "Durable Orchestration",
      "Sandboxed Environments",
      "AI Model Gateway",
      "Fluid Compute",
    ],
    visual: "agents",
  },
  {
    title: "Apps",
    description:
      "Ship marketing sites, SaaS backends, and storefronts on infrastructure that scales from zero to global traffic.",
    proofCustomer: "Zapier",
    proof: "serves over 5 million monthly website visits on Vercel.",
    features: [
      "Global Delivery",
      "Deployment Environments",
      "Serverless Functions",
      "Web Application Firewall",
    ],
    visual: "apps",
  },
  {
    title: "Platforms",
    description:
      "Host multi-tenant products that isolate every customer, provision custom domains, and serve millions of sites.",
    proofCustomer: "Mintlify",
    proof: "powers documentation for 20,000+ companies on Vercel",
    features: [
      "Tenant Isolation",
      "Domain Management",
      "Custom SSL Certificates",
      "Preview URLs",
    ],
    visual: "platforms",
  },
]

export const productVisualImages = {
  agents: {
    desktopSrc:
      "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/notion-desktop-light.webp",
    mobileSrc:
      "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/notion-mobile-light.webp",
    alt: "Agents",
  },
  apps: {
    desktopSrc:
      "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/zapier-desktop-light.webp",
    mobileSrc:
      "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/zapier-mobile-light.webp",
    alt: "Apps",
  },
  platforms: {
    desktopSrc:
      "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/mintlify-desktop-light.webp",
    mobileSrc:
      "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/mintlify-mobile-light.webp",
    alt: "Platforms",
  },
} satisfies Record<ProductVisual, ProductVisualImage>

export const featuredLatestCard = {
  label: "Ship 26",
  title: "Ship",
  badge: "26",
  href: vercelHref("/ship"),
  imageSrc:
    "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/ship-26-homepage.svg",
  alt: "Vercel Ship 26 conference",
}

export const secondaryLatestCards = [
  {
    label: "Workflows",
    body: "Pause for minutes or months, then resume from that exact point.",
    href: vercelHref("/workflows"),
  },
  {
    label: "Sandbox",
    body: "The safest way to run code you didn't write.",
    href: vercelHref("/sandbox"),
  },
] as const

export const footerColumns = [
  {
    title: "Agent Stack",
    links: [
      vercelLink("AI SDK", "/ai-sdk"),
      vercelLink("AI Gateway", "/ai-gateway"),
      vercelLink("Sandbox", "/sandbox"),
      vercelLink("Workflows", "/workflows"),
      vercelLink("Eve", "/eve", "New"),
      vercelLink("Connect", "/connect", "New"),
    ],
  },
  {
    title: "Core Platform",
    links: [
      vercelLink("CI/CD", "/features/previews"),
      vercelLink("Content Delivery", "/features/infrastructure"),
      vercelLink("Fluid Compute", "/features/fluid-compute"),
      vercelLink("Observability", "/features/observability"),
    ],
  },
  {
    title: "Security",
    links: [
      vercelLink("Platform Security", "/security"),
      vercelLink("WAF", "/features/security"),
      vercelLink("Bot Management", "/features/security"),
      vercelLink("Bot ID", "/features/security"),
    ],
  },
  {
    title: "Tools",
    links: [
      vercelLink("Vercel Drop", "/drop", "New"),
      vercelLink("Vercel Agent", "/agent"),
      vercelLink("Vercel Plugin", "/plugins", "New"),
      vercelLink("Next.js", "/frameworks/nextjs"),
      vercelLink("Domains", "/domains"),
      { label: "v0", href: "https://v0.dev" },
    ],
  },
  {
    title: "Frameworks",
    links: [
      vercelLink("Nuxt", "/frameworks/nuxt"),
      vercelLink("SvelteKit", "/frameworks/sveltekit"),
      vercelLink("Nitro", "/frameworks/nitro"),
      vercelLink("Turborepo", "/docs/monorepos/turborepo"),
      vercelLink("Tanstack Start", "/frameworks/tanstack-start"),
      vercelLink("FastAPI", "/frameworks/fastapi"),
      vercelLink("xmcp", "/frameworks/xmcp"),
      vercelLink("All frameworks", "/frameworks"),
    ],
  },
  {
    title: "SDKs",
    links: [
      vercelLink("Vercel SDK", "/docs/sdk"),
      vercelLink("Workflow SDK", "/docs/workflows", "New"),
      vercelLink("Flags SDK", "/docs/flags"),
      vercelLink("Chat SDK", "/docs/ai-sdk", "New"),
      vercelLink("Queues SDK", "/docs/queues", "New"),
      vercelLink("Streamdown", "/docs/ai-sdk"),
    ],
  },
  {
    title: "Build",
    links: [
      vercelLink("AI Apps", "/solutions/ai"),
      vercelLink("Web Apps", "/solutions/web-apps"),
      vercelLink("Marketing Sites", "/solutions/marketing"),
      vercelLink("Platforms", "/solutions/platforms"),
      vercelLink("Commerce", "/solutions/composable-commerce"),
      vercelLink("Platform Engineers", "/solutions/platform-engineers"),
      vercelLink("Design Engineers", "/solutions/design-engineers"),
    ],
  },
  {
    title: "Learn",
    links: [
      vercelLink("Docs", "/docs"),
      vercelLink("Blog", "/blog"),
      vercelLink("Changelog", "/changelog"),
      vercelLink("Knowledge Base", "/guides"),
      vercelLink("Academy", "/academy"),
      vercelLink("Articles", "/resources"),
      vercelLink("Community", "/community"),
    ],
  },
  {
    title: "Explore",
    links: [
      vercelLink("Customers", "/customers"),
      vercelLink("Marketplace", "/marketplace"),
      vercelLink("Templates", "/templates"),
      vercelLink("Partner Finder", "/partners"),
      vercelLink("Vercel + AWS", "/partners/aws"),
    ],
  },
  {
    title: "Company",
    links: [
      vercelLink("About", "/about"),
      vercelLink("Careers", "/careers"),
      vercelLink("Press", "/press"),
      vercelLink("Events", "/events"),
      vercelLink("Startups", "/startups"),
      vercelLink("Shipped on Vercel", "/customers"),
      vercelLink("Open Source Program", "/oss"),
      vercelLink("Enterprise", "/enterprise"),
      vercelLink("Pricing", "/pricing"),
      vercelLink("Help", "/help"),
    ],
  },
  {
    title: "Legal & Trust",
    links: [
      vercelLink("Privacy Policy", "/legal/privacy-policy"),
      vercelLink("Terms of Service", "/legal/terms"),
      vercelLink("Cookie Policy", "/legal/cookie-policy"),
      vercelLink("DPA", "/legal/dpa"),
      vercelLink("Acceptable Use Policy", "/legal/aup"),
      vercelLink("Legal (all documents)", "/legal"),
      vercelLink("Trust Center", "/security"),
      { label: "Status", href: "https://vercel-status.com/" },
      vercelLink("Cookie Preferences", "/"),
    ],
  },
  {
    title: "Social",
    links: [
      { label: "GitHub", href: "https://github.com/vercel" },
      { label: "X", href: "https://x.com/vercel" },
      { label: "LinkedIn", href: "https://www.linkedin.com/company/vercel" },
      { label: "YouTube", href: "https://www.youtube.com/vercel" },
      { label: "Instagram", href: "https://www.instagram.com/vercel" },
    ],
  },
] as const

export const themeOptions = ["system", "light", "dark"] as const
export type ThemeOption = (typeof themeOptions)[number]
