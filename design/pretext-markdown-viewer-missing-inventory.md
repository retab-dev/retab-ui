# Pretext Markdown Viewer Missing Inventory

The new `PretextMarkdownViewer` is intentionally separate from the existing
`MarkdownDocumentViewer`. It starts from the Chenglou/Pretext continuous text
viewer path and should evolve into the replacement Markdown surface without
leaking virtual chunks as visible pages.

## Missing Features

1. Full Mermaid / diagram syntax beyond the current graph/flowchart surface.
2. Broader directive semantics beyond current callouts and restricted component directives.
3. Broader MDX/component markdown beyond the restricted `Metric` and `Badge`
   subset.
4. Footnote polish beyond current labelled GFM references, labelled backrefs, and bidirectional fragment targets.
5. Math / KaTeX polish beyond initial inline and block rendering.
6. Syntax highlighting polish beyond initial `rehype-pretty-code` rendering.
7. Code block copy polish beyond the initial copy button.
8. Raw HTML sanitizer schema polish beyond the current safe static HTML and inline `kbd`/`sub`/`sup` rendering.
9. Full GitHub alert visual styling; currently normalized into quoted prose only.
10. More complete emoji shortcode vocabulary.
11. More complete typography rules.
12. Heading visual polish beyond the current h1-h6 renderer coverage.
13. Nested list/callout/table visual polish audit.
14. Table polish parity with the old markdown viewer.
15. Table copy polish beyond current rendered-cell TSV copy.
16. Broader image polish beyond the current blocked/loading/ready/failed surface.
17. Component-specific stable block heights for rich blocks beyond current top-level prose/code/table/frontmatter estimates.
18. Browser regression coverage beyond the current docs/demo smoke check.
19. Docs page expansion for migration, threat model, performance limits, and known gaps.
20. FileViewer rollout verification beyond the current hard route for Markdown files.
21. Registry install smoke test for the new component.
22. Accessibility audit for generated block roles/labels.
23. Source-mode polish beyond the current virtualized raw Markdown toggle.
24. Fragment navigation regression tests in the new component's own suite.
25. Large-document perf/browser scroll verification.
26. Removal or deprecation plan for the old paged markdown viewer once this path is ready.

## Missing Architecture Work

27. Broader Markdown block model work beyond current top-level parser-token blocks and block-aware layout estimates: nested blocks, rich block metadata, and render inputs.
28. Complete public/private boundaries between parser, layout, virtualization, policy, and render projection modules. The first split now uses `pretext-markdown-parser`, `pretext-markdown-document-model`, `pretext-markdown-layout`, `pretext-markdown-virtualizer`, and `pretext-markdown-policy`; remaining work is to narrow each public API and add more granular architecture tests.
29. Broader stable block IDs beyond current top-level source-line IDs, including nested table rows, diagrams, callouts, footnotes, and component blocks.
30. Broader source-line mapping beyond current top-level block ranges, including nested lists, blockquotes, inline spans, and generated rich children.
31. Broader slug compatibility work beyond the current model-owned slug algorithm and DOM ID handoff, including explicit compatibility decisions against `rehype-slug`.
32. A layout contract for every block type: fixed height, Pretext-measured height, or measured-with-growth-only height.
33. Broader no-DOM-measurement policy beyond current block-aware Pretext estimates, with DOM measurement reserved for explicitly rich blocks.
34. Broader block virtualization API polish beyond current chunk/frame/window helpers, including remaining inherited source-mode line terminology where it is still accurate but visually confusing.
35. Separate terminology: `block`, `chunk`, `frame`, and `window` should replace inherited `row`/`line` names where they are no longer accurate.
36. Broader strategy for splitting very large Markdown blocks after the current hostile chunk isolation, especially huge paragraphs, huge lists, and huge tables.
37. Broader policy for hostile or pathological Markdown payloads beyond the current oversized code/table/paragraph/list/HTML chunk flags, including links and deeply nested structures.
38. A deterministic fallback renderer for unsupported block types.
39. A common copy/download abstraction for full source, block source, tables, and code blocks.
40. Cutover cleanup once old Markdown routing no longer has product callers.

## Missing Markdown Semantics

