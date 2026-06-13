import {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize"

export function createMarkdownSanitizeSchema(): RehypeSanitizeOptions {
  return {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      "*": [
        ...(defaultSchema.attributes?.["*"] ?? []),
        "ariaDescribedBy",
        "ariaHidden",
        "ariaLabel",
        "ariaLabelledBy",
        "dataCalloutKind",
        "dataCalloutTitle",
        "dataComponentKind",
        "dataComponentLabel",
        "dataComponentName",
        "dataComponentSource",
        "dataComponentTitle",
        "dataComponentValue",
        "dataFootnoteBackref",
        "dataFootnoteRef",
        "dataRehypePrettyCodeCaption",
        "dataRehypePrettyCodeFigure",
        "dataRehypePrettyCodeTitle",
        "dataLanguage",
        "dataTheme",
      ],
      code: [
        ...(defaultSchema.attributes?.code ?? []),
        "dataLanguage",
        "dataTheme",
      ],
      div: [
        ...(defaultSchema.attributes?.div ?? []),
        "dataCalloutKind",
        "dataCalloutTitle",
        "dataComponentKind",
        "dataComponentLabel",
        "dataComponentName",
        "dataComponentSource",
        "dataComponentTitle",
        "dataComponentValue",
      ],
      figure: [
        ...(defaultSchema.attributes?.figure ?? []),
        "dataLanguage",
        "dataRehypePrettyCodeFigure",
        "dataTheme",
      ],
      h2: [...(defaultSchema.attributes?.h2 ?? []), ["className", "sr-only"]],
      mark: ["title"],
      pre: [
        ...(defaultSchema.attributes?.pre ?? []),
        "dataLanguage",
        "dataTheme",
      ],
      span: [
        ...(defaultSchema.attributes?.span ?? []),
        "ariaHidden",
        "dataCharsId",
        "dataHighlightedChars",
        "dataHighlightedLine",
        "dataLine",
        "dataTheme",
      ],
    },
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      "figcaption",
      "figure",
      "mark",
    ],
  }
}
