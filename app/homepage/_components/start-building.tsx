import { ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  type StartBuildingAction,
  type StartBuildingContent,
  type StartBuildingPanel as StartBuildingPanelContent,
  type StartBuildingPlugin,
} from "./homepage-types"
import { getLinkAriaLabel, getLinkProps, MarketingButton } from "./primitives"
import { StartBuildingPluginCommand } from "./start-building-plugin-command"

function ActionList({ actions }: { actions: readonly StartBuildingAction[] }) {
  return (
    <div className="mt-8 flex w-full flex-col gap-3 min-[480px]:w-auto min-[480px]:flex-row min-[480px]:flex-wrap">
      {actions.map((action) => (
        <MarketingButton
          key={action.label}
          href={action.href}
          aria-label={getLinkAriaLabel(action)}
          {...getLinkProps(action)}
          variant={action.variant}
          className="w-full gap-2 min-[480px]:w-auto"
        >
          {action.label}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </MarketingButton>
      ))}
    </div>
  )
}

function PluginCommand({ plugin }: { plugin: StartBuildingPlugin }) {
  return (
    <StartBuildingPluginCommand command={plugin.command} label={plugin.label} />
  )
}

function StartBuildingPanel({
  isFirst,
  panel,
}: {
  isFirst: boolean
  panel: StartBuildingPanelContent
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        isFirst ? "md:border-r md:border-neutral-200 md:pr-10" : "md:pl-10"
      )}
    >
      <p className="max-w-md text-base leading-7 text-neutral-600">
        <span className="text-black">{panel.audience}</span> {panel.body}
      </p>
      {panel.actions ? <ActionList actions={panel.actions} /> : null}
      {panel.plugin ? <PluginCommand plugin={panel.plugin} /> : null}
    </div>
  )
}

export function StartBuilding({ content }: { content: StartBuildingContent }) {
  return (
    <section
      className="pt-32 pb-20 md:pt-40"
      aria-labelledby="start-building-heading"
    >
      <div className="mx-auto max-w-[920px] text-left">
        <h2
          id="start-building-heading"
          className="max-w-[760px] text-[40px] leading-tight font-normal text-black"
        >
          {content.title}
        </h2>

        <div className="mt-12 grid min-w-0 gap-10 text-left md:grid-cols-2 md:gap-5">
          {content.panels.map((panel, index) => (
            <StartBuildingPanel
              key={panel.id}
              panel={panel}
              isFirst={index === 0}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
