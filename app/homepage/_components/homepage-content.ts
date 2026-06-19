import {
  type FeaturedLatestCard,
  type FooterColumnContent,
  type FooterContent,
  type HeaderContent,
  type LinkItem,
  type LogoContent,
  type NavGroup,
  type ProductLaneContent,
  type SecondaryLatestCard,
  type StartBuildingContent,
  type ThemeOption,
} from "./homepage-types";

const vercelHref = (path: string) => path;

const vercelLink = (label: string, path: string, badge?: string): LinkItem => ({
  label,
  href: vercelHref(path),
  badge,
});

const externalLink = (
  label: string,
  href: string,
  badge?: string,
): LinkItem => ({
  label,
  href,
  badge,
  isExternal: true,
});

const cookiePreferencesButton = (): LinkItem => ({
  label: "Cookie Preferences",
  href: "#cookie-preferences",
  ariaLabel: "Open cookie preferences",
  action: "cookie-preferences",
});

const enterpriseLink = vercelLink("Enterprise", "/enterprise");
const pricingLink = vercelLink("Pricing", "/pricing");
const demoLink = vercelLink("Get a Demo", "/contact/sales/demo");
const loginLink = vercelLink("Log In", "/login");
const signupLink = vercelLink("Sign Up", "/signup");

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
          vercelLink("Eve", "/eve"),
        ],
      },
      {
        title: "Core Platform",
        items: [
          vercelLink("Security", "/security"),
          vercelLink("Content Delivery", "/cdn"),
          vercelLink("Fluid Compute", "/fluid"),
          vercelLink("Observability", "/products/observability"),
          vercelLink("CI/CD", "/products/previews"),
        ],
      },
      {
        title: "Tools",
        items: [
          vercelLink("Next.js", "/frameworks/nextjs"),
          vercelLink("Vercel Agent", "/agent"),
          vercelLink("Vercel Plugin", "/plugin"),
          externalLink("Domains", "https://vercel.com/domains"),
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
          vercelLink("Knowledge Base", "/kb"),
        ],
      },
      {
        title: "Build",
        items: [
          vercelLink("AI Apps", "/ai"),
          vercelLink("Web Apps", "/solutions/web-apps"),
          vercelLink("Marketing Sites", "/solutions/marketing-sites"),
          vercelLink("Platforms", "/solutions/multi-tenant-saas"),
          vercelLink("Commerce", "/solutions/composable-commerce"),
        ],
      },
      {
        title: "Explore",
        items: [
          vercelLink("Customers", "/customers"),
          vercelLink("Marketplace", "/marketplace"),
          vercelLink("Partner Finder", "/partners/solution-partners"),
          vercelLink("AWS", "/partners/aws"),
          externalLink("Community", "https://community.vercel.com/"),
        ],
      },
    ],
  },
] as const satisfies readonly NavGroup[];

export const utilityNavLinks = [
  enterpriseLink,
  pricingLink,
] as const satisfies readonly LinkItem[];

export const homepageHeader = {
  homeHref: "/home",
  navGroups,
  utilityLinks: utilityNavLinks,
  desktopActions: [
    { ...demoLink, variant: "secondary" },
    { ...loginLink, variant: "secondary" },
    signupLink,
  ],
  mobileActions: [
    { ...demoLink, variant: "secondary" },
    { ...loginLink, variant: "secondary" },
    signupLink,
  ],
} as const satisfies HeaderContent;

export const logoStrip = [
  { id: "blackbox", label: "BLACKBOX.AI", variant: "diamond-wordmark" },
  { id: "hh", label: "HH", variant: "monogram" },
  { id: "openai", label: "OpenAI", variant: "text" },
  { id: "doordash", label: "DOORDASH", variant: "pill-wordmark" },
  {
    id: "schwab",
    label: "charles SCHWAB",
    variant: "stacked-serif",
    lines: ["charles", "SCHWAB"],
  },
  {
    id: "weather",
    label: "The Weather Company",
    variant: "stacked-bold",
    lines: ["The", "Weather", "Company"],
  },
  {
    id: "polymarket",
    label: "Polymarket",
    variant: "large-diamond-wordmark",
  },
] as const satisfies readonly LogoContent[];

export const heroKickers = [
  {
    label: "For coding agents",
    body: "to deploy in their native language, with Vercel's API, CLI, MCP, and Skills.",
  },
  {
    label: "To ship apps and agents",
    body: "in Sandboxed VMs, with durable backends, powered by hundreds of models.",
  },
  {
    label: "Automated by agents",
    body: "who autonomously investigate errors, plan fixes, and open PRs.",
  },
] as const;