41. Nested ordered-list numbering audit beyond current ordered-list start-value preservation.
42. Tight vs loose list spacing parity.
43. Nested blockquote styling beyond a single rail.
44. Blockquote alert title/body separation, not just textual prefix normalization.
45. Alert variants for `note`, `tip`, `important`, `warning`, and `caution`.
46. Thematic break visual polish.
47. Autolink literal polish beyond initial GFM link rendering.
48. Strikethrough visual polish beyond initial renderer coverage.
49. Escaped Markdown character fidelity.
50. Hard break vs soft break polish beyond initial `remark-breaks` coverage.
51. Reference link/image polish beyond current document-wide definition resolution across virtual chunks.
52. Definition list support decision.
53. Task-list checkbox accessibility and styling polish beyond initial read-only controls.
54. Broader frontmatter metadata policy beyond current visible YAML/TOML chunks: render, hide, summarize, or expose as metadata.
55. Broader malformed/frontmatter source fidelity tests beyond current YAML/TOML chunk coverage.
56. Broader HTML entity decoding policy beyond current entity-aware heading text and anchor IDs.
57. Broader Unicode heading slug edge cases beyond current accent normalization coverage.
58. Broader duplicate heading collision tests beyond the current rendered/model ID parity coverage.
59. Long-word wrapping and overflow behavior for prose, code, tables, links, and component labels.
60. Inline image/chip rendering policy inside prose.

## Missing Rich Block Work

61. Full Mermaid rendering with deterministic pre-layout dimensions.
62. Mermaid loading/error states that do not shift layout.
63. Mermaid source copy.
64. Diagram security policy.
65. Code block language header polish.
66. Code block line virtualization for large fences.
67. Code block horizontal scrolling behavior.
68. Code block line wrapping policy.
69. Broader code block copy polish beyond current copied/failed button states, including selected-line copy if line numbers are added.
70. Table column sizing based on measured content rather than approximate character counts.
71. Broader table horizontal scrolling polish beyond the current keyboard-focusable overflow region.
72. Table row virtualization for very large tables.
73. Table header stickiness decision.
74. Broader table alignment polish beyond current GFM left/center/right alignment and tabular numeric styling for right-aligned cells.
75. Browser-level footnote reference/backref navigation polish beyond current labelled bidirectional fragment targets.
76. Footnote section layout polish at the end of the continuous document.
77. Math inline rendering polish.
78. Math block rendering polish.
79. KaTeX CSS and sanitization policy.
80. Safe image sizing from source metadata before decode, not only decoded natural dimensions.
81. Broader image alt-text presentation beyond current blocked/loading/ready/failed/retry states.
82. Video/component placeholder policy.
83. Custom component block measurement before render.
84. Unknown component fallback UI.

## Missing Interaction Work

85. Rendered/Text toggle browser and product-flow verification beyond the current component tests.
86. Source-mode selection, search, and horizontal-scroll polish beyond the current raw-line virtualizer.
87. Search/find integration.
88. Source highlight integration with continuous blocks.
89. Browser-level visual scroll-to-source-line verification across variable-height blocks beyond current intra-chunk virtualizer offsets and rendered-mode component coverage.
90. Browser-level scroll anchor preservation on resize, zoom, font load, and content updates beyond current pure anchor capture/restore coverage.
91. Zoom behavior audit with continuous block layout.
92. Fit-to-width behavior decision.
93. Keyboard navigation through links, code copy buttons, footnotes, and component controls.
94. Selection/copy behavior across virtualized blocks.
95. Browser find behavior with virtualized content.
96. Copy all Markdown polish beyond the current raw-source toolbar action.
97. Download error-state UI polish beyond the current inline, URL, and Blob
    source download regressions.
98. Broader hash fragment navigation coverage beyond the current page-load test.
99. Broader back/forward navigation coverage beyond the current hash-change test.
100.  Preserve scroll position when toggling feature flags or switching viewer implementations.

## Missing Accessibility Work

