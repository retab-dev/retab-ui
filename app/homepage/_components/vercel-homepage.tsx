import Link from "next/link"
import {
  Activity,
  Boxes,
  Check,
  ChevronDown,
  CircleDot,
  Code2,
  Cpu,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Terminal,
  Workflow,
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
  "OpenAI",
  "DoorDash",
  "Rippling",
  "Charles Schwab",
  "The Weather Company",
  "Polymarket",
]

const productLanes = [
  {
    title: "Agents",
    description:
      "Build systems that reason, execute code in isolation, run for hours, and recover from failure.",
    proof:
      "Workspace agents complete long-running work with protected execution and resumable state.",
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
    proof:
      "High-traffic product teams serve launches, dashboards, and storefronts from the same edge.",
    features: [
      "Global delivery",
      "Preview environments",
      "Serverless functions",
      "Web application firewall",
    ],
    visual: "apps",
  },
  {
    title: "Platforms",
    description:
      "Host multi-tenant products that isolate every customer, provision domains, and serve millions of sites.",
    proof:
      "Platform teams manage tenant routing, certificates, preview URLs, and releases in one place.",
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
    title: "A new foundation for agent-driven delivery.",
    description:
      "A focused launch stream for agents, apps, workflow primitives, and platform infrastructure.",
  },
  {
    label: "workflow()",
    title: "Pause work for minutes or months, then resume.",
    description:
      "Durable steps keep state, retries, and progress available across long-running executions.",
  },
  {
    label: "Sandbox",
    title: "Run code safely in clean, isolated environments.",
    description:
      "Spin up execution contexts for generated code, tests, previews, and agent tasks.",
  },
]

const footerColumns = [
  {
    title: "Agent Stack",
    links: ["AI SDK", "AI Gateway", "Sandbox", "Workflows", "Eve", "Connect"],
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
    links: ["Vercel Drop", "Vercel Agent", "Vercel Plugin", "Next.js"],
  },
  {
    title: "Frameworks",
    links: ["Nuxt", "SvelteKit", "Nitro", "Turborepo", "FastAPI"],
  },
  {
    title: "SDKs",
    links: ["Vercel SDK", "Workflow SDK", "Flags SDK", "Chat SDK"],
  },
  {
    title: "Build",
    links: ["AI Apps", "Web Apps", "Marketing Sites", "Platforms", "Commerce"],
  },
  {
    title: "Learn",
    links: ["Docs", "Blog", "Changelog", "Knowledge Base", "Academy"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Press", "Events", "Enterprise", "Pricing"],
  },
  {
    title: "Legal & Trust",
    links: ["Privacy Policy", "Terms of Service", "DPA", "Trust Center"],
  },
  {
    title: "Social",
    links: ["GitHub", "X", "LinkedIn", "YouTube", "Instagram"],
  },
]

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

        <nav className="hidden items-center gap-2 md:flex">
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

        <div className="ml-auto hidden items-center gap-2 md:flex">
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
        </div>

        <details className="group ml-auto md:hidden">
          <summary className="flex size-10 list-none items-center justify-center rounded-full border border-transparent text-black marker:hidden">
            <Menu className="size-5" />
          </summary>
          <div className="absolute inset-x-0 top-16 border-b border-neutral-200 bg-white px-6 py-5 shadow-xl shadow-black/5">
            <nav className="grid gap-4">
              {["Products", "Resources", "Enterprise", "Pricing"].map(
                (item) => (
                  <Link
                    key={item}
                    href="https://vercel.com/"
                    className="text-base font-medium text-neutral-900"
                  >
                    {item}
                  </Link>
                )
              )}
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
      <div className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-[1fr_0.8fr_1fr] md:py-24">
        <div>
          <h1 className="max-w-[520px] text-6xl leading-none font-medium text-black md:text-7xl lg:text-[86px]">
            Agentic Infrastructure
          </h1>
          <div className="mt-8 flex flex-wrap gap-3">
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

        <div className="flex justify-center">
          <div className="relative grid size-64 place-items-center md:size-72">
            <div className="absolute inset-10 rounded-full bg-neutral-200/60 blur-3xl" />
            <VercelMark className="relative border-x-[96px] border-b-[168px] drop-shadow-[0_22px_24px_rgba(0,0,0,0.22)] md:border-x-[112px] md:border-b-[196px]" />
          </div>
        </div>

        <div className="justify-self-start md:justify-self-center">
          <div className="space-y-4 font-mono text-sm font-semibold text-black uppercase">
            <p>For coding agents</p>
            <p>To ship apps and agents</p>
            <p>Automated by agents</p>
          </div>
        </div>
      </div>
      <LogoStrip />
    </section>
  )
}

