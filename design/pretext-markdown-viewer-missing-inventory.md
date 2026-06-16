# Pretext Markdown Viewer Missing Inventory

The new `PretextMarkdownViewer` is intentionally separate from the existing
`MarkdownDocumentViewer`. It starts from the Chenglou/Pretext continuous text
viewer path and should evolve into the replacement Markdown surface without
leaking virtual chunks as visible pages.

## Missing Features

1. Full Mermaid / diagram syntax beyond the current graph/flowchart/sequence/state
   fallback surface and Mermaid-frontmatter-aware source-derived
   graph/sequence/state/class/ER/journey/Gantt/Git graph/timeline/mind
   map/pie summaries.
2. Broader directive semantics beyond current callouts and restricted component directives.
3. Broader MDX/component markdown beyond the restricted `Metric`, `Badge`,
   `Image`, `Video`, `Diagram`, `Callout`, `Accordion`, and `Tabs` / `Tab`
   subset.
4. Footnote polish beyond current labelled GFM references, labelled backrefs, bidirectional fragment targets, and document-wide definition resolution across virtual chunks.
5. Math / KaTeX polish beyond current inline/block rendering, stable math
   markers, labelled keyboard-scrollable block math regions, and bounded
   untrusted KaTeX settings.
6. Syntax highlighting polish beyond current `rehype-pretty-code` rendering,
   broader language alias normalization, title/caption metadata, line numbers,
   accessible line labels for numbered blocks, highlighted line/character
   styling, and diff add/remove styling.
7. Code block copy polish beyond the current full-block and selected-code copy controls.
8. Raw HTML sanitizer schema polish beyond the current safe static HTML and inline `kbd`/`q`/`ins`/`abbr`/`time`/`cite`/`dfn`/`small`/`var`/`samp`/`sub`/`sup` rendering.
9. Broader GitHub alert visual polish beyond the current labelled title/body surface with variant icons.
10. Emoji presentation/accessibility polish beyond upstream GitHub gemoji text replacement.
11. Typography presentation polish beyond upstream SmartyPants text replacement.
12. Heading visual polish beyond the current h1-h6 renderer coverage.
13. Nested list/callout/table visual polish audit.
14. Table polish parity with the old markdown viewer.
15. Table copy polish beyond current rendered-cell TSV copy and selected
    in-table text copy.
16. Broader image polish beyond the current blocked/loading/ready/failed/retry surface with associated captions, lazy loading, max-width containment, decoded aspect-ratio stabilization, and resource blocking.
17. Component-specific stable block heights for rich blocks beyond current
    top-level prose/code/table/frontmatter estimates and Mermaid source-derived
    reserved body heights.
18. Browser regression coverage beyond the current dedicated rich-demo smoke
    checks for desktop, narrow mobile, dark mode, fragment navigation, source
    highlights, link policy, footnotes, and async Mermaid/image scroll
    stability.
19. Docs page expansion for migration, threat model, performance limits, and known gaps.
20. FileViewer rollout verification beyond the current URL, Blob, inline text, and MIME-only Markdown routing tests.
21. Published Retab registry endpoint verification beyond the current local
    registry artifact import-closure test and local shadcn CLI install smoke.
22. Accessibility audit for generated block roles/labels.
23. Source-mode polish beyond the current virtualized raw Markdown toggle, source-line scrolling, anchored mode switching, labelled keyboard-focusable source region, and source-backed viewer search.
24. Broader browser-level fragment navigation coverage beyond the current route
    smoke for direct hash loads, local fragment clicks, and browser
    back/forward restoration.
25. Large-document perf/browser scroll verification.
26. Removal or deprecation plan for the old paged markdown viewer once this path is ready.

## Missing Architecture Work