101. Heading semantics for all heading levels.
102. Proper list semantics for nested lists, not only `role="listitem"` rows.
103. Accessible task-list checkbox semantics.
104. Broader table accessibility beyond the current deterministic header/cell associations for rendered rows.
105. Broader code block accessibility beyond current labelled code block/source regions, including line-level navigation if line numbers are added.
106. Broader diagram accessibility beyond current labelled Mermaid group/image/source fallback, including richer descriptions for full Mermaid output.
107. Broader footnote accessibility beyond current labelled refs/backrefs and labelled collected footnotes section.
108. Broader callout accessibility beyond current labelled `note` regions for GitHub alerts and directive callouts.
109. Link target/rel policy tests.
110. Color contrast audit for prose, tables, code, alerts, and diagrams.
111. Screen reader behavior for virtualized offscreen content.
112. Reduced-motion handling for scroll and render transitions.

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
129. Browser regression tests proving there are no visible page shells, page gaps, or page labels beyond the current DOM/unit test.
130. Fragment navigation tests in the new viewer.
131. Broader source-line highlight tests in the new viewer beyond current rendered/source scroll range coverage.
132. Browser visual verification for continuous rendering.
133. Browser scroll stability tests around diagrams, images, tables, and code blocks.
134. Mobile screenshot verification.
135. Dark mode screenshot verification.
136. Registry artifact import smoke test.
137. Broader FileViewer routing tests for Blob, URL, inline text, and MIME-only Markdown sources.
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
157. Broader parser error recovery tests for malformed frontmatter beyond the current unterminated-frontmatter fixture.
158. Block source extraction for every parsed block, not only line ranges.
159. Byte offset or character offset mapping in addition to line mapping.
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
179. Hard line break rendering inside rich inline flow.
180. Soft line break rendering policy.
181. Inline HTML fallback styling.
182. Inline autolink styling.
183. Inline email autolink styling.
184. Link title tooltip polish beyond current safe native `title` preservation.
185. Link visited-state policy.
186. Internal hash link styling.
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
201. Multi-paragraph list item rendering.
202. List item continuation indentation.
203. Nested list vertical rhythm.
204. Blockquote nested content indentation.
205. Blockquote plus list nesting.
206. Blockquote plus table nesting.
207. Blockquote plus code nesting.
208. Code fence language normalization.
209. Code fence title/meta parsing decision.
210. Code fence diff highlighting decision.
211. Code fence line number decision.
212. Code fence highlighted-line syntax decision.
213. Broader table caption support beyond current safe raw HTML `<caption>` rendering.
214. Broader table cell inline Markdown parity beyond the current emphasis, code, strike, link, shortcode, and TSV copy coverage.
215. Table cell wrapping measurement using Pretext per cell.
216. Table row height cache.
217. Broader table keyboard scroll behavior beyond current focusable horizontal scroll region.
218. Table copy selected row/cell decision.
219. Image caption support.
220. Image max-width behavior in narrow containers.
221. Image aspect ratio reservation.
222. Lazy image loading policy.
223. Broken image alt-text display.
224. SVG image security policy.
225. Data URI image policy.

## Remaining Component Markdown Work

226. Broader component registry work beyond the current restricted `Metric`/`Badge` registry.
227. Broader component prop schema work beyond current string props and `Badge.tone` enum validation.
228. Literal prop parsing beyond quoted strings.
229. Boolean prop parsing.
230. Numeric prop parsing.
231. Broader enum prop validation beyond the current component-owned enum checks.
232. Unknown prop rejection diagnostics beyond current schema-owned rejection and inert fallback.
233. Broader event handler prop rejection coverage beyond current component markdown/directive tests.
234. Broader expression prop rejection coverage beyond current inert `mdx` fallback tests.
235. Import/export rejection.
236. Remote component rejection.
237. Component child markdown parsing.
238. Component child source mapping.
239. Component fallback heights.
240. Component measured growth policy.
241. Component error boundaries.
242. Component accessibility contract.
243. Component copy/source fallback.
244. Component virtualization lifecycle.
245. Component hydration behavior.
246. Component registry docs.
247. Initial components: `Callout`.
248. Initial components beyond the current restricted `Metric`.
249. Initial components beyond the current restricted `Badge`.
250. Initial components: `Tabs`.
251. Initial components: `Accordion`.
252. Initial components: `Image`.
253. Initial components: `Video`.
254. Initial components: `Diagram`.
255. Unknown component visual design.

## Missing Security Work

256. Threat model document for Markdown rendering.
257. Broader URL sanitizer fuzz tests beyond the current supported-protocol, control-character, encoded-scheme, and image-policy unit matrix.
258. Unicode URL confusable policy decision.
259. URL sanitizer parity decision between Pretext Markdown Viewer and Markdown Document Viewer.
260. Image URL extension/type policy decision.
261. Link `target`/`rel` same-origin routing policy review beyond the current invariant tests.
262. Raw HTML whitelist review beyond the current safe static HTML policy.
263. Broader active raw HTML denylist coverage beyond the current iframe/object/embed/form/input/button/style/link/meta tests.
264. Broader SVG sanitization coverage beyond the current SVG script/style mounting tests.
265. CSS injection policy.
266. Broader DOM clobbering tests for non-heading IDs and names.
267. Heading ID collision safety review beyond the current duplicate, reserved-name, and exported-slug tests.
268. Component prop injection tests.
269. Clipboard content sanitization policy.
270. Mermaid security-level verification if Mermaid is added.
271. KaTeX trust/sanitize configuration if math is added.
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
293. Empty document visual state.
294. Loading skeleton for first render.
295. Error fallback visual state.

## Missing Mobile And Responsive Work

296. Mobile toolbar layout.
297. Mobile horizontal table scrolling.
298. Mobile code block scrolling.
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
309. Very narrow viewport long-word handling.
310. Responsive max content width.

## Missing Integration Work

311. `FileViewer` route verification in app-level screens.
312. `file-viewer` registry install smoke test with the Pretext Markdown dependency.
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
366. Should line numbers be supported in code blocks?
367. Should heading anchor links stay hover/focus-only, or become always visible?
368. Should search index virtualized offscreen content separately?
369. Should component blocks be allowed in exported/installed registry usage?
370. Should the old markdown-document tests be ported or rewritten around the new block model?