function LogoStrip() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-x-10 gap-y-5 px-6 pb-8 text-neutral-950">
      {logoStrip.map((logo) => (
        <div
          key={logo}
          className="text-lg leading-none font-semibold opacity-90"
        >
          {logo}
        </div>
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
    <div className="grid gap-4 md:grid-cols-12 md:items-baseline">
      <h2 className="text-6xl leading-none font-medium text-black md:col-span-5 md:text-7xl lg:text-[112px]">
        {title}
      </h2>
      <p className="font-mono text-sm leading-6 text-neutral-700 md:col-span-4 md:col-start-8">
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
    <div className="grid min-h-[420px] gap-4 md:grid-cols-3">
      {["acme.design", "docs.acme.com", "shop.acme.com"].map(
        (domain, index) => (
          <div
            key={domain}
            className={cn(
              "rounded-md border border-neutral-200 bg-white p-5 shadow-[0_20px_80px_rgba(0,0,0,0.05)]",
              index === 1 && "md:translate-y-12",
              index === 2 && "md:translate-y-24"
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
  proof,
  features,
  visual,
  flip = false,
}: {
  title: string
  description: string
  proof: string
  features: readonly string[]
  visual: ProductVisual
  flip?: boolean
}) {
  return (
    <section className="mt-40 md:mt-52">
      <SectionHeader title={title} description={description} />
      <div className="mt-14 grid gap-10 md:grid-cols-12 md:items-start">
        <div className={cn("md:col-span-8", flip && "md:col-start-5")}>
          <ProductMockup visual={visual} />
        </div>
        <div
          className={cn(
            "space-y-8 md:col-span-3",
            flip ? "md:col-start-1 md:row-start-1" : "md:col-start-10"
          )}
        >
          <p className="text-4xl leading-tight text-black md:text-5xl">
            {proof}
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
        description="Recent launches, events, and updates shaping what comes next."
      />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {latestCards.map((card, index) => (
          <Link
            key={card.label}
            href="https://vercel.com/blog"
            className={cn(
              "group flex min-h-80 flex-col justify-between rounded-md border border-neutral-200 bg-white p-6 transition-colors hover:bg-neutral-50",
              index === 1 && "bg-black text-white hover:bg-neutral-900"
            )}
          >
            <div>
              <div
                className={cn(
                  "font-mono text-xs font-semibold text-neutral-500 uppercase",
                  index === 1 && "text-neutral-400"
                )}
              >
                {card.label}
              </div>
              <h3 className="mt-8 text-3xl leading-tight font-medium">
                {card.title}
              </h3>
            </div>
            <p
              className={cn(
                "mt-10 text-sm leading-6 text-neutral-600",
                index === 1 && "text-neutral-300"
              )}
            >
              {card.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function StartBuilding() {
  return (
    <section className="mt-28 border-t border-neutral-200 pt-20 pb-20">
      <div className="grid gap-8 md:grid-cols-12">
        <h2 className="text-5xl leading-tight font-medium md:col-span-4">
          Start building with Vercel now
        </h2>
        <div className="grid gap-5 md:col-span-8 md:grid-cols-2">
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
              className="text-sm text-neutral-600 transition-colors hover:text-black"
            >
              {link}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MarketingFooter() {
  return (
    <footer className="border-t border-neutral-200 py-12">
      <div className="mx-auto grid max-w-[1400px] gap-x-8 gap-y-10 px-6 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {footerColumns.map((column) => (
          <FooterColumn
            key={column.title}
            title={column.title}
            links={column.links}
          />
        ))}
        <div className="flex items-start gap-3 lg:col-span-6">
          <VercelMark className="mt-1 border-x-[8px] border-b-[14px]" />
          <div>
            <div className="text-sm font-medium text-black">Vercel</div>
            <div className="text-sm text-neutral-500">Status: Operational</div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function CapabilityRail() {
  const items = [
    { icon: Workflow, label: "Workflows" },
    { icon: Boxes, label: "Sandboxes" },
    { icon: Cpu, label: "Model Gateway" },
    { icon: ShieldCheck, label: "Security" },
    { icon: Activity, label: "Observability" },
    { icon: LockKeyhole, label: "Trust" },
    { icon: Terminal, label: "CLI" },
    { icon: ExternalLink, label: "Previews" },
  ]

  return (
    <section className="mt-20 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 md:grid-cols-4">
      {items.map(({ icon: Icon, label }) => (
        <Link
          key={label}
          href="https://vercel.com/"
          className="flex items-center gap-3 bg-white p-5 text-sm font-medium transition-colors hover:bg-neutral-50"
        >
          <Icon className="size-4 text-neutral-500" />
          {label}
        </Link>
      ))}
    </section>
  )
}

export function VercelHomepage() {
  return (
    <div className="min-h-svh bg-white text-black dark:bg-white dark:text-black">
      <MarketingHeader />
      <main>
        <Hero />
        <div className="mx-auto max-w-[1400px] px-6">
          {productLanes.map((lane, index) => (
            <ProductLane key={lane.title} {...lane} flip={index === 1} />
          ))}
          <LatestSection />
          <CapabilityRail />
          <StartBuilding />
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