27. Broader Markdown block model work beyond current top-level parser-token blocks and block-aware layout estimates: nested blocks, rich block metadata, and render inputs.
28. Complete public/private boundaries between parser, layout, virtualization, policy, and render projection modules. The first split now uses `pretext-markdown-parser`, `pretext-markdown-document-model`, `pretext-markdown-layout`, `pretext-markdown-virtualizer`, and `pretext-markdown-policy`; remaining work is to narrow each public API and add more granular architecture tests.
29. Broader stable block IDs beyond current top-level source-line IDs, including nested table rows, diagrams, callouts, footnotes, and component blocks.
30. Broader source mapping beyond current top-level block line ranges, document-character offsets, and offset lookup/intersection helpers, including nested lists, blockquotes, inline spans, and generated rich children.
31. Broader slug compatibility work beyond the current model-owned slug algorithm and DOM ID handoff, including explicit compatibility decisions against `rehype-slug`.
32. A layout contract for every block type: fixed height, Pretext-measured height, or measured-with-growth-only height.
33. Broader no-DOM-measurement policy beyond current block-aware Pretext estimates, with DOM measurement reserved for explicitly rich blocks.
34. Broader block virtualization API polish beyond current chunk/frame/window helpers, including remaining inherited source-mode line terminology where it is still accurate but visually confusing.
35. Separate terminology: `block`, `chunk`, `frame`, and `window` should replace inherited `row`/`line` names where they are no longer accurate.
36. Broader strategy for splitting very large Markdown blocks after the current hostile chunk isolation and bounded source-preview fallback, especially huge paragraphs, huge lists, and huge tables.
37. Broader policy for hostile or pathological Markdown payloads beyond the current oversized code/table/paragraph/list/HTML chunk flags and bounded source-preview fallback, including links and deeply nested structures.
38. A deterministic fallback renderer for unsupported block types.
39. A common download abstraction beyond the current shared clipboard copy
    status hook with stale-attempt protection for full source, block source,
    tables, code blocks, headings, and diagrams.
40. Cutover cleanup once old Markdown routing no longer has product callers.

## Missing Markdown Semantics

41. Nested ordered-list numbering audit beyond current ordered-list start-value preservation and nested-list style classes.
42. Browser-level tight vs loose list spacing parity beyond current multi-paragraph list item rhythm.
43. Browser-level nested blockquote styling beyond the current nested rail and contained rhythm classes.
44. Broader blockquote alert body composition polish beyond the current title/body split.
45. Broader alert variant polish beyond current `note`, `tip`, `important`, `warning`, and `caution` surfaces.
46. Browser-level thematic break visual polish beyond current native separator marker and document spacing.
47. Broader autolink literal polish beyond current stable link-form markers
    and literal monospace styling for `www.` / HTTP(S) autolinks.
48. Broader strikethrough visual polish beyond current stable marker and muted
    decoration styling.
49. Broader escaped Markdown character fidelity beyond current literal-prose
    coverage for escaped emphasis, link, heading, code, and backslash control
    punctuation.
50. Hard break vs soft break polish beyond current `remark-breaks` coverage
    and stable soft-break render markers.
51. Reference link/image polish beyond current document-wide definition resolution across virtual chunks.
52. Broader Markdown definition-list syntax polish beyond current safe raw
    HTML `dl`/`dt`/`dd` rendering and conservative `Term` plus
    `: description` shorthand support.
53. Browser-level task-list checkbox visual styling polish beyond current
    marker removal, rendered item marker, checkbox state marker, checked-state
    accent styling, and disabled/read-only accessibility semantics.
54. Broader nested and complex frontmatter metadata policy beyond current
    top-level scalar summaries, simple YAML/TOML list and inline-array
    summaries, and dotted TOML section scalar summaries.
55. Broader malformed/frontmatter source fidelity tests beyond current
    YAML/TOML chunk coverage, complex-value raw-source-only regressions, and
    model/viewer recovery for unterminated and empty frontmatter fences.
56. Broader HTML entity decoding policy beyond current entity-aware heading text and anchor IDs.
57. Broader Unicode heading slug edge cases beyond current accent normalization coverage.
58. Broader duplicate heading collision tests beyond the current rendered/model ID parity coverage.
59. Browser-level long-word wrapping and overflow verification beyond current explicit containment classes for prose, links, inline code, tables, definition lists, and component labels.
60. Inline image/chip rendering policy inside prose.

