import {
  type StartBuildingAction,
  type StartBuildingContent,
  type StartBuildingPanel as StartBuildingPanelContent,
} from "./homepage-types";
import { getLinkAriaLabel, getLinkProps, MarketingButton } from "./primitives";
import { StartBuildingPluginCommand } from "./start-building-plugin-command";

function ActionList({ actions }: { actions: readonly StartBuildingAction[] }) {
  return (
    <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
      {actions.map((action) => (
        <MarketingButton
          key={action.label}
          href={action.href}
          aria-label={getLinkAriaLabel(action)}
          {...getLinkProps(action)}
          variant={action.variant}
          className="w-full sm:w-auto"
        >
          {action.label}
        </MarketingButton>
      ))}
    </div>
  );
}

function StartBuildingPanel({ panel }: { panel: StartBuildingPanelContent }) {
  return (
    <div className="col-span-12 min-w-0 md:col-span-6 lg:col-span-4">
      <p className="max-w-md text-base leading-6 text-neutral-600">
        <span className="text-black">{panel.audience}</span> {panel.body}
      </p>
      {panel.kind === "template" ? (
        <ActionList actions={panel.actions} />
      ) : (
        <StartBuildingPluginCommand options={panel.plugin.options} />
      )}
    </div>
  );
}

export function StartBuilding({ content }: { content: StartBuildingContent }) {
  return (
    <section
      className="relative z-10 pt-20 pb-16 md:pt-32 md:pb-20 lg:pt-28 lg:pb-20"
      aria-labelledby="start-building-heading"
    >
      <div className="grid grid-cols-12 gap-x-5 gap-y-12 text-left">
        <h2
          id="start-building-heading"
          className="col-span-12 max-w-3xl text-4xl leading-tight font-normal text-black lg:col-span-8 lg:col-start-3 lg:max-w-none lg:text-5xl"
        >
          {content.title}
        </h2>

        <div className="col-span-12 grid min-w-0 grid-cols-12 gap-x-5 gap-y-10 lg:col-span-8 lg:col-start-3 lg:grid-cols-8">
          {content.panels.map((panel) => (
            <StartBuildingPanel key={panel.id} panel={panel} />
          ))}
        </div>
      </div>
    </section>
  );
}
