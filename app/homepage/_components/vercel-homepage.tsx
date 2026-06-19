import Link from "next/link"
import {
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  Code2,
  Globe2,
  Menu,
  Monitor,
  Moon,
  Sun,
} from "lucide-react"

import { cn } from "@/lib/utils"

const navGroups = [
  {
    label: "Products",
    sections: [
      {
        title: "Agent Stack",
        items: ["AI SDK", "AI Gateway", "Sandbox", "Workflows", "Eve"],
      },
      {
        title: "Core Platform",
        items: [
          "Security",
          "Content Delivery",
          "Fluid Compute",
          "Observability",
          "CI/CD",
        ],
      },
      {
        title: "Tools",
        items: ["Next.js", "Vercel Agent", "Vercel Plugin", "Domains", "v0"],
      },
    ],
  },
  {
    label: "Resources",
    sections: [
      {
        title: "Learn",
        items: ["Docs", "About", "Blog", "Changelog", "Knowledge Base"],
      },
      {
        title: "Build",
        items: ["AI Apps", "Web Apps", "Marketing Sites", "Platforms"],
      },
      {
        title: "Explore",
        items: ["Customers", "Marketplace", "Partner Finder", "Community"],
      },
    ],
  },
]

const logoStrip = [
  "BLACKBOX.AI",
  "HH",
  "OpenAI",
  "DOORDASH",
  "charles SCHWAB",
  "The Weather Company",
  "BASEHUB",
]

const heroPillars = [
  "For coding agents to deploy in their native language, with Vercel's API, CLI, MCP, and Skills.",
  "To ship apps and agents in sandboxed VMs, with durable backends, powered by hundreds of models.",
  "Automated by agents who autonomously investigate errors, plan fixes, and open PRs.",
]

const productLanes = [
  {
    title: "Agents",
    description:
      "Build systems that reason, execute code in isolation, run for hours, and recover from failure.",
    proofAccent: "Notion",
    proof: "powers millions of agent conversations daily on Vercel.",
    features: [
      "Durable orchestration",
      "Sandboxed environments",
      "AI model gateway",
      "Fluid compute",
    ],
    visual: "agents",
  },
  {
    title: "Apps",
    description:
      "Ship marketing sites, SaaS backends, and storefronts on infrastructure that scales from zero to global traffic.",
    proofAccent: "Zapier",
    proof: "serves over 5 million monthly website visits on Vercel.",
    features: [
      "Global delivery",
      "Deployment environments",
      "Serverless functions",
      "Web application firewall",
    ],
    visual: "apps",
  },
  {
    title: "Platforms",
    description:
      "Host multi-tenant products that isolate every customer, provision custom domains, and serve millions of sites.",
    proofAccent: "Mintlify",
    proof: "powers documentation for 20,000+ companies on Vercel.",
    features: [
      "Tenant isolation",
      "Domain management",
      "Custom SSL certificates",
      "Preview URLs",
    ],
    visual: "platforms",
  },
] as const

const latestCards = [
  {
    label: "Ship 26",
    title: "Ship",
    badge: "26",
  },
  {
    label: "Workflows",
    title: "Pause for minutes or months, then resume from that exact point.",
  },
  {
    label: "Sandbox",
    title: "The safest way to run code you didn't write.",
  },
]