## Missing Rich Block Work

61. Full Mermaid rendering polish beyond current source-derived deterministic
    pre-layout body dimensions, fenced/component title/caption surface,
    recoverable graph/flowchart/sequence/state fallback rendering, and
    Mermaid-frontmatter-aware
    graph/sequence/state/class/ER/journey/Gantt/Git graph/timeline/mind
    map/pie summaries plus oversized-source render guard.
62. Broader Mermaid loading/error-state polish beyond current shared reserved
    scroll box for loading/error/ready states, Mermaid-only source-backed
    loading state, labelled keyboard-scrollable diagram body region, and
    failed-state source preview for parse errors and oversized-source refusal.
63. Broader Mermaid source-copy polish beyond the current full-source copy,
    copyable oversized-source fallback, and ready-state sanitized SVG copy
    controls.
64. Broader diagram security policy beyond the current strict Mermaid config,
    disabled flowchart HTML labels, bounded width behavior, oversized-source
    render guard, and SVG sanitization boundary denying style/link/resource
    and animation surfaces plus SVG `id` / `name` prefixing.
65. Broader code block language header polish beyond current normalized
    language, expanded common language aliases, title/caption metadata, and
    opt-in Pretty Code line-number metadata.
66. Code block line virtualization for large fences.
67. Browser-level code block horizontal scrolling verification beyond the current labelled keyboard-focusable source region and max-content code body.
68. Broader code block line wrapping policy beyond the current non-wrapping horizontal source region.
69. Broader code block copy polish beyond current copied/failed button states and selected-code copy from rendered code selections.
70. Table column sizing based on measured content rather than approximate character counts.
71. Broader table horizontal scrolling polish beyond the current keyboard-focusable overflow region with Arrow/Home/End controls.
72. Table row virtualization for very large tables.
73. Table header stickiness decision.
74. Broader table alignment polish beyond current GFM left/center/right alignment and tabular numeric styling for right-aligned cells.
75. Broader browser-level footnote reference/backref navigation polish beyond
    the current route smoke for labelled bidirectional fragment targets and
    component coverage for document-wide definitions across chunks.
76. Footnote section layout polish at the end of the continuous document.
77. Math inline rendering polish beyond current KaTeX output with stable inline
    math markers.
78. Math block rendering polish beyond current labelled keyboard-scrollable
    block math regions.
79. KaTeX CSS and sanitization policy beyond current untrusted bounded-input
    KaTeX settings.
80. Safe image sizing from source metadata before decode, beyond current decoded natural dimensions and max-width containment.
81. Broader image alt-text presentation beyond current blocked/loading/ready/failed/retry states and failed-image alt text.
82. Broader video/component placeholder policy beyond current restricted video blocked/failed states.
83. Custom component block measurement before render.
84. Broader unknown component fallback UI beyond the current inert diagnostic surface with source preview.

## Missing Interaction Work

85. Rendered/Text toggle browser and product-flow verification beyond the current component tests.
86. Source-mode selection and horizontal-scroll polish beyond the current labelled keyboard-focusable raw-line virtualizer and source-backed viewer search.
87. Browser find integration beyond the current source-backed viewer search.
88. Broader source highlight integration beyond current source-mode line highlights, rendered chunk-level highlight regions/data attributes, and rendered/source route smoke.
89. Browser-level visual scroll-to-source-line verification across variable-height blocks beyond current intra-chunk virtualizer offsets and rendered-mode component coverage.
90. Browser-level scroll anchor preservation on resize, zoom, font load, and content updates beyond current pure anchor capture/restore coverage.
91. Zoom behavior audit with continuous block layout.
92. Fit-to-width behavior decision.
93. Keyboard navigation polish beyond current links, code copy buttons, footnotes, and restricted `Tabs` Arrow/Home/End controls.
94. Selection/copy behavior across virtualized blocks.
95. Native browser find behavior with virtualized offscreen content beyond the current source-backed viewer search.
96. Copy all Markdown polish beyond the current raw-source toolbar action with
    shared copied/failed status handling and stale-attempt protection.
