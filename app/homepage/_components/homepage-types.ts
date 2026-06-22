export type LinkItem = {
  readonly label: string;
  readonly href: string;
  readonly badge?: string;
  readonly description?: string;
  readonly ariaLabel?: string;
  readonly isExternal?: boolean;
  readonly action?: "cookie-preferences";
};

export type HeaderNavItem =
  | {
      readonly kind: "group";
      readonly group: NavGroup;
    }
  | {
      readonly kind: "link";
      readonly item: LinkItem;
    };

export type NavGroup = {
  readonly id: string;
  readonly label: string;
  readonly sections: readonly NavSection[];
};

export type NavSection = {
  readonly title: string;
  readonly items: readonly LinkItem[];
};

export type HeaderAction = LinkItem & {
  readonly variant?: "primary" | "secondary";
};

export type HeaderContent = {
  readonly homeHref: string;
  readonly navItems: readonly HeaderNavItem[];
  readonly desktopActions: readonly HeaderAction[];
  readonly mobileActions: readonly HeaderAction[];
};

export type LogoContent = {
  readonly id: string;
  readonly label: string;
  readonly image: {
    readonly src: string;
    readonly width: number;
    readonly height: number;
    readonly className?: string;
  };
};

export type ProductLaneLayout = "default" | "reversed";

export type ProductFeatureContent =
  | string
  | {
      readonly label: string;
      readonly command: string;
      readonly copyLabel?: string;
    };

export type ProductLaneContent = {
  readonly id: string;
  readonly title: string;
  readonly layout: ProductLaneLayout;
  readonly description: string;
  readonly proofCustomer: string;
  readonly proof: string;
  readonly features: readonly ProductFeatureContent[];
  readonly visual: ProductVisualContent;
};

export type ProductVisualContent = {
  readonly kind:
    | "workflow"
    | "extraction"
    | "reliability"
    | "agents"
    | "enterprise";
};

export type LatestMetric = readonly [label: string, value: string];

export type FeaturedLatestCard = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly badge: string;
  readonly href: string;
  readonly imageSrc: string;
  readonly alt: string;
};

export type SecondaryLatestCardTone = "light" | "dark";

export type SecondaryLatestCardVisual =
  | {
      readonly kind: "metrics";
      readonly metrics: readonly LatestMetric[];
    }
  | {
      readonly kind: "sandbox";
    };

export type SecondaryLatestCard = {
  readonly id: string;
  readonly label: string;
  readonly body: string;
  readonly href: string;
  readonly tone: SecondaryLatestCardTone;
  readonly visual: SecondaryLatestCardVisual;
};

export type FooterColumnContent = {
  readonly id: string;
  readonly title: string;
  readonly links: readonly LinkItem[];
};

export type FooterStatusContent = {
  readonly label: string;
  readonly ariaLabel?: string;
};

export type ThemeValue = "system" | "light" | "dark";

export type ThemeOption = {
  readonly value: ThemeValue;
  readonly label: string;
};

export type FooterContent = {
  readonly message: string;
  readonly status: FooterStatusContent;
  readonly columns: readonly FooterColumnContent[];
  readonly themeOptions: readonly ThemeOption[];
};

export type StartBuildingAction = LinkItem & {
  readonly variant?: "primary" | "secondary";
};

export type StartBuildingCommandOption = {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly prompt?: string;
  readonly icon:
    | {
        readonly kind?: "image";
        readonly src: string;
        readonly width: number;
        readonly height: number;
        readonly className?: string;
      }
    | {
        readonly kind: "skills";
        readonly className?: string;
      }
    | {
        readonly kind: "square-terminal";
        readonly className?: string;
      };
};

export type StartBuildingCommandGroup = {
  readonly id: string;
  readonly label: string;
  readonly copyLabel: string;
} & (
  | {
      readonly kind: "select";
      readonly options: readonly [
        StartBuildingCommandOption,
        ...StartBuildingCommandOption[],
      ];
    }
  | {
      readonly kind: "fixed";
      readonly option: StartBuildingCommandOption;
    }
);

type StartBuildingPanelBase = {
  readonly id: string;
  readonly audience: string;
  readonly body: string;
};

export type StartBuildingPanel =
  | (StartBuildingPanelBase & {
      readonly kind: "template";
      readonly actions: readonly StartBuildingAction[];
    })
  | (StartBuildingPanelBase & {
      readonly kind: "commands";
      readonly commandGroups: readonly [
        StartBuildingCommandGroup,
        ...StartBuildingCommandGroup[],
      ];
    });

export type StartBuildingContent = {
  readonly title: string;
  readonly panels: readonly StartBuildingPanel[];
};
