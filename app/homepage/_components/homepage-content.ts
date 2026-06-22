import {
  type FeaturedLatestCard,
  type FooterColumnContent,
  type FooterContent,
  type HeaderNavItem,
  type HeaderContent,
  type LinkItem,
  type LogoContent,
  type ProductLaneContent,
  type SecondaryLatestCard,
  type StartBuildingContent,
  type ThemeOption,
} from "./homepage-types";

const vercelHref = (path: string) => path;

const retabLink = (
  label: string,
  path: string,
  description?: string,
): LinkItem => ({
  label,
  href: path,
  description,
});

const externalLink = (
  label: string,
  href: string,
  description?: string,
): LinkItem => ({
  label,
  href,
  description,
  isExternal: true,
});

const blogLink = retabLink("Blog", "/blog");
const pricingLink = retabLink("Pricing", "/product/pricing");
const docsLink = externalLink("Docs", "https://docs.retab.com");
const loginLink = retabLink("Log in", "/dashboard/production");
const demoLink = externalLink(
  "Get a demo",
  "https://calendar.app.google/1PTAx2rZjEWiH28n6",
);

export const solutionsNavGroup = {
  id: "solutions",
  label: "Solutions",
  sections: [
    {
      title: "Industry",
      items: [
        retabLink(
          "Insurance",
          "/solutions/industries/insurance",
          "Automate claims and underwriting",
        ),
        retabLink(
          "Finance",
          "/solutions/industries/finance",
          "Power financial research",
        ),
        retabLink(
          "Oil & Gas",
          "/solutions/industries/oil-and-gas",
          "Scale field and compliance workflows",
        ),
        retabLink(
          "Manufacturing",
          "/solutions/industries/logistics",
          "Optimize system uptime",
        ),
        retabLink(
          "Healthcare & Pharma",
          "/solutions/industries/healthcare",
          "Accelerate clinical research",
        ),
      ],
    },
    {
      title: "Use Cases",
      items: [
        retabLink(
          "Financial Due Diligence",
          "/solutions/use-cases/due-diligence",
          "Speed up compliance reviews",
        ),
        retabLink(
          "Invoice Processing",
          "/solutions/use-cases/invoice-processing",
          "Automate manual review",
        ),
        retabLink(
          "Technical Document Search",
          "/solutions/use-cases/technical-document-search",
          "Find answers in complex docs",
        ),
        retabLink(
          "Customer Support",
          "/solutions/use-cases/customer-support",
          "Instant, accurate responses",
        ),
      ],
    },
  ],
} as const;

export const developersNavGroup = {
  id: "developers",
  label: "Developers",
  sections: [
    {
      title: "Developers",
      items: [
        externalLink(
          "Documentation",
          "https://docs.retab.com",
          "Documentation and guides with examples and tutorials",
        ),
        retabLink(
          "k-LLMs",
          "/k-llms",
          "Open-source consensus and alignment for structured LLM outputs",
        ),
        retabLink(
          "MCP",
          "/mcp",
          "Agent infrastructure for document automation",
        ),
        retabLink(
          "Benchmark",
          "/benchmark",
          "Retab's leaderboard for document processing",
        ),
      ],
    },
  ],
} as const;

export const linksNavGroup = {
  id: "links",
  label: "Links",
  sections: [
    {
      title: "Links",
      items: [
        externalLink("X (Twitter)", "https://x.com/retabdev"),
        externalLink("Discord", "https://discord.gg/vc5tWRPqag"),
        externalLink("GitHub", "https://github.com/retab-dev/retab"),
        externalLink(
          "YouTube",
          "https://www.youtube.com/channel/UCaquZxGEjTt3_rRZHDhlsUA",
        ),
        retabLink("Careers", "/careers"),
      ],
    },
  ],
} as const;

export const navItems = [
  {
    kind: "group",
    group: solutionsNavGroup,
  },
  {
    kind: "group",
    group: developersNavGroup,
  },
  {
    kind: "link",
    item: blogLink,
  },
  {
    kind: "link",
    item: pricingLink,
  },
  {
    kind: "group",
    group: linksNavGroup,
  },
  {
    kind: "link",
    item: docsLink,
  },
] as const satisfies readonly HeaderNavItem[];

export const homepageHeader = {
  homeHref: "/",
  navItems,
  desktopActions: [{ ...loginLink, variant: "secondary" }, demoLink],
  mobileActions: [{ ...loginLink, variant: "secondary" }, demoLink],
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
  label: "All systems operational",
  ariaLabel: "Status: All systems operational",
} as const;

export const footerSocialLinks = [
  {
    ...externalLink("X (Twitter)", "https://x.com/retabdev"),
    ariaLabel: "Retab on X",
  },
  {
    ...externalLink("Discord", "https://discord.gg/vc5tWRPqag"),
    ariaLabel: "Retab Discord",
  },
  {
    ...externalLink("GitHub", "https://github.com/retab-dev/retab"),
    ariaLabel: "Retab on GitHub",
  },
  {
    label: "Contact Us",
    href: "mailto:contact@retab.com",
    ariaLabel: "Contact Retab",
  },
] as const satisfies readonly LinkItem[];

export const footerNavigationColumns = [
  {
    id: "industry",
    title: "Industry",
    links: [
      retabLink("Insurance", "/solutions/industries/insurance"),
      retabLink("Finance", "/solutions/industries/finance"),
      retabLink("Manufacturing", "/solutions/industries/logistics"),
      retabLink("Healthcare", "/solutions/industries/healthcare"),
    ],
  },
  {
    id: "use-cases",
    title: "Use Cases",
    links: [
      retabLink("Due Diligence", "/solutions/use-cases/due-diligence"),
      retabLink(
        "Invoice Processing",
        "/solutions/use-cases/invoice-processing",
      ),
      retabLink(
        "Document Search",
        "/solutions/use-cases/technical-document-search",
      ),
      retabLink("Customer Support", "/solutions/use-cases/customer-support"),
    ],
  },
  {
    id: "developers",
    title: "Developers",
    links: [
      docsLink,
      retabLink("k-LLMs", "/k-llms"),
      retabLink("Blog", "/blog"),
      pricingLink,
    ],
  },
  {
    id: "legal",
    title: "Legal",
    links: [
      retabLink("Privacy", "/privacy"),
      retabLink("Terms", "/terms"),
      retabLink("Careers", "/careers"),
    ],
  },
  {
    id: "community",
    title: "Community",
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