97. Download error-state UI polish beyond the current inline generated
    Markdown payload failure status and inline, URL, and Blob source download
    regressions.
98. Broader hash fragment navigation coverage beyond the current component
    tests and route smoke for initial hash loads, local clicks, and
    back/forward restoration.
99. Broader browser-level back/forward navigation coverage beyond the current
    route smoke around local heading fragments.
100.  Preserve scroll position when toggling feature flags or switching viewer implementations beyond the current Rendered/Text source-line anchor.

## Missing Accessibility Work

101. Heading semantics for all heading levels.
102. Proper list semantics for nested lists, not only `role="listitem"` rows.
103. Browser/screen-reader verification for task-list checkbox semantics beyond
     current disabled/read-only DOM contract and checked/unchecked state marker.
104. Broader table accessibility beyond the current deterministic header/cell associations and row/column count/index annotations for rendered rows.
105. Broader code block accessibility beyond current labelled code block/source
     regions, keyboard-focusable horizontal source region, and accessible
     line labels for numbered code blocks.
106. Broader diagram accessibility beyond current labelled Mermaid
     group/image/body/source fallback, keyboard-scrollable body region, and
     Mermaid-frontmatter-aware source-derived
     graph/sequence/state/class/ER/journey/Gantt/Git graph/timeline/mind
     map/pie summaries.
107. Broader footnote accessibility beyond current labelled refs/backrefs,
     labelled collected footnotes section, document-wide definition resolution,
     and route-level ref/backref smoke.
108. Broader callout accessibility beyond current labelled `note` regions for GitHub alerts and directive callouts, including screen-reader verification of separated alert titles and bodies.
109. Broader browser-level link target/rel verification beyond the current
     route smoke for Markdown links, autolinks, and raw-HTML links.
110. Color contrast audit for prose, tables, code, alerts, and diagrams.
111. Screen reader behavior for virtualized offscreen content.
112. Broader reduced-motion handling for render transitions beyond the current automatic scroll behavior.

## Missing Performance Work

113. Pretext preparation cache keyed by text, font, and block style.
114. Avoid reparsing the whole document on unrelated viewer state changes.
115. Avoid relayout of unchanged blocks when width/scale permits partial reuse.
116. Large Markdown benchmark fixture.
117. Large table benchmark fixture.
118. Large code fence benchmark fixture.
119. Long continuous scroll browser benchmark.
120. Memory ceiling tests for row/block caches.
121. Overscan tuning for dense prose vs rich blocks.
122. Font-load relayout profiling.
123. Resize profiling.
124. Mobile viewport profiling.
125. Main-thread blocking audit for parse/layout/render.

## Missing Tests

126. Broader unit tests for the forked Markdown parser beyond current adapter normalization and malformed Markdown recovery fixtures.
127. Broader unit tests for the forked block layout beyond current top-level block ID and kind-specific estimate coverage.
128. Broader unit tests for the forked virtualizer/windowing behavior beyond current pixel overscan, intra-chunk source-line offset, and anchor restore coverage.
129. Broader browser regression tests proving there are no visible page shells,
     page gaps, or page labels beyond the current dedicated rich-demo smoke and
     DOM/unit tests.
130. Broader fragment navigation tests in the new viewer beyond the current
     component-level coverage and route smoke.
131. Broader source-line highlight tests in the new viewer beyond current source-mode line coverage, rendered/source scroll range coverage, rendered chunk highlight data attributes, and route smoke.
132. Broader browser visual verification for continuous rendering beyond the
     current rich-demo desktop/mobile/dark smoke coverage.
133. Broader browser scroll stability tests around tables, code blocks, and
     more varied rich blocks beyond the current rich-demo measurement-settling
     check and async Mermaid/image route smoke.
