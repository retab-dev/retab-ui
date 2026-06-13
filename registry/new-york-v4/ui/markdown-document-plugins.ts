import type { Options as ReactMarkdownOptions } from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkBreaks from "remark-breaks"
import remarkDirective from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { remarkMarkdownCallouts } from "./markdown-document-callouts"
import {
  rehypeMarkdownComponents,
  remarkMarkdownComponents,
} from "./markdown-document-components"
import { remarkMarkdownProseTransforms } from "./markdown-document-prose-transforms"
import { createMarkdownSanitizeSchema } from "./markdown-document-sanitize"

export const MARKDOWN_DOCUMENT_REMARK_PLUGINS: ReactMarkdownOptions["remarkPlugins"] =
  [
    remarkGfm,
    remarkBreaks,
    remarkMath,
    remarkDirective,
    remarkMarkdownCallouts,
    remarkMarkdownComponents,
    remarkMarkdownProseTransforms,
  ]

export const MARKDOWN_DOCUMENT_REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] =
  [
    rehypeRaw,
    rehypeMarkdownComponents,
    [rehypeSanitize, createMarkdownSanitizeSchema()],
    rehypeKatex,
    [
      rehypePrettyCode,
      {
        keepBackground: false,
        theme: {
          dark: "github-dark",
          light: "github-light-default",
        },
      },
    ],
  ]
