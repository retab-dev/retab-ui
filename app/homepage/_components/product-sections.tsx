import { type ReactNode } from "react"
import { Check, CircleDot, Code2, Globe2 } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  productLanes,
  type ProductLaneContent,
  type ProductVisual,
} from "./data"
import { SectionHeader } from "./section-header"

function MockWindow({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
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
  lane,
  flip = false,
  isFirst = false,
}: {
  lane: ProductLaneContent
  flip?: boolean
  isFirst?: boolean
}) {
  const { title, description, proofCustomer, proof, features, visual } = lane

  return (
    <section className={cn(isFirst ? "mt-24 md:mt-[72px]" : "mt-40 md:mt-52")}>
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
            <span className="text-neutral-500">{proofCustomer}</span> {proof}
          </p>
          <FeatureList features={features} />
        </div>
      </div>
    </section>
  )
}

export function ProductSections() {
  return (
    <>
      {productLanes.map((lane, index) => (
        <ProductLane
          key={lane.title}
          lane={lane}
          flip={index === 1}
          isFirst={index === 0}
        />
      ))}
    </>
  )
}
