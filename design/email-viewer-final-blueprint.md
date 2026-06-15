# Email Viewer Final Blueprint

This blueprint is superseded by
[`viewer-system-remaining-platonic-gaps-blueprint.md`](./viewer-system-remaining-platonic-gaps-blueprint.md)
and
[`viewer-system-platonic-reading-blueprint.md`](./viewer-system-platonic-reading-blueprint.md).

The current email viewer rule is:

```txt
EmailViewer
EmailViewerProvider
EmailViewerHeader
EmailViewerContent
EmailViewerPartsSidebar
```

Email first-party part hooks are private implementation details. The old public
frame export is removed from the final API.
