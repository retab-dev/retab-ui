# Repository Guidelines

## Design Principles
- Aim for the platonic ideal of every component: the version that feels complete, inevitable, and exact.
- Platonic ideal means perfection. The implementation should be simple, fast, complete, and free of anything unnecessary.
- Simplicity is a feature. Prefer direct code, clear data flow, and the smallest API that can fully express the behavior.
- Speed matters at every layer: runtime performance, render performance, build feedback, test feedback, and reader comprehension.
- Include everything that is needed: states, errors, loading behavior, accessibility, tests, documentation, and integration points.
- Include nothing more: no decorative abstractions, speculative options, duplicate paths, unused parameters, or clever indirection.
- Modularization should be perfect. Each module owns one coherent responsibility, exports the right surface, and hides its internals.
- Write high-entropy code: every line should carry useful information. Remove filler, boilerplate drift, and repeated low-value patterns.
- Variable names should be perfectly consistent. The same concept gets the same name everywhere; different concepts get clearly different names.
- Seek Flaubertian perfection: choose the precise word, the precise boundary, the precise state shape, and the precise component API.
