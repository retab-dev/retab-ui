export type LinkItem = {
  readonly label: string;
  readonly href: string;
  readonly badge?: string;
  readonly ariaLabel?: string;
  readonly isExternal?: boolean;
  readonly action?: "cookie-preferences";
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
  readonly navGroups: readonly NavGroup[];
  readonly utilityLinks: readonly LinkItem[];
  readonly desktopActions: readonly HeaderAction[];
  readonly mobileActions: readonly HeaderAction[];
};

export type LogoVariant =
  | "text"
  | "monogram"
  | "diamond-wordmark"
  | "large-diamond-wordmark"
  | "pill-wordmark"
  | "stacked-serif"
  | "stacked-bold";

export type LogoContent = {
  readonly id: string;
  readonly label: string;
  readonly variant: LogoVariant;
  readonly lines?: readonly string[];
};

export type ProductLaneLayout = "default" | "reversed";

export type ProductLaneContent = {
  readonly id: string;
  readonly title: string;
  readonly layout: ProductLaneLayout;
  readonly description: string;
  readonly proofCustomer: string;
  readonly proof: string;
  readonly features: readonly string[];
  readonly image: ProductVisualImage;
};

export type ProductVisualImage = {
  readonly desktopSrc: string;
  readonly desktopDarkSrc: string;
  readonly desktopWidth: number;
  readonly desktopHeight: number;
  readonly mobileSrc: string;
  readonly mobileDarkSrc: string;
  readonly mobileWidth: number;
  readonly mobileHeight: number;
  readonly alt: string;
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

export type FooterStatusContent = LinkItem;

export type ThemeValue = "system" | "light" | "dark";

export type ThemeOption = {
  readonly value: ThemeValue;
  readonly label: string;
};

export type FooterContent = {
  readonly status: FooterStatusContent;
  readonly columns: readonly FooterColumnContent[];
  readonly themeOptions: readonly ThemeOption[];
};

export type StartBuildingAction = LinkItem & {
  readonly variant?: "primary" | "secondary";
};

export type StartBuildingPluginOption = {
  readonly label: string;
  readonly command: string;
};

export type StartBuildingPlugin = {
  readonly options: readonly [
    StartBuildingPluginOption,
    ...StartBuildingPluginOption[],
  ];
};

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
      readonly kind: "plugin";
      readonly plugin: StartBuildingPlugin;
    });

export type StartBuildingContent = {
  readonly title: string;
  readonly panels: readonly StartBuildingPanel[];
};