const footerColumns = [
  {
    title: "Agent Stack",
    links: [
      "AI SDK",
      "AI Gateway",
      "Sandbox",
      "Workflows",
      "Eve New",
      "Connect New",
    ],
  },
  {
    title: "Core Platform",
    links: ["CI/CD", "Content Delivery", "Fluid Compute", "Observability"],
  },
  {
    title: "Security",
    links: ["Platform Security", "WAF", "Bot Management", "Bot ID"],
  },
  {
    title: "Tools",
    links: [
      "Vercel Drop New",
      "Vercel Agent",
      "Vercel Plugin New",
      "Next.js",
      "Domains",
      "v0",
    ],
  },
  {
    title: "Frameworks",
    links: [
      "Nuxt",
      "SvelteKit",
      "Nitro",
      "Turborepo",
      "Tanstack Start",
      "FastAPI",
      "xmcp",
      "All frameworks",
    ],
  },
  {
    title: "SDKs",
    links: [
      "Vercel SDK",
      "Workflow SDK New",
      "Flags SDK",
      "Chat SDK New",
      "Queues SDK New",
      "Streamdown",
    ],
  },
  {
    title: "Build",
    links: [
      "AI Apps",
      "Web Apps",
      "Marketing Sites",
      "Platforms",
      "Commerce",
      "Platform Engineers",
      "Design Engineers",
    ],
  },
  {
    title: "Learn",
    links: [
      "Docs",
      "Blog",
      "Changelog",
      "Knowledge Base",
      "Academy",
      "Articles",
      "Community",
    ],
  },
  {
    title: "Explore",
    links: [
      "Customers",
      "Marketplace",
      "Templates",
      "Partner Finder",
      "Vercel + AWS",
    ],
  },
  {
    title: "Company",
    links: [
      "About",
      "Careers",
      "Press",
      "Events",
      "Startups",
      "Shipped on Vercel",
      "Open Source Program",
      "Enterprise",
      "Pricing",
      "Help",
    ],
  },
  {
    title: "Legal & Trust",
    links: [
      "Privacy Policy",
      "Terms of Service",
      "Cookie Policy",
      "DPA",
      "Acceptable Use Policy",
      "Legal",
      "Trust Center",
      "Status",
      "Cookie Preferences",
    ],
  },
  {
    title: "Social",
    links: ["GitHub", "X", "LinkedIn", "YouTube", "Instagram"],
  },
]

const themeOptions = ["system", "light", "dark"] as const

type ProductVisual = (typeof productLanes)[number]["visual"]

function VercelMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block size-0 border-x-[10px] border-b-[18px] border-x-transparent border-b-black",
        className
      )}
    />
  )
}

function MarketingButton({
  href,
  children,
  variant = "primary",
}: {
  href: string
  children: React.ReactNode
  variant?: "primary" | "secondary"
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors",
        variant === "primary"
          ? "border-black bg-black text-white hover:bg-neutral-800"
          : "border-neutral-200 bg-white text-black hover:border-neutral-300 hover:bg-neutral-50"
      )}
    >
      {children}
    </Link>
  )
}

