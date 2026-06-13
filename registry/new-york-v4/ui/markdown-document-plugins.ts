import type { Options as ReactMarkdownOptions } from "react-markdown"
import rehypeKatex from "rehype-katex"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import remarkBreaks from "remark-breaks"
import remarkDirective from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import { remarkMarkdownCallouts } from "./markdown-document-callouts"
import { createMarkdownSanitizeSchema } from "./markdown-document-sanitize"

export const MARKDOWN_DOCUMENT_REMARK_PLUGINS: ReactMarkdownOptions["remarkPlugins"] =
  [remarkGfm, remarkBreaks, remarkMath, remarkDirective, remarkMarkdownCallouts]

export const MARKDOWN_DOCUMENT_REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] =
  [
    rehypeRaw,
    [rehypeSanitize, createMarkdownSanitizeSchema()],
    rehypeSlug,
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
