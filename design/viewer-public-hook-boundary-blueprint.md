# Viewer Public Hook Boundary Blueprint

This blueprint is superseded by
[`viewer-system-shadcn-platonic-blueprint.md`](./viewer-system-shadcn-platonic-blueprint.md).

The previous boundary still exposed too many named part hooks. The current rule
is stricter:

```txt
provider context stays private
aggregate viewer hooks stay absent
first-party part-state hooks stay private or explicitly internal
only real external coordination hooks are public
```

Use the shadcn platonic blueprint as the active source of truth.
