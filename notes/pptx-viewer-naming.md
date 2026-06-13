# PPTX Viewer Naming Note

The PPTX viewer is close, but its vocabulary is not yet perfect. The main naming
pressure is that `source`, `resource`, `content`, `renderer`, and `viewer` are
all true words in the system, but they sit too close together.

## Current Vocabulary

- `PptxViewer`: public component that accepts a `source`.
- `PptxResourceViewer`: component that accepts a normalized `ViewerResource`.
- `ViewerResource`: shared viewer object with descriptor, keys, content readers,
  and original download action.
- `ViewerResourceContent`: byte/text/blob/range reader surface for the file.
- `PptxSource`: loaded PPTX presentation object used by the UI to render slides.
- `PptxRenderer`: thin adapter around `pptxviewjs.PPTXViewer`.
- `RendererSource`: cached/retained source implementation that owns the renderer,
  render queue, and bitmap cache.

## Naming Problem

`PptxSource` sounds like the original input, but it is actually the loaded,
renderable deck. `RendererSource` sounds like a source for a renderer, but it is
the source backed by a renderer. `ViewerResourceContent` is precise in the shared
system, but in the PPTX path it is mostly a byte provider.

This makes the code readable locally but slightly blurry globally.

## Better Target Vocabulary

- Original user input: `PptxDocumentSource`.
- Shared normalized file object: `ViewerResource`.
- Byte provider from a resource: `ViewerResourceContent`.
- Loaded PPTX deck: `PptxDeck`.
- Adapter around `pptxviewjs`: `PptxRenderer`.
- Cached retained deck implementation: `CachedPptxDeck`.
- Render queue: `slideRenderQueue`.
- Per-source bitmap cache: `slideBitmapCache`.
- Load timing: `PptxDeckLoadTiming`.
- Slide timing: `PptxSlideRenderTiming`.

## Candidate Renames

- `PptxSource` -> `PptxDeck`
- `RendererSource` -> `CachedPptxDeck`
- `getPptxSource` -> `getPptxDeck`
- `evictPptxSource` -> `evictPptxDeck`
- `disposePptxSourceCache` -> `disposePptxDeckCache`
- `subscribePptxSourceLoadTiming` -> `subscribePptxDeckLoadTiming`
- `PptxSourceLoadTiming` -> `PptxDeckLoadTiming`
- `sourceCache` -> `deckCache`
- `sourceLoadTimingCache` -> `deckLoadTimingCache`
- `bitmaps` -> `slideBitmapCache`
- `queue` -> `slideRenderQueue`

## Boundary Rule

Use `source` only for caller-provided input. Use `resource` only for the shared
viewer abstraction. Use `deck` only for a loaded, inspectable, renderable PPTX.
Use `renderer` only for the `pptxviewjs` adapter that can paint one slide into a
canvas.

That rule makes the data flow sharper:

```text
PptxDocumentSource -> ViewerResource -> ViewerResourceContent -> PptxDeck -> PptxRenderer -> canvas
```

## Cutover Note

This should be a hard rename if done. No compatibility aliases. Update all call
sites, tests, diagrams, and docs in one pass so the vocabulary becomes singular
instead of adding a second language on top of the first.
