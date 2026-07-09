import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Braces, Files, FileCode2, FileText } from "lucide-react";

import { siteConfig } from "@/lib/config";
import { FilesHeroDemo } from "@/components/files-hero-demo";
import { FileViewerStructureSketches } from "@/components/file-viewer-structure-sketches";
import { Button } from "@/components/ui/button";

const title = "FileViewer";
const description =
  "A fast, composable file viewer for PDFs, images, spreadsheets, slide decks, documents, markdown, JSON, code, and text.";

export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    images: [
      {
        url: `/og?title=${encodeURIComponent(
          title,
        )}&description=${encodeURIComponent(description)}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: `/og?title=${encodeURIComponent(
          title,
        )}&description=${encodeURIComponent(description)}`,
      },
    ],
  },
};

const formatGroups = [
  {
    title: "Documents",
    description:
      "PDF, DOCX, and PPTX render as paginated documents with stable zoom and page state.",
    contract: "fallbackFrameSize / fallbackSlideSize",
    formats: ["PDF", "DOCX", "PPTX"],
  },
  {
    title: "Images",
    description:
      "Raster inputs render as measured pages without changing the surrounding chrome.",
    contract: "fallbackFrameSize",
    formats: ["Image", "TIFF"],
  },
  {
    title: "Data",
    description:
      "Tables and structured payloads stay readable before they become extraction output.",
    contract: "fileName + mimeType",
    formats: ["XLSX", "CSV", "JSON"],
  },
  {
    title: "Text renderers",
    description:
      "Plain text, markdown, HTML, and code use dense text renderers instead of screenshots.",
    contract: "inline text source",
    formats: ["Markdown", "HTML", "Code", "Text"],
  },
];

const renderingModel = [
  {
    title: "Native scroll",
    description:
      "The browser keeps the scrollbar, momentum, focus, and accessibility semantics.",
  },
  {
    title: "Sticky render window",
    description:
      "When parsing lags behind a large jump, the rendered region stays pinned to the viewport edge.",
  },
  {
    title: "No blank frame",
    description:
      "The viewer never exposes an empty viewport while the next pages catch up.",
  },
];

const sourceExamples = [
  {
    title: "Stored file",
    code: `const source = {
  kind: "url",
  url: "/samples/spacex-prospectus.pdf",
  fileName: "spacex-prospectus.pdf",
  mimeType: "application/pdf",
}`,
  },
  {
    title: "Generated text",
    code: `const source = {
  kind: "text",
  text: reviewNotes,
  fileName: "review-notes.txt",
  mimeType: "text/plain",
}`,
  },
];

const sourceOptions = [
  {
    label: "Viewer choice",
    value: "fileName + mimeType",
  },
  {
    label: "Preview sizing",
    value: "fallbackFrameSize / fallbackSlideSize",
  },
  {
    label: "Document CSS",
    value: "isolateStyles",
  },
];

export default function FilesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="container-wrapper px-4 md:px-6">
        <div className="container mx-auto max-w-5xl xl:max-w-[80rem]">
          <section className="pt-16 pb-10 md:pt-20 md:pb-14">
            <div className="flex max-w-3xl flex-col gap-3 lg:max-w-4xl">
              <Files
                className="text-foreground mb-2 size-9"
                aria-hidden="true"
              />
              <h1 className="text-foreground text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl">
                The universal file viewer
              </h1>
              <p className="text-muted-foreground mb-2 max-w-[740px] text-base leading-7 text-pretty md:text-lg lg:text-xl">
                <code className="text-foreground">FileViewer</code> is a
                composable rendering frame for PDFs, Office files, images,
                tables, text, and code. It keeps resource loading, fallback
                dimensions, controls, and style isolation at the component edge.
              </p>
              <div className="flex flex-col gap-3 min-[460px]:flex-row min-[460px]:items-center">
                <Button
                  className="h-11 rounded-lg px-5 text-sm md:h-12 md:text-base"
                  asChild
                >
                  <Link href="/docs/components/file-viewer">
                    Documentation
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-lg px-5 text-sm md:h-12 md:text-base"
                  asChild
                >
                  <Link
                    href={siteConfig.links.github}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source
                    <FileCode2 className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="mt-10 md:mt-12">
              <FilesHeroDemo />
            </div>
          </section>

          <section className="py-10 md:py-12">
            <SectionHeader
              title="Compatible with any format"
              description="The file metadata selects a renderer. The surrounding shell, controls, viewport, and resource contract stay the same."
            />
            <FormatCoverageDemo />
          </section>

          <section className="py-10 md:py-12">
            <SectionHeader
              title="Virtualize without blanking"
              description={
                <>
                  FileViewer follows Pierre&apos;s{" "}
                  <Link
                    href="https://pierre.computer/writing/on-rendering-diffs"
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground underline underline-offset-4"
                  >
                    Inverse Sticky technique
                  </Link>
                  : preserve native scrolling, pin the rendered range while the
                  parser catches up, and keep the document viewport filled
                  during large jumps.
                </>
              }
            />
            <RenderingModelDemo />
          </section>

          <section className="py-10 md:py-12">
            <SectionHeader
              title="Compose the shell"
              description="The preset preview is only one shape. The provider, header, content, sidebar, inset, viewport, document, and controls can be rearranged around the same resource."
            />
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <CompositionCode />
              <FileViewerStructureSketches
                className="-mx-8 my-0 sm:mx-0"
                diagrams="structure"
                fitViewPadding={0.04}
                frameClassName="h-[20rem] sm:h-[24rem] lg:h-[26rem]"
              />
            </div>
          </section>

          <section className="pt-10 pb-16 md:pt-12">
            <SectionHeader
              title="Pass the file as data"
              description="Give FileViewer the source and metadata. The renderer, fallback sizing, and style isolation stay explicit at the call site."
            />
            <SourceObjectDemo />
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <div className="mb-5 max-w-3xl">
      <h2 className="text-foreground text-2xl font-semibold tracking-tight text-balance md:text-3xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-[720px] text-sm leading-6 text-pretty md:text-base md:leading-7">
        {description}
      </p>
    </div>
  );
}

function FormatCoverageDemo() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="text-muted-foreground bg-muted/20 hidden grid-cols-[16rem_1fr_15rem] gap-4 border-b px-4 py-2 font-mono text-xs md:grid">
        <div>family</div>
        <div>viewer behavior</div>
        <div>explicit input</div>
      </div>
      {formatGroups.map((group) => (
        <div
          key={group.title}
          className="grid gap-3 border-b px-4 py-4 last:border-b-0 md:grid-cols-[16rem_1fr_15rem] md:items-center md:gap-4 md:py-3"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-foreground mr-1 text-sm font-medium">
              {group.title}
            </div>
            {group.formats.map((format) => (
              <span
                key={format}
                className="bg-muted/35 text-muted-foreground rounded-md border px-2 py-1 font-mono text-xs"
              >
                {format}
              </span>
            ))}
          </div>
          <p className="text-muted-foreground text-sm leading-6">
            {group.description}
          </p>
          <code className="text-muted-foreground self-start font-mono text-xs md:pt-1">
            {group.contract}
          </code>
        </div>
      ))}
    </div>
  );
}

function RenderingModelDemo() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="text-muted-foreground flex items-center justify-between gap-3 border-b px-4 py-3 font-mono text-xs">
        <span>scroll model</span>
        <span>large documents stay filled</span>
      </div>
      <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        {renderingModel.map((item) => (
          <div key={item.title} className="p-4">
            <div className="text-foreground text-sm font-medium">
              {item.title}
            </div>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompositionCode() {
  return (
    <div className="bg-muted/25 overflow-hidden rounded-lg border">
      <div className="flex h-10 items-center gap-2 border-b px-3 text-xs">
        <Braces className="text-muted-foreground size-4" aria-hidden="true" />
        <span className="font-mono">file-viewer.tsx</span>
      </div>
      <pre className="overflow-x-auto p-5 text-xs leading-6 md:text-sm">
        <code>{`<FileViewerProvider
  source={source}
  fallbackFrameSize={frameSize}
  isolateStyles
>
  <FileViewer>
    <FileViewerHeader>
      <FileViewerTitle />
      <FileViewerControls />
    </FileViewerHeader>
    <FileViewerContent>
      <FileViewerInset>
        <FileViewerViewport>
          <FileViewerDocument />
        </FileViewerViewport>
      </FileViewerInset>
    </FileViewerContent>
  </FileViewer>
</FileViewerProvider>`}</code>
      </pre>
    </div>
  );
}

function SourceObjectDemo() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="grid gap-4 md:grid-cols-2">
        {sourceExamples.map((example) => (
          <div
            key={example.title}
            className="bg-muted/25 overflow-hidden rounded-lg border"
          >
            <div className="flex h-10 items-center gap-2 border-b px-3 text-xs">
              <FileText
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
              <span className="font-mono">{example.title}</span>
            </div>
            <pre className="overflow-x-auto p-4 text-xs leading-6">
              <code>{example.code}</code>
            </pre>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border">
        {sourceOptions.map((option) => (
          <div
            key={option.label}
            className="grid gap-2 border-b p-4 last:border-b-0"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Braces className="size-4" aria-hidden="true" />
              {option.label}
            </div>
            <code className="text-muted-foreground font-mono text-xs">
              {option.value}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