134. Broader mobile screenshot verification beyond the current narrow viewport
     rich-demo smoke.
135. Broader dark mode screenshot verification beyond the current dark
     rich-demo smoke.
136. Published-domain CLI registry install smoke beyond the current local Retab
     registry namespace install smoke.
137. Broader FileViewer routing tests beyond current Blob, URL, inline text, and MIME-only Markdown source coverage.
138. Fuzz tests for malformed Markdown.
139. XSS/security regression tests for links, images, raw HTML, directives, MDX-like input, and component props.
140. Tests proving old `TextViewer` behavior does not change when iterating on `PretextMarkdownViewer`.

## Missing Documentation And Migration

141. Dedicated docs page.
142. Demo fixture that stresses common Markdown: alerts, tables, code, diagrams, images, footnotes, and long prose.
143. Feature matrix comparing old `MarkdownDocumentViewer`, `TextViewer` markdown mode, and `PretextMarkdownViewer`.
144. Known unsupported syntax section.
145. Migration plan for remaining Markdown surfaces beyond `FileViewer`.
146. Removal plan for page-based markdown code.
147. Registry usage example.
148. Changelog entry.
149. Internal architecture note explaining why chunks are virtual-only and must not become visible pages.
150. Acceptance checklist for replacing the old markdown viewer.

## Missing Parser Details

151. Broader parser adapter hardening beyond the initial `pretext-markdown-parser` boundary and current malformed/reference-definition fixture coverage: adapter snapshots, swap-readiness, and larger fixture sets.
152. A documented decision on whether to keep `marked` or move to a unified/mdast parser before the Pretext layout stage.
153. Broader parser error recovery tests for unterminated code fences beyond the current adapter fixture.
154. Broader parser error recovery tests for malformed tables beyond the current paragraph fallback fixture.
155. Broader parser error recovery tests for malformed HTML beyond the current inert token fixture.
156. Broader parser error recovery tests for malformed links and images beyond the current malformed-link fixture.
157. Broader parser error recovery tests for malformed frontmatter beyond the
     current unterminated-frontmatter and empty-fence model/viewer fixtures.
158. Block source extraction for every parsed block, not only line ranges.
159. Byte offset mapping beyond current document-character offsets and offset lookup/intersection helpers for blocks, chunks, headings, and frontmatter.
160. Inline source span mapping for links, emphasis, code spans, footnote refs, and task markers.
161. Broader comment preservation polish beyond current source-model retention and zero-height rendered output.
162. Preservation policy for blank-line runs in rendered layout.
163. CommonMark compliance target.
164. GFM compliance target.
165. Test fixture set copied from a known Markdown spec corpus.
166. Golden block-model snapshots for representative documents.
167. Stable serialization for debug snapshots.
168. Parser performance budget.
169. Parser recursion/nesting limit.
170. Parser timeout or bailout policy for adversarial inputs.

## Missing Inline Rendering Work

171. Baseline alignment for inline code chips.
172. Baseline alignment for emoji.
173. Baseline alignment for inline images/chips.
174. Mixed bold/italic/strike/link/code fragment measurement.
175. Adjacent inline marks with no whitespace between them.
176. Punctuation spacing around inline code.
177. Punctuation spacing around links.
178. Collapsible whitespace rules across inline fragments.
179. Hard line break rendering inside rich inline flow beyond current soft-break
     marker coverage.
180. Broader soft line break rendering policy beyond current `remark-breaks`
     behavior and stable soft-break render markers.
181. Broader inline HTML fallback styling beyond the current styled safe inline
     tags, semantic raw HTML inline tags, and raw-inline fallback markers.
182. Broader inline autolink styling beyond current stable link-form markers
     and literal monospace styling for `www.` / HTTP(S) autolinks.
183. Broader inline email autolink styling beyond current email link kind,
     stable link-form marker, and literal monospace styling.
