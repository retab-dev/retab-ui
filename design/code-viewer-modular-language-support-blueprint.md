# Code Viewer Modular Language Support Blueprint

## Purpose

`CodeViewer` already tokenizes and highlights one language: JSON. The
tokenize → kind → CSS-class → style pipeline is split across the right
modules, and that split is sound. But the implementation is closed: it ships a
single hand-written JSON grammar, selects it with a hardcoded `if`, and styles
a fixed set of token kinds.

This document specifies the change from "JSON-only, hardcoded" to "modular
language support" — where a consumer adds the Prism language components they
want at install time and gets syntax highlighting for those languages.

The goal is the same as every Code Viewer blueprint:

- simplicity;
- speed;
- everything needed;
- nothing more;
- perfect modularization;
- high-entropy code;
- perfectly consistent names.

The first draft of this document failed that test. It proposed a `CodeLanguage`
registry type, a `matches(resource)` predicate per language, a version-suffixed
`identity` field, and a `languages` prop threaded through the public API. That
is a plugin framework. shadcn components are not plugin frameworks — the
consumer owns the source. The platonic design is smaller than the first draft,
and this rewrite is that smaller design.

## Current Shape

```text
code-viewer-syntax.ts
  createCodeSyntax(resource): picks a grammar, returns { identity, getLineTokens }
  JSON_LANGUAGE: hand-written inline Prism.Grammar
  codeSyntaxLanguage(resource): hardcoded .json / .json5 / application/json -> JSON_LANGUAGE
  CODE_VIEWER_SYNTAX_STYLE: CSS for 5 token colors
  flattenCodeTokens: Prism token tree -> flat { kind, text } leaves

code-viewer-projector.ts
  CODE_TOKEN_CLASS: fixed map of ~8 kinds -> cv-token-* classes
  patchCodeContent: leaf.kind -> class -> span; unknown kinds fall to plain text

code-viewer-syntax-style.tsx
  injects CODE_VIEWER_SYNTAX_STYLE once into <head>
```

This is a good shape. It is not yet a modular shape.

## What "Well Implemented" Means Here

The architecture is well implemented. The feature is not.

- **Well implemented:** the layering. Per-line tokenization fits the
  virtualized renderer. The `{ kind, text }` leaf decouples Prism from the DOM.
  Token classes are driven by CSS variables, so theming is already a consumer
  concern.
- **Not yet implemented:** modularity. There is no use of Prism's component
  ecosystem, the language selection is control flow rather than data, and the
  token vocabulary is a closed set. Adding a language today means editing three
  files by hand.

## The Four Gaps

### Gap 1: The Grammar Is Inline, Not From Prism's Component Library

`JSON_LANGUAGE` is a literal `Prism.Grammar` object. The code never touches
`Prism.languages` and never imports any `prismjs/components/prism-*` file. Prism
is used only as a tokenizer engine, not as a language registry.

This is the central gap. "People add Prism extensions at install" *is* the
`Prism.languages` registry plus side-effecting component imports. We are not
using it.

### Gap 2: Language Selection Is a Hardcoded `if`

`codeSyntaxLanguage(resource)` returns `JSON_LANGUAGE` for three filename/MIME
conditions and `null` otherwise. Adding a language means editing this control
flow. The mapping from file to language should be data, not branches.

### Gap 3: `identity` Is Hardcoded to `"json:v1"`

`createCodeSyntax` always returns `identity: "json:v1"`. The projector uses
`syntaxIdentity` in its row-content cache key. The moment a second language
exists, two languages share `"json:v1"` and switching documents yields stale
highlighting. This is a latent correctness bug — it must be fixed in the same
change that adds the second language, never after.

### Gap 4: The Token Vocabulary Is Closed

`CODE_TOKEN_CLASS` maps ~8 kinds; the CSS colors 5. Real languages emit
`comment`, `function`, `class-name`, `tag`, `attr-name`, `selector`,
`variable`, `regex`, `builtin`, and more. Unmatched kinds fall through to an
unstyled text node, so Python or HTML tokenizes correctly but renders nearly
monochrome.

## Target Design

### Principle

The viewer owns the *engine* (Prism) and the *token rendering* (kind → class →
CSS). The consumer owns the *set of languages*, enabled by importing Prism
components. The only viewer-side knowledge is the irreducible one Prism does not
provide: which file extension maps to which language id.

That knowledge is one `Record`. It is the single seam, and it is data.

### 1. One extension table — the single edit point

```ts
// code-viewer-syntax.ts
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  json: "json",
  json5: "json",
}
```

Adding Rust is two lines, in the consumer's own copy of the source:

```ts
// app entry
import "prismjs/components/prism-rust"
// code-viewer-syntax.ts
const LANGUAGE_BY_EXTENSION = { json: "json", json5: "json", rs: "rust" }
```

