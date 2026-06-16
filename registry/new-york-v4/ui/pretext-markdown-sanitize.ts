"use client"

import {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize"

export type PretextMarkdownSvgSanitizer = {
  sanitize: (
    source: string,
    options: typeof PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS
  ) => string
}

export const PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS = {
  ADD_ATTR: [
    "aria-label",
    "aria-labelledby",
    "data-source",
    "data-testid",
    "role",
  ],
  FORBID_TAGS: [
    "a",
    "animate",
    "audio",
    "canvas",
    "embed",
    "foreignObject",
    "iframe",
    "image",
    "link",
    "object",
    "set",
    "script",
    "style",
    "use",
    "video",
  ],
  FORBID_ATTR: ["href", "style", "xlink:href"],
  SANITIZE_NAMED_PROPS: true,
  USE_PROFILES: { svg: true, svgFilters: true },
} as const
export const PRETEXT_MARKDOWN_KATEX_OPTIONS = {
  maxExpand: 1000,
  maxSize: 10,
  strict: "ignore",
  trust: false,
} as const

export function sanitizePretextMarkdownSvg(
  svg: string,
  sanitizer: PretextMarkdownSvgSanitizer
) {
  const sanitized = sanitizer
    .sanitize(svg, PRETEXT_MARKDOWN_SVG_SANITIZE_OPTIONS)
    .trim()

  return /^<svg(?:\s|>)/i.test(sanitized) ? sanitized : ""
}

export function createPretextMarkdownSanitizeSchema(): RehypeSanitizeOptions {
  return {
    ...defaultSchema,
    clobberPrefix: "user-content-",
    attributes: {
      ...defaultSchema.attributes,
      "*": [
        ...(defaultSchema.attributes?.["*"] ?? []),
        "ariaDescribedBy",
        "ariaHidden",
        "ariaLabel",
        "ariaLabelledBy",
        "dataFootnoteBackref",
        "dataFootnoteRef",
        "dataPretextAlertKind",
        "dataPretextCalloutKind",
        "dataPretextCalloutTitle",
        "dataPretextComponentName",
        "dataPretextComponentProps",
        "dataPretextComponentFallbackName",
        "dataPretextComponentFallbackReason",
        "dataPretextComponentFallbackSource",
        "dataPretextDefinitionList",
        "dataPretextDefinitionDescription",
        "dataPretextDefinitionTerm",
        "dataPretextHeadingId",
      ],
      abbr: ["title"],
      code: [...(defaultSchema.attributes?.code ?? []), "metastring"],
      dfn: ["title"],
      mark: ["title"],
      time: ["dateTime", "title"],
    },
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "abbr",
      "caption",
      "cite",
      "details",
      "dd",
      "dfn",
      "dl",
      "dt",
      "figcaption",
      "figure",
      "kbd",
      "mark",
      "small",
      "sub",
      "summary",
      "sup",
      "time",
    ],
  }
}