function HeaderDropdown({
  label,
  sections,
}: {
  label: string
  sections: { title: string; items: string[] }[]
}) {
  return (
    <div className="group relative">
      <button className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-neutral-700 transition-colors hover:text-black">
        {label}
        <ChevronDown className="size-3" />
      </button>
      <div className="pointer-events-none absolute top-9 left-0 z-20 grid w-[620px] grid-cols-3 gap-6 rounded-md border border-neutral-200 bg-white p-5 opacity-0 shadow-xl shadow-black/5 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-3 text-xs font-medium text-neutral-500">
              {section.title}
            </h3>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item}>
                  <Link
                    href="https://vercel.com/"
                    className="text-sm text-neutral-700 transition-colors hover:text-black"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-6">
        <Link
          href="/homepage"
          className="inline-flex size-8 items-center justify-center"
          aria-label="Vercel homepage"
        >
          <VercelMark />
        </Link>

        <nav className="hidden items-center gap-2 xl:flex">
          {navGroups.map((group) => (
            <HeaderDropdown
              key={group.label}
              label={group.label}
              sections={group.sections}
            />
          ))}
          <Link
            href="https://vercel.com/enterprise"
            className="rounded-md px-2 text-sm text-neutral-700 hover:text-black"
          >
            Enterprise
          </Link>
          <Link
            href="https://vercel.com/pricing"
            className="rounded-md px-2 text-sm text-neutral-700 hover:text-black"
          >
            Pricing
          </Link>
        </nav>

        <div className="ml-auto hidden items-center gap-2 xl:flex">
          <Link
            href="https://vercel.com/chat"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-sm font-medium text-black transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <Bot className="size-4" />
            Ask AI
          </Link>
          <MarketingButton
            href="https://vercel.com/contact/sales/demo"
            variant="secondary"
          >
            Get a Demo
          </MarketingButton>
          <MarketingButton href="https://vercel.com/login" variant="secondary">
            Log In
          </MarketingButton>
          <MarketingButton href="https://vercel.com/signup">
            Sign Up
          </MarketingButton>
          <Link
            href="https://vercel.com/dashboard"
            className="rounded-md px-2 text-sm font-medium text-neutral-700 transition-colors hover:text-black"
          >
            Dashboard
          </Link>
        </div>

        <details className="group relative ml-auto xl:hidden">
          <summary className="flex size-10 list-none items-center justify-center rounded-full border border-transparent text-black marker:hidden">
            <Menu className="size-5" />
          </summary>
          <div className="absolute top-12 right-0 hidden w-[min(320px,calc(100vw-3rem))] rounded-md border border-neutral-200 bg-white px-5 py-5 shadow-xl shadow-black/5 group-open:block">
            <nav className="grid gap-4">
              {[
                "Products",
                "Resources",
                "Enterprise",
                "Pricing",
                "Ask AI",
                "Dashboard",
              ].map((item) => (
                <Link
                  key={item}
                  href="https://vercel.com/"
                  className="text-base font-medium text-neutral-900"
                >
                  {item}
                </Link>
              ))}
              <div className="flex gap-2 pt-2">
                <MarketingButton
                  href="https://vercel.com/login"
                  variant="secondary"
                >
                  Log In
                </MarketingButton>
                <MarketingButton href="https://vercel.com/signup">
                  Sign Up
                </MarketingButton>
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-64px)] flex-col overflow-hidden border-b border-neutral-100">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col items-center justify-center px-6 pt-6 pb-8 text-center">
        <div className="relative mb-14 grid size-56 place-items-center sm:size-64 md:mb-16 md:size-72">
          <div className="absolute inset-10 rounded-full bg-neutral-200/60 blur-3xl" />
          <VercelMark className="relative border-x-[94px] border-b-[164px] drop-shadow-[0_22px_24px_rgba(0,0,0,0.2)] sm:border-x-[108px] sm:border-b-[188px] md:border-x-[122px] md:border-b-[214px]" />
        </div>

        <h1 className="max-w-[620px] text-[52px] leading-[0.95] font-medium text-black sm:text-[64px] md:text-[72px]">
          Agentic Infrastructure
        </h1>
        <p className="mt-6 font-mono text-sm text-neutral-700">
          For coding agents
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <MarketingButton href="https://vercel.com/new">
            Deploy Now
          </MarketingButton>
          <MarketingButton
            href="https://vercel.com/contact/sales/demo"
            variant="secondary"
          >
            Talk to Sales
          </MarketingButton>
        </div>
      </div>
      <LogoStrip />
    </section>
  )
}

function LogoStrip() {
  return (
    <div className="w-full overflow-hidden pb-8">
      <div className="mx-auto flex w-max max-w-[1400px] min-w-full items-center gap-12 px-6 text-neutral-950 md:justify-between">
        {logoStrip.map((logo) => (
          <div
            key={logo}
            className="shrink-0 text-lg leading-none font-semibold opacity-90"
          >
            {logo}
          </div>
        ))}
      </div>
    </div>
  )
}

function HeroPillars() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-6 border-t border-neutral-100 px-6 py-8 md:grid-cols-3">
      {heroPillars.map((pillar) => (
        <p
          key={pillar}
          className="max-w-md font-mono text-sm leading-6 text-neutral-700"
        >
          {pillar}
        </p>
      ))}
    </div>
  )
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12 lg:items-baseline">
      <h2 className="text-6xl leading-none font-medium text-black md:text-7xl lg:col-span-5 lg:text-[112px]">
        {title}
      </h2>
      <p className="font-mono text-sm leading-6 text-neutral-700 lg:col-span-4 lg:col-start-8">
        {description}
      </p>
    </div>
  )
}