184. Link title tooltip polish beyond current safe native `title` preservation.
185. Broader link visited-state polish beyond current restrained visited color policy.
186. Broader internal hash link styling beyond current fragment link kind and dotted underline treatment.
187. External link icon polish beyond the current aria-hidden external-link cue.
188. Bidirectional text behavior in rich inline flow.
189. Mixed CJK/Latin wrapping audit.
190. RTL paragraph behavior.
191. Combining mark and grapheme cluster tests.
192. Zero-width joiner emoji tests.
193. Soft hyphen behavior.
194. Non-breaking space behavior.
195. Inline measurement parity checks against browser rendering.

## Missing Block Rendering Work

196. Paragraph top/bottom rhythm tuning.
197. Heading rhythm tuning.
198. Heading anchor affordance polish beyond the current hover/focus copy-link button.
199. Heading copy-link polish beyond the current stable full-URL clipboard action.
200. Broader heading hover/focus states beyond the current copy-link affordance.
201. Browser-level multi-paragraph list item rendering beyond current semantic structure and tightened paragraph rhythm.
202. List item continuation indentation polish beyond current paragraph margin reset.
203. Nested list vertical rhythm polish beyond current nested-list spacing and marker style classes.
204. Blockquote nested content indentation polish beyond current nested blockquote/list rhythm classes.
205. Browser-level blockquote plus list nesting beyond current semantic nested-list rendering.
206. Blockquote plus table nesting.
207. Blockquote plus code nesting.
208. Broader code fence language alias policy beyond current lowercasing and
     common aliases for TypeScript, JavaScript, shell/terminal sessions, JSONC,
     YAML, Markdown, diff/patches, Dockerfile, Ruby, Python, and Mermaid
     fences.
209. Code fence title/meta parsing decision.
210. Broader code fence diff highlighting polish beyond current `diff` fence add/remove line styling.
211. Broader code fence line-number polish beyond current opt-in Pretty Code
     `showLineNumbers` / `showLineNumbers{n}` support with accessible
     line-number labels.
212. Broader code fence highlighted-line polish beyond current Pretty Code line and character highlight metadata support.
213. Broader table caption support beyond current safe raw HTML `<caption>` rendering.
214. Broader table cell inline Markdown parity beyond the current emphasis, code, strike, link, shortcode, and TSV copy coverage.
215. Table cell wrapping measurement using Pretext per cell.
216. Table row height cache.
217. Browser-level table keyboard scroll behavior beyond current focusable horizontal scroll region with Arrow/Home/End controls.
218. Table copy selected row/cell polish beyond current selected in-table text
     copy fallback.
219. Broader image caption polish beyond current title captions associated through `aria-describedby`.
220. Browser-level image max-width behavior in narrow containers beyond current max-width containment classes.
221. Image aspect ratio reservation from source metadata before decode beyond current decoded natural-size stabilization.
222. Broader lazy image loading policy beyond current native `loading="lazy"` use.
223. Broader broken image alt-text display beyond current failed placeholder with alt-labelled retry state.
224. Broader SVG image security policy beyond current SVG/SVGZ URL resource blocking and raw SVG DOM removal.
225. Broader data/blob URI image policy beyond current data/blob resource blocking.

## Remaining Component Markdown Work

226. Broader component registry work beyond the current restricted `Metric`/`Badge` registry.
227. Broader component prop schema work beyond current string, display-number, boolean, and `Badge.tone` enum validation.
228. Broader literal prop parsing beyond current quoted strings, bare booleans, `{true}` / `{false}`, and numeric literals.
229. Broader boolean prop parsing beyond current whitelisted `Video` media flags and directive boolean-string normalization.
230. Broader numeric prop parsing beyond current safe display-number support for `Metric.value`.
231. Broader enum prop validation beyond the current component-owned enum checks.
232. Unknown prop rejection diagnostics beyond current schema-owned rejection and inert diagnostic fallback.
233. Broader event handler prop rejection coverage beyond current component markdown/directive tests.
234. Broader expression prop rejection coverage beyond current inert `mdx` fallback tests for non-literal expressions and spreads.
235. Broader import/export rejection diagnostics beyond the current inert prose/source rendering.
236. Broader remote component rejection diagnostics beyond current inert namespaced component fallback.
237. Broader component child Markdown parsing beyond current safe paired `Callout`/`Accordion` blocks and directive-based `Tabs` / `Tab` blocks.
238. Component child source mapping.
239. Broader component fallback heights beyond the current JSX-like diagnostic
     fallback pre-layout estimate.
