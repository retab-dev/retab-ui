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
          className="w-full min-[480px]:w-auto"
        >
          {action.label}
        </MarketingButton>
      ))}
    </div>
  )
}

function PluginCommand({ plugin }: { plugin: StartBuildingPlugin }) {
  return <StartBuildingPluginCommand options={plugin.options} />
}

function StartBuildingPanel({ panel }: { panel: StartBuildingPanelContent }) {
  return (
    <div className="col-span-12 min-w-0 md:col-span-6 xl:col-span-4">
      <p className="max-w-md text-base leading-7 text-neutral-600">
        <span className="text-black">{panel.audience}</span> {panel.body}
      </p>
      {panel.kind === "template" ? (
        <ActionList actions={panel.actions} />
      ) : (
        <PluginCommand plugin={panel.plugin} />
      )}
    </div>
  )
}

export function StartBuilding({ content }: { content: StartBuildingContent }) {
  return (
    <section
      className="pt-20 pb-16 md:pt-[120px] md:pb-20 lg:pt-[168px] lg:pb-24"
      aria-labelledby="start-building-heading"
    >
      <div className="grid grid-cols-12 gap-x-5 gap-y-12 text-left">
        <h2
          id="start-building-heading"
          className="col-span-12 max-w-[760px] text-[40px] leading-tight font-normal text-black lg:col-span-8"
        >
          {content.title}
        </h2>

        <div className="col-span-12 grid min-w-0 grid-cols-12 gap-x-5 gap-y-10">
          {content.panels.map((panel) => (
            <StartBuildingPanel key={panel.id} panel={panel} />
          ))}
        </div>
      </div>
    </section>
  )
}