No new prop, no registry object, no predicate function. The consumer edits a
file they already own — the shadcn contract.

### 2. Resolve grammars from `Prism.languages`

```ts
function grammarFor(languageId: string): Prism.Grammar | null {
  return Prism.languages[languageId] ?? null
}

function languageIdFor(resource: ViewerResource): string | null {
  const ext = extensionOf(resource.fileName)
  return (ext && LANGUAGE_BY_EXTENSION[ext]) ?? mimeLanguageId(resource) ?? null
}
```

`mimeLanguageId` is a minimal fallback only for inline sources without an
extension (e.g. `application/json` text). It earns its place only because the
inline-text path is a documented use of this component; if it does not, cut it.

JSON ships in the default install via `import "prismjs/components/prism-json"`
at the top of the file. The hand-written `JSON_LANGUAGE` grammar is **deleted** —
one mechanism for all languages, ~15 fewer regex lines to maintain.

### 3. `identity` is the language id

```ts
const languageId = languageIdFor(resource)
const grammar = languageId ? grammarFor(languageId) : null
if (!grammar) return { identity: "plain", getLineTokens: () => null }
return { identity: languageId, getLineTokens: /* unchanged, with per-line cache */ }
```

No `:v1` suffix, no separate field. The id uniquely identifies the grammar, so
the projector cache is correct across language switches by construction. Gap 3
closes itself.

### 4. The class name is the kind — no map

```ts
// code-viewer-projector.ts — patchCodeContent
const span = document.createElement("span")
span.className = "cv-token-" + leaf.kind
span.textContent = leaf.text
```

`CODE_TOKEN_CLASS` and the `if (!className)` fallback branch are both **deleted**.
An unknown kind gets a class with no CSS rule and inherits the foreground — the
graceful fallback falls out for free. Semantic color aliasing lives in CSS,
where color decisions belong:

```css
.cv-token-comment   { color: var(--cv-token-comment); }
.cv-token-function  { color: var(--cv-token-function); }
.cv-token-keyword   { color: var(--cv-token-keyword); }
.cv-token-boolean,
.cv-token-null      { color: var(--cv-token-keyword); }
.cv-token-operator  { color: var(--cv-token-punctuation); }
/* ...existing string / number / property / punctuation, plus dark overrides */
```

## Module Impact

```text
code-viewer-syntax.ts
  - delete JSON_LANGUAGE and the codeSyntaxLanguage if-chain
  + import "prismjs/components/prism-json"
  + LANGUAGE_BY_EXTENSION record + languageIdFor + grammarFor
  ~ createCodeSyntax: identity = languageId ?? "plain"
  + expanded CODE_VIEWER_SYNTAX_STYLE (more --cv-token-* vars + CSS aliases)

code-viewer-projector.ts
  - delete CODE_TOKEN_CLASS and the unknown-kind branch
  ~ patchCodeContent: className = "cv-token-" + leaf.kind

code-viewer-content.tsx / code-viewer.tsx / code-viewer-types.ts
  unchanged — no new prop
```

Default install behavior — JSON highlighted, everything else plain — is
preserved exactly.

## Consumer Story (what the docs must say)

1. `npx shadcn@latest add @retab/code-viewer` — JSON highlighting works.
2. To add a language: `import "prismjs/components/prism-python"` once at app
   startup, and add `py: "python"` to `LANGUAGE_BY_EXTENSION`.
3. The viewer detects it by extension and highlights it.

This belongs as a new **Languages** section in
`content/docs/viewers/code-viewer.mdx`, which currently says nothing about
syntax highlighting at all.

## Sequencing

1. Extension table + `grammarFor` + Prism-component JSON + language-derived
   identity (Gaps 1–3 together — Gap 3 cannot trail Gap 2 without shipping the
   stale-cache bug).
2. Class-name-from-kind + expanded CSS (Gap 4).
3. Docs: Languages section.

## Non-Goals

- **A `languages` prop or registry object.** The consumer owns the source; the
  extension table is the seam. A prop is surface area that exists only to avoid
  editing an owned file.
- **Runtime dynamic loading of Prism components by id.** The install-time
  import model is simpler and tree-shakeable. Do not build a loader.
- **Whole-file / cross-line tokenization.** The viewer tokenizes per line by
  design for virtualization; languages with significant multi-line constructs
  (docstrings, template literals, block comments) mis-tokenize at line
  boundaries. This is the true scope of the component — a fast line-local
  highlighter — not a defect. Document the limit; do not defeat it, because
  defeating it breaks the speed guarantee that justifies the virtualized
  renderer in the first place.
- **A theme system beyond the existing `--cv-token-*` CSS variables.**
