const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://retab.com/ui";

export const siteConfig = {
  name: "Retab UI",
  url: appUrl,
  ogImage: `${appUrl}/og`,
  description:
    "Open source UI primitives for document AI products — viewers for Retab parses, extractions, edits, classifications, partitions, and splits.",
  links: {
    github: "https://github.com/retab-dev/ui",
  },
  navItems: [
    {
      href: "/homepage",
      label: "Homepage",
    },
    {
      href: "/docs",
      label: "Docs",
    },
    {
      href: "/docs/components",
      label: "Components",
    },
    {
      href: "/blocks",
      label: "Blocks",
    },
  ],
};

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
};
