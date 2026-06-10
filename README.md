# Retab UI

[Retab UI](https://retab.com/ui) is a set of open-source, headless React
components for rendering the results of [Retab](https://retab.com)'s document AI
primitives.

The library ships one viewer per Retab primitive — **parse, extraction, edit,
classification, partition, and split** — built on standard
[shadcn/ui](https://ui.shadcn.com) base components. Each viewer is unstyled and
installed as source through the shadcn component registry, so you own the code
and theme it to match your product.

## Links

- Documentation: [https://retab.com/ui](https://retab.com/ui)
- GitHub: [retab-dev/ui](https://github.com/retab-dev/ui)
- Registry namespace: `@retab/*`

## Getting Started

Install a component with the shadcn CLI:

```bash
npx shadcn@latest add @retab/extraction-viewer
```

Retab UI components are copied into your project as source, so you can adapt them
to your app. Shared primitives such as `Button`, `Tabs`, `Dialog`, `ScrollArea`,
and `Tooltip` are expected to use the primitives your app already has. If your
project uses a different alias or design-system path, update the generated
imports to match, or set those aliases in `components.json` before installing.

## Development

```bash
pnpm install
pnpm v4:dev
```

```bash
# Build the component registry (writes apps/v4/public/r/*.json)
pnpm v4:registry:build
```

## License

Licensed under the [MIT license](./LICENSE.md).
