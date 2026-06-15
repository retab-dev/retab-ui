# Viewer System Final Perfection Gap Blueprint

This blueprint is superseded by
[`viewer-system-shadcn-platonic-blueprint.md`](./viewer-system-shadcn-platonic-blueprint.md).

The old version treated named part hooks as a broadly public API. The current
standard does not.

```txt
components are public
public hooks are rare
internal selectors are private or explicitly internal
state bags are not the user-facing design
```

Use the shadcn platonic blueprint for the current gap list and definition of
done.
