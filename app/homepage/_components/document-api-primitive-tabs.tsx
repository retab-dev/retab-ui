"use client";

import type { ComponentType, ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ClassificationViewerExample } from "@/registry/new-york-v4/blocks/classification-viewer-demo";
import { EditViewerBlock } from "@/registry/new-york-v4/blocks/edit-viewer-block";
import { ParseViewerBlock } from "@/registry/new-york-v4/blocks/parse-viewer-block";
import { SplitViewerBlock } from "@/registry/new-york-v4/blocks/split-viewer-block";
import { SourcesViewerPdfBlock } from "@/registry/new-york-v4/blocks/sources-viewer-block";

type PrimitiveTab = {
  value: string;
  label: string;
  Viewer: ComponentType;
};

const primitiveTabs = [
  { value: "extract", label: "Extract", Viewer: SourcesViewerPdfBlock },
  { value: "split", label: "Split", Viewer: SplitViewerBlock },
  { value: "edit", label: "Edit", Viewer: EditViewerBlock },
  { value: "parse", label: "Parse", Viewer: ParseViewerBlock },
  { value: "classify", label: "Classify", Viewer: ClassifyViewerBlock },
] as const satisfies readonly PrimitiveTab[];

export function DocumentApiPrimitiveTabs({
  proofCustomer,
  proof,
}: {
  proofCustomer: string;
  proof: string;
}) {
  return (
    <Tabs defaultValue="extract" className="mt-10 block lg:mt-11">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-5">
        <div className="mt-8 min-w-0 space-y-8 lg:col-span-3 lg:col-start-1 lg:row-start-1 lg:mt-0 lg:pt-8">
          <p className="text-foreground max-w-sm text-3xl leading-tight text-balance md:text-4xl">
            <span className="text-muted-foreground">{proofCustomer}</span>{" "}
            {proof}
          </p>

          <div className="space-y-1.5">
            <p className="text-muted-foreground font-mono text-sm leading-5 font-normal">
              Features
            </p>
            <TabsList
              aria-label="Document API primitive"
              className="text-muted-foreground m-0 flex h-auto w-fit flex-col items-start justify-start gap-1.5 rounded-none bg-transparent p-0"
              variant="line"
            >
              {primitiveTabs.map(({ value, label }) => (
                <TabsTrigger
                  className="text-muted-foreground hover:text-foreground data-[state=active]:text-foreground h-auto flex-none justify-start rounded-none border-0 bg-transparent p-0 font-mono text-sm leading-5 font-semibold uppercase shadow-none after:hidden focus-visible:ring-0 focus-visible:outline-offset-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  key={value}
                  value={value}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="min-w-0 lg:col-span-8 lg:col-start-5 lg:row-start-1">
          {primitiveTabs.map(({ value, label, Viewer }) => (
            <TabsContent className="mt-0" key={value} value={value}>
              <PrimitiveViewerFrame label={label}>
                <Viewer />
              </PrimitiveViewerFrame>
            </TabsContent>
          ))}
        </div>
      </div>
    </Tabs>
  );
}

function PrimitiveViewerFrame({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div
      aria-label={`${label} primitive viewer`}
      className={cn(
        "border-border bg-card h-[680px] overflow-hidden rounded-xl border shadow-sm",
        className,
      )}
      role="group"
    >
      {children}
    </div>
  );
}

function ClassifyViewerBlock() {
  return (
    <ClassificationViewerExample
      className="h-full"
      style={{ height: "100%" }}
    />
  );
}
