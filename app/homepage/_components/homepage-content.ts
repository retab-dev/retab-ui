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
  {
    id: "harvard",
    label: "Harvard University",
    image: {
      src: "/clients/harvard-logo.svg",
      width: 600,
      height: 165,
      className: "h-8 md:h-9",
    },
  },
  {
    id: "sinari",
    label: "Sinari",
    image: {
      src: "/clients/logo-sinari.svg",
      width: 118,
      height: 32,
      className: "h-7 md:h-8",
    },
  },
  {
    id: "carmoola",
    label: "Carmoola",
    image: {
      src: "/clients/carmoola-logo.svg",
      width: 182,
      height: 32,
      className: "h-7 md:h-8",
    },
  },
  {
    id: "maersk",
    label: "Maersk",
    image: {
      src: "/clients/maersk-logo.svg",
      width: 135,
      height: 31,
      className: "h-7 md:h-8",
    },
  },
] as const satisfies readonly LogoContent[];

export const heroKickers = [
  {
    label: "For document workflows",
    body: "that parse, split, classify, extract, validate, and route every file through one reliable pipeline.",
  },
  {
    label: "To turn files into data",
    body: "with schemas, citations, confidence scores, and review queues built for production.",
  },
  {
    label: "Automated by agents",
    body: "with MCP context for run inspection, failure tracing, and workflow debugging.",
  },
] as const;

export const productLanes = [
  {
    id: "workflows",
    title: "Workflows",
    layout: "default",
    description:
      "Build durable document pipelines that keep every parse, split, extraction, validation, and review step in one place.",
    proofCustomer: "Retab",
    proof:
      "orchestrates the full document lifecycle without stitching brittle tools together.",
    features: [
      "Workflow Builder",
      "Human Review",
      "Schema Versioning",
      "Run Inspection",
    ],
    visual: { kind: "workflow" },
  },
  {
    id: "document-apis",
    title: "Document APIs",
    layout: "reversed",
    description:
      "Turn PDFs, scans, spreadsheets, and emails into typed data with APIs that understand layout, tables, sources, and schemas.",
    proofCustomer: "Developers",
    proof:
      "ship structured extraction with citations instead of maintaining OCR and prompt glue.",
    features: ["Parse", "Split", "Classify", "Extract", "Edit"],
    visual: { kind: "extraction" },
  },
  {
    id: "reliability",
    title: "Reliability",
    layout: "default",
    description:
      "Know when automation can run straight through, when it needs review, and exactly where every answer came from.",
    proofCustomer: "Operations teams",
    proof:
      "approve exceptions with confidence scores, source grounding, evals, and audit-ready traces.",
    features: ["Confidence Scoring", "Source Grounding", "Evals", "Audit Logs"],
    visual: { kind: "reliability" },
  },
  {
    id: "agents",
    title: "Agents",
    layout: "reversed",
    description:
      "Retab exposes the full document workflow context, letting agents inspect runs, trace failures, and fix automations without leaving their loop.",
    proofCustomer: "Agents",
    proof:
      "can create workflows, inspect source files, wire blocks, run drafts, and diagnose failures autonomously.",
    features: ["MCP", "CLI", "SDKs", "Agent Skills"],
    visual: { kind: "agents" },
  },
  {
    id: "enterprise",
    title: "Enterprise",
    layout: "default",
    description:
      "Run document automation with the security, privacy, and deployment controls enterprise teams need before production.",
    proofCustomer: "Enterprise teams",
    proof:
      "can scale sensitive document workflows with compliance controls, audit trails, uptime commitments, and private deployment options.",
    features: ["SOC2", "HIPAA", "GDPR", "Audit Logs", "Self-hosting"],
    visual: { kind: "enterprise" },
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
    ...externalLink(
      "YouTube",
      "https://www.youtube.com/channel/UCaquZxGEjTt3_rRZHDhlsUA",
    ),
    ariaLabel: "Retab on YouTube",
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