function MockWindow({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-neutral-200 bg-white shadow-[0_20px_80px_rgba(0,0,0,0.06)]",
        className
      )}
    >
      <div className="flex h-11 items-center gap-2 border-b border-neutral-200 px-4">
        <CircleDot className="size-3 text-neutral-400" />
        <div className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-500">
          {title}
        </div>
        <div className="size-3 rounded-sm border border-neutral-300" />
      </div>
      {children}
    </div>
  )
}

function AgentVisual() {
  return (
    <div className="relative min-h-[420px]">
      <MockWindow
        title="Strategy doc"
        className="absolute top-14 left-0 h-60 w-[58%] opacity-25"
      >
        <div className="space-y-4 p-6">
          <div className="size-14 rounded-md border border-black bg-white p-2 text-3xl font-bold">
            N
          </div>
          <div className="h-6 w-44 rounded bg-neutral-100" />
          <div className="h-3 w-64 rounded bg-neutral-100" />
          <div className="h-3 w-52 rounded bg-neutral-100" />
        </div>
      </MockWindow>
      <MockWindow
        title="New AI chat"
        className="absolute top-0 left-[24%] w-[60%]"
      >
        <div className="p-6">
          <div className="mb-5 grid size-10 place-items-center rounded-full border border-neutral-200">
            <Code2 className="size-5" />
          </div>
          <div className="text-xl font-semibold">How can I help you today?</div>
          <div className="mt-5 space-y-3 text-sm text-neutral-700">
            {[
              "Translate this page",
              "Analyze for insights",
              "Create a task tracker",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <Check className="size-4 text-neutral-400" />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-md border border-neutral-200 p-3 text-xs text-neutral-400">
            Ask, search, or make anything...
          </div>
        </div>
      </MockWindow>
    </div>
  )
}

function AppsVisual() {
  return (
    <MockWindow title="zapier.com" className="min-h-[420px]">
      <div className="grid min-h-[376px] grid-cols-[160px_1fr] bg-white">
        <div className="border-r border-neutral-200 bg-neutral-50/70 p-4">
          <div className="mb-5 h-8 rounded-md bg-black" />
          <div className="space-y-3">
            {["Home", "Assets", "Templates", "Connections", "More"].map(
              (item) => (
                <div
                  key={item}
                  className="h-7 rounded-md bg-white px-3 py-1 text-xs text-neutral-500"
                >
                  {item}
                </div>
              )
            )}
          </div>
        </div>
        <div className="p-10">
          <div className="text-center text-2xl font-semibold">
            Let&apos;s save you some time.
          </div>
          <div className="mx-auto mt-8 max-w-xl rounded-md border border-neutral-200 p-4">
            <div className="text-sm font-medium">Copilot</div>
            <div className="mt-3 h-20 rounded-md border border-neutral-100 bg-neutral-50" />
          </div>
          <div className="mt-16 grid grid-cols-4 gap-3">
            {["Zap", "Agent", "Chatbot", "Form"].map((item) => (
              <div
                key={item}
                className="rounded-md border border-neutral-200 p-3 text-xs text-neutral-500"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockWindow>
  )
}

function PlatformsVisual() {
  return (
    <div className="grid min-h-[420px] gap-4 lg:grid-cols-3">
      {["acme.design", "docs.acme.com", "shop.acme.com"].map(
        (domain, index) => (
          <div
            key={domain}
            className={cn(
              "rounded-md border border-neutral-200 bg-white p-5 shadow-[0_20px_80px_rgba(0,0,0,0.05)]",
              index === 1 && "lg:translate-y-12",
              index === 2 && "lg:translate-y-24"
            )}
          >
            <div className="mb-6 flex items-center justify-between">
              <Globe2 className="size-5 text-neutral-500" />
              <span className="rounded-full border border-neutral-200 px-2 py-1 font-mono text-[10px] text-neutral-500 uppercase">
                Live
              </span>
            </div>
            <div className="font-mono text-sm text-neutral-500">{domain}</div>
            <div className="mt-5 space-y-3">
              <div className="h-5 w-3/4 rounded bg-neutral-100" />
              <div className="h-3 w-full rounded bg-neutral-100" />
              <div className="h-3 w-2/3 rounded bg-neutral-100" />
            </div>
          </div>
        )
      )}
    </div>
  )
}

function ProductMockup({ visual }: { visual: ProductVisual }) {
  if (visual === "agents") {
    return <AgentVisual />
  }

  if (visual === "apps") {
    return <AppsVisual />
  }

  return <PlatformsVisual />
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <div>
      <div className="mb-3 font-mono text-sm text-neutral-500">Features</div>
      <ul className="space-y-3 font-mono text-sm font-semibold text-black uppercase">
        {features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </div>
  )
}

function ProductLane({
  title,
  description,
  proofAccent,
  proof,
  features,
  visual,
  flip = false,
}: {
  title: string
  description: string
  proofAccent: string
  proof: string
  features: readonly string[]
  visual: ProductVisual
  flip?: boolean
}) {
  return (
    <section className="mt-40 md:mt-52">
      <SectionHeader title={title} description={description} />
      <div className="mt-14 grid gap-10 lg:grid-cols-12 lg:items-start">
        <div className={cn("lg:col-span-8", flip && "lg:col-start-5")}>
          <ProductMockup visual={visual} />
        </div>
        <div
          className={cn(
            "space-y-8 lg:col-span-3",
            flip ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-10"
          )}
        >
          <p className="max-w-[360px] text-4xl leading-[1.12] text-black md:text-[40px]">
            <span className="text-neutral-500">{proofAccent}</span> {proof}
          </p>
          <FeatureList features={features} />
        </div>
      </div>
    </section>
  )
}

function LatestSection() {
  return (
    <section className="mt-40 md:mt-52">
      <SectionHeader
        title="Latest"
        description="Recent launches, events, and updates shaping what's next on Vercel."
      />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        <Link
          href="https://vercel.com/ship"
          className="relative grid min-h-[360px] overflow-hidden rounded-md border border-neutral-200 bg-neutral-50 transition-colors hover:bg-white lg:min-h-[520px]"
        >
          <LatestPattern />
          <div className="relative z-10 grid place-items-center">
            <h3 className="flex items-center gap-2 text-5xl leading-none font-semibold text-black md:text-6xl">
              {latestCards[0].title}
              <span className="rounded-md border-2 border-black px-1.5 py-0.5 text-3xl leading-none md:text-4xl">
                {latestCards[0].badge}
              </span>
            </h3>
          </div>
        </Link>

        <div className="grid gap-5">
          {latestCards.slice(1).map((card) => (
            <Link
              key={card.label}
              href="https://vercel.com/blog"
              className="flex min-h-[250px] items-end rounded-md border border-neutral-200 bg-white p-6 transition-colors hover:bg-neutral-50"
            >
              <div>
                <h3 className="text-3xl leading-tight font-medium text-black">
                  {card.label}
                </h3>
                {card.label === "Workflows" ? <WorkflowMetricStrip /> : null}
                <p className="mt-3 max-w-md font-mono text-sm leading-6 text-neutral-700">
                  {card.title}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function WorkflowMetricStrip() {
  const metrics = [
    ["workflow()", "420 ms"],
    ["gen()", "252 ms"],
    ["eval()", "168 ms"],
    ["pub()", "168 ms"],
  ]

  return (
    <div className="mt-6 grid max-w-md grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="rounded-md border border-neutral-200 p-3">
          <div className="text-neutral-500">{label}</div>
          <div className="mt-2 font-semibold text-black">{value}</div>
        </div>
      ))}
    </div>
  )
}

function LatestPattern() {
  const cells = Array.from({ length: 54 }, (_, index) => index)

  return (
    <div className="absolute inset-0 opacity-45">
      <div className="absolute inset-0 grid grid-cols-9 gap-3 p-6">
        {cells.map((cell) => (
          <span
            key={cell}
            className={cn(
              "size-9 border border-neutral-300",
              cell % 4 === 0 && "border-dashed",
              cell % 5 === 0 && "bg-white",
              cell % 7 === 0 && "rounded-full",
              cell % 3 !== 0 && "opacity-0"
            )}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-white/35 to-transparent" />
    </div>
  )
}

function StartBuilding() {
  return (
    <section className="mt-28 border-t border-neutral-200 pt-20 pb-20">
      <div className="grid gap-8 lg:grid-cols-12">
        <h2 className="text-5xl leading-tight font-medium lg:col-span-4">
          Start building with Vercel now
        </h2>
        <div className="grid gap-5 lg:col-span-8 lg:grid-cols-2">
          <div className="rounded-md border border-neutral-200 p-6">
            <div className="font-mono text-xs font-semibold text-neutral-500 uppercase">
              For humans
            </div>
            <p className="mt-4 text-2xl leading-tight">
              Get started with Next.js and React in seconds.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MarketingButton href="https://vercel.com/templates/next.js/nextjs-boilerplate">
                Deploy a Next.js app
              </MarketingButton>
              <MarketingButton
                href="https://vercel.com/templates"
                variant="secondary"
              >
                Templates
              </MarketingButton>
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 p-6">
            <div className="font-mono text-xs font-semibold text-neutral-500 uppercase">
              For agents
            </div>
            <p className="mt-4 text-2xl leading-tight">
              Connect coding agents to infrastructure with commands they can
              run.
            </p>
            <div className="mt-8 rounded-md bg-black p-4 font-mono text-sm text-white">
              <span className="text-neutral-500">$ </span>npx plugins add
              vercel/vercel-plugin
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: readonly string[]
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-black">{title}</h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link}>
            <Link
              href="https://vercel.com/"
              className="inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors hover:text-black"
            >
              <FooterLinkLabel link={link} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FooterLinkLabel({ link }: { link: string }) {
  const hasBadge = link.endsWith(" New")
  const label = hasBadge ? link.slice(0, -4) : link

  return (
    <>
      {label}
      {hasBadge ? (
        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
          New
        </span>
      ) : null}
    </>
  )
}

function ThemeIcon({ option }: { option: (typeof themeOptions)[number] }) {
  if (option === "light") {
    return <Sun className="size-4" />
  }

  if (option === "dark") {
    return <Moon className="size-4" />
  }

  return <Monitor className="size-4" />
}

function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-200 py-12">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {footerColumns.map((column) => (
            <FooterColumn
              key={column.title}
              title={column.title}
              links={column.links}
            />
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-neutral-200 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <VercelMark className="border-x-[8px] border-b-[14px]" />
            <span className="text-sm font-medium text-black">Vercel</span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
            <Link
              href="https://vercel-status.com/"
              className="inline-flex items-center gap-2 text-sm text-neutral-600 transition-colors hover:text-black"
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              All systems normal
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-500">
                Select a display theme:
              </span>
              <div
                aria-label="Display theme"
                className="inline-flex rounded-full border border-neutral-200 bg-white p-1"
                role="group"
              >
                {themeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === "system"}
                    className={cn(
                      "grid size-8 place-items-center rounded-full text-neutral-500 transition-colors hover:text-black",
                      option === "system" && "bg-neutral-100 text-black"
                    )}
                  >
                    <span className="sr-only">{option}</span>
                    <ThemeIcon option={option} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export function VercelHomepage() {
  return (
    <div className="min-h-svh bg-white text-black dark:bg-white dark:text-black">
      <MarketingHeader />
      <main>
        <Hero />
        <HeroPillars />
        <div className="mx-auto max-w-[1400px] px-6">
          {productLanes.map((lane, index) => (
            <ProductLane key={lane.title} {...lane} flip={index === 1} />
          ))}
          <LatestSection />
          <StartBuilding />
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
