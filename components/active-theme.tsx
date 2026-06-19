"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { KeyedRunner } from "@/hooks/KeyedRunner";

const DEFAULT_THEME = "default";

type ThemeContextType = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: string;
}) {
  const [activeTheme, setActiveTheme] = useState<string>(
    () => initialTheme || DEFAULT_THEME,
  );

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      <KeyedRunner
        key={`active-theme:${activeTheme}`}
        effect={() => {
          Array.from(document.body.classList)
            .filter((className) => className.startsWith("theme-"))
            .forEach((className) => {
              document.body.classList.remove(className);
            });
          document.body.classList.add(`theme-${activeTheme}`);
          if (activeTheme.endsWith("-scaled")) {
            document.body.classList.add("theme-scaled");
          }
        }}
      />
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeConfig() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error(
      "useThemeConfig must be used within an ActiveThemeProvider",
    );
  }
  return context;
}