240. Component measured growth policy.
241. Component error boundaries.
242. Broader component accessibility contract beyond current labelled components and restricted `Tabs` roles, roving focus, Arrow key navigation, and Home/End navigation.
243. Component copy/source fallback.
244. Component virtualization lifecycle.
245. Component hydration behavior.
246. Component registry docs.
247. Initial components beyond the current restricted `Callout`.
248. Initial components beyond the current restricted `Metric`.
249. Initial components beyond the current restricted `Badge`.
250. Initial components beyond the current restricted `Tabs` / `Tab`.
251. Initial components beyond the current restricted `Accordion`.
252. Initial components beyond the current restricted `Image`.
253. Initial components beyond the current restricted `Video`.
254. Initial components beyond the current restricted `Diagram` with
     title/caption metadata.
255. Unknown component visual design beyond the current inert diagnostic source-preview surface.

## Missing Security Work

256. Threat model document for Markdown rendering.
257. Broader URL sanitizer fuzz tests beyond the current supported-protocol,
     control-character, encoded-scheme, Unicode delimiter-confusable,
     backslash-normalization, SVG resource, data/blob resource, and
     image-policy unit matrix.
258. Broader Unicode URL confusable policy beyond the current delimiter
     confusable rejection for colon, slash, and backslash-like characters.
259. URL sanitizer parity decision between Pretext Markdown Viewer and Markdown Document Viewer.
260. Broader image URL extension/type policy beyond current SVG/SVGZ resource blocking.
261. Link `target`/`rel` same-origin routing policy review beyond the current
     invariant tests and route smoke.
262. Raw HTML whitelist review beyond the current safe static HTML policy and
     explicitly constrained semantic inline raw HTML tags.
263. Broader active raw HTML denylist coverage beyond the current iframe/object/embed/form/input/button/style/link/meta tests.
264. Broader SVG sanitization coverage beyond the current SVG script/style,
     link/resource, animation, and attribute-denylist mounting tests.
265. CSS injection policy.
266. Broader DOM clobbering fuzz tests beyond the current raw HTML `id`/`name`
     prefix regression, raw internal `data-pretext-*` metadata stripping
     including component fallback metadata, heading reserved-name tests, and
     Mermaid SVG `id` / `name` prefix regression.
267. Heading ID collision safety review beyond the current duplicate, reserved-name, and exported-slug tests.
268. Component prop injection tests.
269. Clipboard content sanitization policy.
270. Broader Mermaid security verification beyond the current strict
     initialization invariant, oversized-source guard, and sanitized SVG
     mounting coverage.
271. Broader KaTeX security fuzzing beyond the current untrusted-input,
     bounded-expansion, bounded-size, unsafe-command regression coverage, and
     labelled bounded block-math rendering surface.
272. Fuzz tests with random HTML/Markdown mixes.
273. Security review checklist before FileViewer rollout.
274. Dependency audit for parser/render libraries.
275. CSP compatibility audit.

## Missing Styling And Theming

276. Light theme visual pass.
277. Dark theme visual pass.
278. High contrast theme pass.
279. Compact density option decision.
280. Wide document max-width decision.
281. Narrow mobile width behavior.
282. Typography scale alignment with the rest of Retab UI.
283. Code font alignment with existing code viewer.
284. Table styling alignment with data/table primitives.
285. Callout color semantics.
286. Diagram surface styling.
287. Component block styling.
288. Focus ring consistency.
289. Selection color consistency.
290. Print stylesheet decision.
291. Avoid card-inside-card visual artifacts.
292. Avoid page-like borders or document-paper affordances.
293. Broader empty/loading/error visual state polish beyond the current rendered-mode empty Markdown state.
294. Loading skeleton for first render.
295. Error fallback visual state.

