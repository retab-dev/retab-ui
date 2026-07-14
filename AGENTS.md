# Repository Guidelines

## Response Instructions

- When asked to write a blueprint, create or update a Markdown file instead of writing the blueprint in chat.
- Manage project dev servers autonomously when they are needed for the requested work. Reuse a responsive server, start one when absent, and restart one when it is unresponsive or stale. Before stopping a process, verify that it belongs to this repository and is listening on the project’s configured port; never interfere with unrelated processes. Track servers started during the task and stop them when they are no longer needed unless the user asks to leave them running.

## Git Workflow

- Always work directly on `main`. Never create branches.
- Commit and push to `main`. After any merge or push, remain on `main`.

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
- No legacy adapters, compatibility shims, or backward-compatible fallback paths. Make hard cutovers and update all call sites.
