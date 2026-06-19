import {
  type FeaturedLatestCard,
  type FooterColumnContent,
  type LinkItem,
  type LogoContent,
  type NavGroup,
  type ProductLaneContent,
  type SecondaryLatestCard,
  type ThemeOption,
} from "./homepage-types"

const vercelHref = (path: string) => `https://vercel.com${path}`

const vercelLink = (label: string, path: string, badge?: string): LinkItem => ({
  label,
  href: vercelHref(path),
  badge,
})

const externalLink = (
  label: string,
  href: string,
  badge?: string
): LinkItem => ({
  label,
  href,
  badge,
})

const enterpriseLink = vercelLink("Enterprise", "/enterprise")
const pricingLink = vercelLink("Pricing", "/pricing")

export const navGroups = [
  {
    id: "products",
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
          vercelLink("Vercel Plugin", "/plugin", "New"),
          vercelLink("Domains", "/domains"),
          externalLink("v0", "https://v0.app/"),
        ],
      },
    ],
  },
  {
    id: "resources",
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
          externalLink("Community", "https://community.vercel.com/"),
          vercelLink("AWS", "/partners/aws"),
        ],
      },
    ],
  },
] as const satisfies readonly NavGroup[]

export const utilityNavLinks = [
  enterpriseLink,
  pricingLink,
] as const satisfies readonly LinkItem[]

export const logoStrip = [
  { id: "blackbox", label: "BLACKBOX.AI" },
  { id: "hh", label: "HH" },
  { id: "openai", label: "OpenAI" },
  { id: "doordash", label: "DOORDASH" },
  { id: "schwab", label: "charles SCHWAB" },
  { id: "weather", label: "The Weather Company" },
  { id: "polymarket", label: "Polymarket" },
] as const satisfies readonly LogoContent[]

export const heroKickers = [
  "For coding agents",
  "To ship apps and agents",
  "Automated by agents",
] as const

export const productLanes = [
  {
    title: "Agents",
    layout: "default",
    spacing: "first",
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
    image: {
      desktopSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/notion-desktop-light.webp",
      desktopWidth: 2721,
      desktopHeight: 1434,
      mobileSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/notion-mobile-light.webp",
      alt: "Notion AI agent interface deployed on Vercel",
    },
  },
  {
    title: "Apps",
    layout: "reversed",
    spacing: "standard",
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
    image: {
      desktopSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/zapier-desktop-light.webp",
      desktopWidth: 2784,
      desktopHeight: 1560,
      mobileSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/zapier-mobile-light.webp",
      alt: "Zapier application interface deployed on Vercel",
    },
  },
  {
    title: "Platforms",
    layout: "default",
    spacing: "standard",
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
    image: {
      desktopSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/mintlify-desktop-light.webp",
      desktopWidth: 2784,
      desktopHeight: 1560,
      mobileSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/mintlify-mobile-light.webp",
      alt: "Mintlify documentation platform interface deployed on Vercel",
    },
  },
] as const satisfies readonly ProductLaneContent[]

export const featuredLatestCard = {
  label: "Ship 26",
  title: "Ship",
  badge: "26",
  href: vercelHref("/ship"),
  imageSrc:
    "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/ship-26-homepage.svg",
  alt: "Vercel Ship 26 conference",
} as const satisfies FeaturedLatestCard

export const secondaryLatestCards = [
  {
    label: "Workflows",
    body: "Pause for minutes or months, then resume from that exact point.",
    href: vercelHref("/workflows"),
    tone: "light",
    visual: {
      kind: "metrics",
      metrics: [
        ["workflow()", "420ms"],
        ["gen()", "252ms"],
        ["eval()", "168ms"],
        ["pub()", "168ms"],
      ],
    },
  },
  {
    label: "Sandbox",
    body: "The safest way to run code you didn't write.",
    href: vercelHref("/sandbox"),
    tone: "dark",
    visual: {
      kind: "sandbox-terminal",
    },
  },
] as const satisfies readonly SecondaryLatestCard[]

export const statusLink = externalLink("Status", "https://vercel-status.com/")

export const footerColumns = [
  {
    id: "agent-stack",
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
    id: "core-platform",
    title: "Core Platform",
    links: [
      vercelLink("CI/CD", "/features/previews"),
      vercelLink("Content Delivery", "/features/infrastructure"),
      vercelLink("Fluid Compute", "/features/fluid-compute"),
      vercelLink("Observability", "/features/observability"),
    ],
  },
  {
    id: "security",
    title: "Security",
    links: [
      vercelLink("Platform Security", "/security"),
      vercelLink("WAF", "/features/security"),
      vercelLink("Bot Management", "/features/security"),
      vercelLink("Bot ID", "/features/security"),
    ],
  },
  {
    id: "tools",
    title: "Tools",
    links: [
      vercelLink("Vercel Drop", "/drop", "New"),
      vercelLink("Vercel Agent", "/agent"),
      vercelLink("Vercel Plugin", "/plugin", "New"),
      vercelLink("Next.js", "/frameworks/nextjs"),
      vercelLink("Domains", "/domains"),
      externalLink("v0", "https://v0.app/"),
    ],
  },
  {
    id: "frameworks",
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
    id: "sdks",
    title: "SDKs",
    links: [
      vercelLink("Vercel SDK", "/docs/sdk"),
      vercelLink("Workflow SDK", "/docs/workflows", "New"),
      vercelLink("Flags SDK", "/docs/flags"),
      vercelLink("Chat SDK", "/docs/ai-sdk", "New"),
      vercelLink("Queues SDK", "/docs/queues", "New"),
      externalLink("Streamdown", "https://streamdown.ai/"),
    ],
  },
  {
    id: "build",
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
    id: "learn",
    title: "Learn",
    links: [
      vercelLink("Docs", "/docs"),
      vercelLink("Blog", "/blog"),
      vercelLink("Changelog", "/changelog"),
      vercelLink("Knowledge Base", "/guides"),
      vercelLink("Academy", "/academy"),
      vercelLink("Articles", "/resources"),
      externalLink("Community", "https://community.vercel.com/"),
    ],
  },
  {
    id: "explore",
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
    id: "company",
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
    id: "legal-trust",
    title: "Legal & Trust",
    links: [
      vercelLink("Privacy Policy", "/legal/privacy-policy"),
      vercelLink("Terms of Service", "/legal/terms"),
      vercelLink("Cookie Policy", "/legal/cookie-policy"),
      vercelLink("DPA", "/legal/dpa"),
      vercelLink("Acceptable Use Policy", "/legal/aup"),
      vercelLink("Legal (all documents)", "/legal"),
      externalLink("Trust Center", "https://security.vercel.com/"),
      vercelLink("Cookie Preferences", "/"),
    ],
  },
  {
    id: "social",
    title: "Social",
    links: [
      { label: "GitHub", href: "https://github.com/vercel" },
      { label: "X", href: "https://x.com/vercel" },
      { label: "LinkedIn", href: "https://www.linkedin.com/company/vercel" },
      { label: "YouTube", href: "https://www.youtube.com/vercel" },
      { label: "Instagram", href: "https://www.instagram.com/vercel" },
    ],
  },
] as const satisfies readonly FooterColumnContent[]

export const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly ThemeOption[]
