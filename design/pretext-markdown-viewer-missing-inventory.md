# Pretext Markdown Viewer Missing Inventory

The new `PretextMarkdownViewer` is intentionally separate from the existing
`MarkdownDocumentViewer`. It starts from the Chenglou/Pretext continuous text
viewer path and should evolve into the replacement Markdown surface without
leaking virtual chunks as visible pages.

## Missing Features

1. Mermaid / diagram blocks.
2. Directive callouts: `:::note`, `:::tip`, `:::warning`, etc.
3. MDX/component markdown: `Metric`, `Badge`, `Tabs`, etc.
4. Footnotes.
5. Math / KaTeX.
6. Syntax highlighting for fenced code.
7. Copy button for code blocks.
8. Raw HTML policy polish beyond the current inert text/code fallback.
9. Full GitHub alert visual styling; currently normalized into quoted prose only.
10. More complete emoji shortcode vocabulary.
11. More complete typography rules.
12. Heading levels beyond the current h1/h2-style variants.
13. Nested list/callout/table visual polish audit.
14. Table polish parity with the old markdown viewer.
15. Table copy coverage in the new component's own tests.
16. Image loading/error polish parity.
17. Component-specific stable block heights for rich blocks.
18. Browser verification page/demo for the new component.
19. Docs page for `pretext-markdown-viewer`.
20. FileViewer routing experiment or flag to try it on Markdown files.
21. Registry install smoke test for the new component.
22. Accessibility audit for generated block roles/labels.
23. Source-faithful Text-mode equivalent, if this component needs a rendered/text toggle.
24. Fragment navigation regression tests in the new component's own suite.
25. Large-document perf/browser scroll verification.
26. Removal or deprecation plan for the old paged markdown viewer once this path is ready.

## Missing Architecture Work

27. A first-class Markdown block model owned by `PretextMarkdownViewer`, rather than a copied and lightly edited Text Viewer model.
28. Explicit public/private boundaries between parser, layout, virtualization, and render projection modules.
29. Stable block IDs for headings, tables, diagrams, callouts, footnotes, and component blocks.
30. Stable source-line mapping for every block type, including multi-line tables, nested lists, blockquotes, and fenced blocks.
31. A single slug algorithm shared by block model, DOM IDs, and fragment navigation.
32. A layout contract for every block type: fixed height, Pretext-measured height, or measured-with-growth-only height.
33. A no-DOM-measurement policy for prose-like blocks, with DOM measurement reserved for explicitly rich blocks.
34. A block virtualization API that no longer uses generic row naming from the Text Viewer.
35. Separate terminology: `block`, `chunk`, `frame`, and `window` should replace inherited `row`/`line` names where they are no longer accurate.
36. A documented strategy for splitting very large Markdown blocks, especially huge paragraphs, huge lists, and huge tables.
37. A policy for hostile or pathological Markdown payloads, including oversized code fences, tables, HTML, links, and deeply nested structures.
38. A deterministic fallback renderer for unsupported block types.
39. A common copy/download abstraction for full source, block source, tables, and code blocks.
40. A feature flag or internal switch that lets `FileViewer` choose between old and new Markdown viewers during migration.

## Missing Markdown Semantics

41. Ordered list start values and nested ordered-list numbering audit.
42. Tight vs loose list spacing parity.
43. Nested blockquote styling beyond a single rail.
44. Blockquote alert title/body separation, not just textual prefix normalization.
45. Alert variants for `note`, `tip`, `important`, `warning`, and `caution`.
46. Thematic break visual polish.
47. Autolink literal support parity with GFM.
48. Strikethrough visual parity and tests.
49. Escaped Markdown character fidelity.
50. Hard break vs soft break behavior audit.
51. Reference links and reference images.
52. Definition list support decision.
53. Task-list checkbox accessibility and styling polish.
54. Frontmatter policy: render, hide, summarize, or expose as metadata.
55. Frontmatter source fidelity tests.
56. HTML entity decoding policy.
57. Unicode heading slug edge cases.
58. Duplicate heading collision tests.
59. Long-word wrapping and overflow behavior for prose, code, tables, links, and component labels.
60. Inline image/chip rendering policy inside prose.

## Missing Rich Block Work

61. Mermaid rendering with deterministic pre-layout dimensions.
62. Mermaid loading/error states that do not shift layout.
63. Mermaid source copy.
64. Diagram security policy.
65. Code block language headers.
66. Code block line virtualization for large fences.
67. Code block horizontal scrolling behavior.
68. Code block line wrapping policy.
69. Code block copy success/error state.
70. Table column sizing based on measured content rather than approximate character counts.
71. Table horizontal scrolling for wide tables.
72. Table row virtualization for very large tables.
73. Table header stickiness decision.
74. Table alignment and numeric tabular styling.
75. Footnote reference/backref navigation.
76. Footnote section layout at the end of the continuous document.
77. Math inline rendering.
78. Math block rendering.
79. KaTeX CSS and sanitization policy.
80. Safe image sizing from known dimensions where possible.
81. Image loading, error, retry, and alt-text states.
82. Video/component placeholder policy.
83. Custom component block measurement before render.
84. Unknown component fallback UI.

## Missing Interaction Work

