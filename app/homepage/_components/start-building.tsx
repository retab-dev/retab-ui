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
      <p className="text-muted-foreground max-w-md text-base leading-6">
        <span className="text-foreground">{panel.audience}</span> {panel.body}
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
      className="relative z-10 pt-20 pb-16 md:pt-32 md:pb-20 lg:pt-44 lg:pb-20"
      aria-labelledby="start-building-heading"
    >
      <div className="grid grid-cols-12 gap-x-5 gap-y-12 text-left">
        <h2
          id="start-building-heading"
          className="lg:text-homepage-start lg:leading-homepage-start text-foreground col-span-12 max-w-3xl text-4xl leading-tight font-normal lg:col-span-8 lg:col-start-3 lg:max-w-none"
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