export const productLanes = [
  {
    id: "agents",
    title: "Agents",
    layout: "default",
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
      desktopDarkSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/notion-desktop-dark.webp",
      desktopWidth: 2721,
      desktopHeight: 1434,
      mobileSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/notion-mobile-light.webp",
      mobileDarkSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/notion-mobile-dark.webp",
      mobileWidth: 1284,
      mobileHeight: 1026,
      alt: "Agents",
    },
  },
  {
    id: "apps",
    title: "Apps",
    layout: "reversed",
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
      desktopDarkSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/zapier-desktop-dark.webp",
      desktopWidth: 2784,
      desktopHeight: 1560,
      mobileSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/zapier-mobile-light.webp",
      mobileDarkSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/zapier-mobile-dark.webp",
      mobileWidth: 1284,
      mobileHeight: 1026,
      alt: "Apps",
    },
  },
  {
    id: "platforms",
    title: "Platforms",
    layout: "default",
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
      desktopDarkSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/mintlify-desktop-dark.webp",
      desktopWidth: 2784,
      desktopHeight: 1560,
      mobileSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/mintlify-mobile-light.webp",
      mobileDarkSrc:
        "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/mintlify-mobile-dark.webp",
      mobileWidth: 1284,
      mobileHeight: 1026,
      alt: "Platforms",
    },
  },
] as const satisfies readonly ProductLaneContent[];

export const featuredLatestCard = {
  id: "ship-26",
  label: "Ship 26",
  title: "Ship",
  badge: "26",
  href: vercelHref("/ship"),
  imageSrc:
    "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/ship-26-homepage.svg",
  alt: "Vercel Ship 26 conference",
} as const satisfies FeaturedLatestCard;

export const secondaryLatestCards = [
  {
    id: "workflows",
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
    id: "sandbox",
    label: "Sandbox",
    body: "The safest way to run code you didn't write.",
    href: vercelHref("/sandbox"),
    tone: "light",
    visual: {
      kind: "sandbox",
    },
  },
] as const satisfies readonly SecondaryLatestCard[];

const footerStatus = {
  label: "Loading status…",
  href: "https://vercel-status.com/",
  ariaLabel: "Vercel status: Loading status",
  isExternal: true,
} as const;

export const footerSocialLinks = [
  {
    ...externalLink("GitHub", "https://github.com/vercel"),
    ariaLabel: "Vercel on GitHub",
  },
  {
    ...externalLink("X", "https://x.com/vercel"),
    ariaLabel: "Vercel on X",
  },
  {
    ...externalLink("LinkedIn", "https://www.linkedin.com/company/vercel"),
    ariaLabel: "Vercel on LinkedIn",
  },
  {
    ...externalLink("YouTube", "https://www.youtube.com/vercel"),
    ariaLabel: "Vercel on YouTube",
  },
  {
    ...externalLink("Instagram", "https://www.instagram.com/vercel"),
    ariaLabel: "Vercel on Instagram",
  },
] as const satisfies readonly LinkItem[];

export const footerNavigationColumns = [
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
      vercelLink("CI/CD", "/products/previews"),
      vercelLink("Content Delivery", "/cdn"),
      vercelLink("Fluid Compute", "/fluid"),
      vercelLink("Observability", "/products/observability"),
    ],
  },
  {
    id: "security",
    title: "Security",
    links: [
      vercelLink("Platform Security", "/security"),
      vercelLink("WAF", "/security/web-application-firewall"),
      vercelLink("Bot Management", "/security/bot-management"),
      vercelLink("Bot ID", "/botid"),
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
      externalLink("Domains", "https://vercel.com/domains"),
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
      vercelLink("AI Apps", "/solutions/ai-apps"),
      vercelLink("Web Apps", "/solutions/web-apps"),
      vercelLink("Marketing Sites", "/solutions/marketing-sites"),
      vercelLink("Platforms", "/solutions/multi-tenant-saas"),
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
      vercelLink("Knowledge Base", "/kb"),
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
      vercelLink("Partner Finder", "/partners/solution-partners"),
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
      vercelLink("Acceptable Use Policy", "/legal/acceptable-use-policy"),
      vercelLink("Legal (all documents)", "/legal"),
      externalLink("Trust Center", "https://security.vercel.com/"),
      externalLink("Status", "https://vercel-status.com/"),
      cookiePreferencesButton(),
    ],
  },
  {
    id: "social",
    title: "Social",
    links: footerSocialLinks,
  },
] as const satisfies readonly FooterColumnContent[];

export const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const satisfies readonly ThemeOption[];

export const homepageFooter = {
  status: footerStatus,
  columns: footerNavigationColumns,
  themeOptions,
} as const satisfies FooterContent;

export const startBuildingContent = {
  title: "Start building with Vercel now",
  panels: [
    {
      id: "humans",
      kind: "template",
      audience: "For humans.",
      body: "Get started with Next.js and React in seconds.",
      actions: [
        {
          label: "Deploy a Next.js app",
          href: vercelHref("/templates/next.js/nextjs-boilerplate"),
          ariaLabel: "Deploy a Next.js app template on Vercel",
        },
        {
          label: "View more templates",
          href: vercelHref("/templates"),
          ariaLabel: "View more Vercel templates",
          variant: "secondary",
        },
      ],
    },
    {
      id: "agents",
      kind: "plugin",
      audience: "For agents.",
      body: "Tools to connect your agents to Vercel infrastructure.",
      plugin: {
        options: [
          {
            label: "Plugin",
            command: "npx plugins add vercel/vercel-plugin",
          },
          {
            label: "MCP",
            command: "npx add-mcp https://mcp.vercel.com",
          },
          {
            label: "Skill",
            command: "npx skills add vercel-labs/agent-skills",
          },
        ],
      },
    },
  ],
} as const satisfies StartBuildingContent;