85. Rendered/Text toggle decision for the new component.
86. Source-faithful text mode if a toggle exists.
87. Search/find integration.
88. Source highlight integration with continuous blocks.
89. Scroll-to-source-line accuracy across variable-height blocks.
90. Scroll anchor preservation on resize, zoom, font load, and content updates.
91. Zoom behavior audit with continuous block layout.
92. Fit-to-width behavior decision.
93. Keyboard navigation through links, code copy buttons, footnotes, and component controls.
94. Selection/copy behavior across virtualized blocks.
95. Browser find behavior with virtualized content.
96. Copy all Markdown action in the new toolbar.
97. Download action parity.
98. Hash fragment navigation after page load.
99. Back/forward navigation with hash changes.
100. Preserve scroll position when toggling feature flags or switching viewer implementations.

## Missing Accessibility Work

101. Heading semantics for all heading levels.
102. Proper list semantics for nested lists, not only `role="listitem"` rows.
103. Accessible task-list checkbox semantics.
104. Table header/cell associations for all rendered and virtualized rows.
105. Code block accessible labels.
106. Diagram accessible labels and source fallback.
107. Footnote accessible labels and backrefs.
108. Callout roles and labels.
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

126. Unit tests for the forked Markdown parser.
127. Unit tests for the forked block layout.
128. Unit tests for the forked virtualizer/windowing behavior.
129. Regression tests proving there are no visible page shells, page gaps, or page labels.
130. Fragment navigation tests in the new viewer.
131. Source-line highlight tests in the new viewer.
132. Browser visual verification for continuous rendering.
133. Browser scroll stability tests around diagrams, images, tables, and code blocks.
134. Mobile screenshot verification.
135. Dark mode screenshot verification.
136. Registry artifact import smoke test.
137. FileViewer routing tests for the experimental switch.
138. Fuzz tests for malformed Markdown.
139. XSS/security regression tests for links, images, raw HTML, directives, MDX-like input, and component props.
140. Tests proving old `TextViewer` behavior does not change when iterating on `PretextMarkdownViewer`.

## Missing Documentation And Migration

141. Dedicated docs page.
142. Demo fixture that stresses common Markdown: alerts, tables, code, diagrams, images, footnotes, and long prose.
143. Feature matrix comparing old `MarkdownDocumentViewer`, `TextViewer` markdown mode, and `PretextMarkdownViewer`.
144. Known unsupported syntax section.
145. Migration plan for `FileViewer`.
146. Removal plan for page-based markdown code.
147. Registry usage example.
148. Changelog entry.
149. Internal architecture note explaining why chunks are virtual-only and must not become visible pages.
150. Acceptance checklist for replacing the old markdown viewer.

## Missing Parser Details

151. A parser adapter interface so the viewer is not hard-coupled to `marked`.
152. A documented decision on whether to keep `marked` or move to a unified/mdast parser before the Pretext layout stage.
153. Parser error recovery tests for unterminated code fences.
154. Parser error recovery tests for malformed tables.
155. Parser error recovery tests for malformed HTML.
156. Parser error recovery tests for malformed links and images.
157. Parser error recovery tests for malformed frontmatter.
158. Block source extraction for every parsed block, not only line ranges.
159. Byte offset or character offset mapping in addition to line mapping.
160. Inline source span mapping for links, emphasis, code spans, footnote refs, and task markers.
161. Preservation policy for comments.
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
184. Link title tooltip policy.
185. Link visited-state policy.
186. Internal hash link styling.
187. External link icon policy.
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
198. Heading anchor affordance decision.
199. Heading copy-link interaction.
200. Heading hover/focus states.
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
213. Table caption support decision.
214. Table cell inline markdown parity.
215. Table cell wrapping measurement using Pretext per cell.
216. Table row height cache.
217. Table keyboard scroll behavior.
218. Table copy selected row/cell decision.
219. Image caption support.
220. Image max-width behavior in narrow containers.
221. Image aspect ratio reservation.
222. Lazy image loading policy.
223. Broken image alt-text display.
224. SVG image security policy.
225. Data URI image policy.

## Missing Component Markdown Work

226. A component registry type.
227. A component prop schema type.
228. Literal prop parsing.
229. Boolean prop parsing.
230. Numeric prop parsing.
231. Enum prop validation.
232. Unknown prop rejection.
233. Event handler prop rejection.
234. Expression prop rejection.
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
248. Initial components: `Metric`.
249. Initial components: `Badge`.
250. Initial components: `Tabs`.
251. Initial components: `Accordion`.
252. Initial components: `Image`.
253. Initial components: `Video`.
254. Initial components: `Diagram`.
255. Unknown component visual design.

## Missing Security Work

256. Threat model document for Markdown rendering.
257. URL sanitizer unit tests for all supported protocols.
258. URL sanitizer unit tests for unicode/control-character tricks.
259. URL sanitizer unit tests for encoded `javascript:` variants.
260. Image URL sanitizer tests.
261. Link `target`/`rel` invariant tests.
262. Raw HTML never becomes live DOM unless explicitly whitelisted.
263. Raw HTML active element denylist tests.
264. SVG script/style denylist tests.
265. CSS injection policy.
266. DOM clobbering tests for IDs and names.
267. Heading ID collision safety tests.
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

311. `FileViewer` experimental routing.
312. `file-viewer` registry dependency update if routing changes.
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
336. Lint rule or architecture test preventing imports from the old markdown viewer.
337. Architecture test preventing visible page chrome in the new viewer.
338. Architecture test ensuring PretextMarkdownViewer uses its private layout module.
339. Architecture test ensuring TextViewer does not import the Pretext Markdown fork.
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
367. Should heading anchor links be always visible, hover-only, or absent?
368. Should search index virtualized offscreen content separately?
369. Should component blocks be allowed in exported/installed registry usage?
370. Should the old markdown-document tests be ported or rewritten around the new block model?
