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
const retabCliInstallCommand = "curl -fsSL https://retab.com/install.sh | sh";
const codexMcpInstallCommand = `codex mcp add retab --url https://mcp.retab.com/mcp && ${retabCliInstallCommand}`;
const claudeCodeMcpInstallCommand = `claude mcp add --transport http retab https://mcp.retab.com/mcp && ${retabCliInstallCommand}`;
const agentSkillsInstallCommand = `npx skills add https://github.com/retab-dev/retab --skill retab && ${retabCliInstallCommand}`;

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
    title: "Features",
    layout: "reversed",
    description:
      "Turn PDFs, scans, spreadsheets, and emails into typed data with APIs that understand layout, tables, sources, and schemas.",
    proofCustomer: "Developers",
    proof:
      "unlock mission-critical data from documents that were previously too complex to automate.",
    features: ["Extract", "Split", "Edit", "Parse", "Classify"],
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
    features: ["Confidence Scoring", "Source Grounding", "Evals", "Reviews"],
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
      "can create workflows, inspect source files, create runs, and diagnose failures autonomously.",
    features: [
      {
        label: "MCP",
        command: codexMcpInstallCommand,
      },
      {
        label: "CLI",
        command: retabCliInstallCommand,
      },
      {
        label: "SDKs",
        command: "npm install @retab/node",
      },
      {
        label: "Agent Skills",
        command: agentSkillsInstallCommand,
      },
    ],
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
      "scale sensitive document workflows with fine-grained access controls, SOC2 compliance, and private deployment.",
    features: ["SOC2", "HIPAA", "GDPR", "Audit Logs", "Self-hosting"],
    visual: { kind: "enterprise" },
  },
] as const satisfies readonly ProductLaneContent[];

export const featuredLatestCard = {
  id: "blog",
  label: "Blog",
  title: "Blog",
  badge: "",
  href: vercelHref("/blog"),
  imageSrc:
    "https://lishhsx6kmthaacj.public.blob.vercel-storage.com/ship-26-homepage.svg",
  alt: "Retab's engineering blog",
} as const satisfies FeaturedLatestCard;

export const secondaryLatestCards = [
  {
    id: "retab-ui",
    label: "@retab/ui",
    body: "Open-source UI components for your document workflows",
    href: vercelHref("/docs/components"),
    tone: "light",
    visual: {
      kind: "retab-ui",
    },
  },
  {
    id: "enterprise-features",
    label: "Enterprise features",
    body: "Security, privacy, and deployment controls for production document workflows.",
    href: vercelHref("/product/pricing"),
    tone: "light",
    visual: {
      kind: "enterprise-dots",
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
  message:
    "Retab helps leading AI teams transform unstructured documents into structured, reliable data that can power production pipelines with industry-leading accuracy.",
  status: footerStatus,
  columns: footerNavigationColumns,
  themeOptions,
} as const satisfies FooterContent;

export const startBuildingContent = {
  title: "Start building with Retab now",
  panels: [
    {
      id: "humans",
      kind: "template",
      audience: "For teams.",
      body: "Launch document workflows with parsing, extraction, validation, review, and audit trails in one place.",
      actions: [
        {
          label: "Get a demo",
          href: demoLink.href,
          ariaLabel: "Get a Retab demo",
          isExternal: true,
        },
        {
          label: "Read the docs",
          href: docsLink.href,
          ariaLabel: "Read the Retab docs",
          isExternal: true,
          variant: "secondary",
        },
      ],
    },
    {
      id: "developers",
      kind: "commands",
      audience: "For developers.",
      body: "Install a Retab SDK or connect Retab MCP to your agent runtime.",
      commandGroups: [
        {
          id: "sdk",
          label: "SDK language",
          copyLabel: "SDK install command",
          kind: "select",
          options: [
            {
              id: "python",
              label: "Python",
              command: "pip install retab",
              icon: {
                src: "/logos/python_logo_2.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "typescript",
              label: "TypeScript",
              command: "npm install @retab/node",
              icon: {
                src: "/logos/typescript_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "go",
              label: "Go",
              command: "go get github.com/retab-dev/retab/clients/go",
              icon: {
                src: "/logos/go_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "php",
              label: "PHP",
              command: "composer require retab/retab",
              icon: {
                src: "/logos/php_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "dotnet",
              label: ".NET",
              command: "dotnet add package Retab",
              icon: {
                src: "/logos/dotnet_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "ruby",
              label: "Ruby",
              command: "gem install retab",
              icon: {
                src: "/logos/ruby_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "rust",
              label: "Rust",
              command: "cargo add retab",
              icon: {
                src: "/logos/rust_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "java",
              label: "Java",
              command: "mvn dependency:get -Dartifact=com.retab:retab:0.0.11",
              icon: {
                src: "/logos/java_logo.svg",
                width: 32,
                height: 32,
              },
            },
          ],
        },
        {
          id: "mcp",
          label: "MCP client",
          copyLabel: "MCP setup value",
          kind: "select",
          options: [
            {
              id: "codex",
              label: "Codex",
              command: codexMcpInstallCommand,
              icon: {
                src: "/logos/codex-color.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "claude-code",
              label: "Claude Code",
              command: claudeCodeMcpInstallCommand,
              icon: {
                src: "/logos/claude_code_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "claude",
              label: "Claude",
              command: "https://mcp.retab.com/mcp",
              prompt: "url",
              icon: {
                src: "/logos/claude_logo.svg",
                width: 32,
                height: 32,
              },
            },
            {
              id: "grok",
              label: "Grok",
              command: "https://mcp.retab.com/mcp",
              prompt: "url",
              icon: {
                src: "/logos/grok_logo.svg",
                width: 32,
                height: 32,
                className: "dark:invert",
              },
            },
          ],
        },
        {
          id: "cli",
          label: "CLI",
          copyLabel: "install command",
          kind: "fixed",
          option: {
            id: "cli",
            label: "CLI",
            command: retabCliInstallCommand,
            icon: {
              kind: "square-terminal",
            },
          },
        },
        {
          id: "agent-skills",
          label: "Agent Skills",
          copyLabel: "install command",
          kind: "fixed",
          option: {
            id: "agent-skills",
            label: "Agent Skills",
            command: agentSkillsInstallCommand,
            icon: {
              kind: "skills",
            },
          },
        },
      ],
    },
  ],
} as const satisfies StartBuildingContent;