## Missing Mobile And Responsive Work

296. Mobile toolbar layout.
297. Mobile horizontal table scrolling.
298. Mobile code block scrolling verification beyond the current keyboard-focusable horizontal source region.
299. Mobile heading rhythm.
300. Mobile list indentation.
301. Mobile blockquote indentation.
302. Mobile callout layout.
303. Touch target audit for copy buttons and links.
304. iOS momentum scroll behavior.
305. Android Chrome scroll behavior.
306. Pinch zoom interaction decision.
307. Device pixel ratio behavior for diagrams/canvas/SVG.
308. Orientation change scroll-anchor preservation.
309. Very narrow viewport long-word browser verification beyond current explicit containment classes.
310. Responsive max content width.

## Missing Integration Work

311. `FileViewer` route verification in app-level screens.
312. Full `file-viewer` shadcn CLI install smoke beyond the current Pretext Markdown registry dependency and generated artifact coverage.
313. Parse viewer integration.
314. Extract viewer integration.
315. Source linking integration.
316. Highlight from source sidebar integration.
317. Segment/source overlays decision.
318. Attachment sidebar preview behavior.
319. Thumbnail behavior decision.
320. Docs search indexing behavior.
321. App-level keyboard shortcut compatibility.
322. Download/copy analytics decision if analytics exist.
323. Error boundary integration.
324. Suspense/loading integration.
325. Server/client component boundary audit.

## Missing Developer Experience

326. Debug overlay for block frames and virtual windows.
327. Debug export of parsed block model.
328. Debug export of layout frames.
329. Debug story or profile page.
330. Fixture loader for local Markdown files.
331. Benchmark script.
332. Visual regression script.
333. Documentation for adding a new block type.
334. Documentation for adding a new inline token type.
335. Documentation for adding a new component.
336. Broader lint rule coverage beyond the current architecture test preventing old markdown viewer imports and registry dependencies.
337. Broader visual/browser verification beyond the current runtime and architecture tests preventing visible page chrome.
338. Broader private-layout architecture coverage beyond the current import guard.
339. Broader TextViewer isolation coverage beyond the current import guard.
340. Architecture test ensuring FileViewer routing remains explicit during migration.

## Missing Rollout Criteria

341. Feature parity threshold for replacing old viewer.
342. Performance threshold for replacing old viewer.
343. Accessibility threshold for replacing old viewer.
344. Security threshold for replacing old viewer.
345. Browser support threshold.
346. Mobile support threshold.
347. Visual acceptance screenshots.
348. Known limitations accepted by product.
349. Rollback plan.
350. Deprecation issue list for old viewer.
351. Cleanup issue list for old page/chunk terminology.
352. Migration PR checklist.
353. Registry release checklist.
354. Docs release checklist.
355. Internal QA checklist.

## Missing Open Questions

356. Should the new viewer support a Text tab, or should source text be handled by a separate Text Viewer action?
357. Should Markdown files route to `PretextMarkdownViewer` by default once stable?
358. Should rich plugin features be opt-in per consumer?
359. Should diagrams be rendered by Mermaid or by a small built-in graph renderer first?
360. Should MDX-like syntax be supported, or should directives be the only component syntax?
361. Should raw HTML ever render as safe static HTML, or always as inert text/code?
362. Should frontmatter be visible by default?
363. Should footnotes remain inline near references or collect at document end?
364. Should tables prioritize exact Markdown semantics or Retab data-table ergonomics?
365. Should code blocks wrap by default or scroll horizontally?
366. Should line numbers be enabled by default or remain opt-in per code block?
367. Should heading anchor links stay hover/focus-only, or become always visible?
368. Should search index virtualized offscreen content separately?
369. Should component blocks be allowed in exported/installed registry usage?
370. Should the old markdown-document tests be ported or rewritten around the new block model?
