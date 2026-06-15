# Viewer System Cleanliness Completion Blueprint

This blueprint is superseded by
[`viewer-system-shadcn-platonic-blueprint.md`](./viewer-system-shadcn-platonic-blueprint.md).

The current cleanliness standard is smaller:

```txt
Viewer anatomy is public.
Provider machinery is private.
FileViewer state hooks are not public.
Named part state hooks are private or explicitly internal.
Only real external coordination seams get public hooks.
```
