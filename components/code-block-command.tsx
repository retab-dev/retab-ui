"use client";

/* eslint-disable no-restricted-syntax -- TODO(no-useEffect): existing direct React effect usage; migrate to useMountEffect or a Rule 1-5 replacement. */

import * as React from "react";
import { Terminal } from "lucide-react";

import { useConfig } from "@/hooks/use-config";
import {
  CodeHeaderCopyButton,
  copyToClipboardWithMeta,
} from "@/components/copy-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CodeBlockCommand({
  __npm__,
  __yarn__,
  __pnpm__,
  __bun__,
}: React.ComponentProps<"pre"> & {
  __npm__?: string;
  __yarn__?: string;
  __pnpm__?: string;
  __bun__?: string;
}) {
  const [config, setConfig] = useConfig();
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (hasCopied) {
      const timer = setTimeout(() => setHasCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasCopied]);

  const packageManager = config.packageManager || "pnpm";
  const tabs = React.useMemo(() => {
    return {
      pnpm: __pnpm__,
      npm: __npm__,
      yarn: __yarn__,
      bun: __bun__,
    };
  }, [__npm__, __pnpm__, __yarn__, __bun__]);

  const copyCommand = React.useCallback(() => {
    const command = tabs[packageManager];

    if (!command) {
      return;
    }

    copyToClipboardWithMeta(command, {
      name: "copy_npm_command",
      properties: {
        command,
        pm: packageManager,
      },
    });
    setHasCopied(true);
  }, [packageManager, tabs]);

  return (
    <div className="overflow-x-auto">
      <Tabs
        value={packageManager}
        className="gap-0"
        onValueChange={(value) => {
          setConfig({
            ...config,
            packageManager: value as "pnpm" | "npm" | "yarn" | "bun",
          });
        }}
      >
        <div className="border-border/50 flex min-h-10 items-center justify-between gap-3 border-b px-3 py-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="bg-foreground flex size-4 shrink-0 items-center justify-center rounded-[1px] opacity-70">
              <Terminal className="text-code size-3" />
            </div>
            <TabsList className="min-w-0 rounded-none bg-transparent p-0">
              {Object.entries(tabs).map(([key]) => {
                return (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="data-[state=active]:border-input data-[state=active]:bg-background! h-7 border border-transparent pt-0.5 shadow-none!"
                  >
                    {key}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <CodeHeaderCopyButton
            value={tabs[packageManager] ?? ""}
            copied={hasCopied}
            disabled={hasCopied}
            onClick={copyCommand}
          />
        </div>
        <div className="no-scrollbar overflow-x-auto">
          {Object.entries(tabs).map(([key, value]) => {
            return (
              <TabsContent key={key} value={key} className="mt-0 px-4 py-3.5">
                <pre>
                  <code
                    className="relative font-mono text-sm leading-none"
                    data-language="bash"
                  >
                    {value}
                  </code>
                </pre>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
}
