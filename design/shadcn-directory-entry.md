# Registering `@retab` in the shadcn registry directory

This adds Retab UI as a namespaced registry (`@retab`) in shadcn's master index.
The directory file lives in the **upstream** repo, not here:
`shadcn-ui/ui` → `apps/v4/registry/directory.json`.

## Entry to add to `apps/v4/registry/directory.json`

Insert this object into the directory's `items`/array (keep alphabetical order by `name`):

```json
{
  "name": "@retab",
  "homepage": "https://ui.retab.com",
  "url": "https://ui.retab.com/r/{name}.json",
  "description": "Retab UI — production-ready React components for document AI: PDF, image, XLSX, PPTX and CSV viewers, a JSON schema editor, and extraction/classification workflow blocks, built on Tailwind CSS and Base UI.",
  "logo": "<svg width='256' height='256' viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'><rect x='11' y='23.5303' width='7.26572' height='6.76463' fill='var(--foreground)'/><rect x='11' y='10' width='7.26572' height='6.76463' fill='var(--foreground)'/><rect x='18.2656' y='16.7651' width='19.0412' height='6.76463' fill='var(--foreground)'/><rect x='18.2656' y='30.2944' width='19.0412' height='6.76463' fill='var(--foreground)'/></svg>"
}
```

## PR steps (you submit)

1. Fork `https://github.com/shadcn-ui/ui` and clone your fork.
2. Add the entry above to `apps/v4/registry/directory.json` (alphabetical by `name`).
3. From `apps/v4`, run `pnpm validate:registries`.
4. Open a PR to `shadcn-ui/ui`.

### Suggested PR title
`feat(registry): add @retab to the registry directory`

### Suggested PR body
> Adds Retab UI (`@retab`) to the registry directory.
>
> - **Homepage:** https://ui.retab.com
> - **Registry URL:** https://ui.retab.com/r/{name}.json
> - Open source: https://github.com/retab-inc/retab-ui
> - Flat registry — `registry.json` and `{name}.json` served at `/r/`.
> - Index `files` arrays do not inline `content`.

## Requirements check

- [x] Open source & publicly accessible (https://github.com/retab-inc/retab-ui, served at ui.retab.com)
- [x] Valid `registry.json` conforming to the registry schema
- [x] Flat registry — no nested items
- [x] Index `files` arrays contain no `content` property

## Blocking item

`ui.retab.com` must resolve before the PR is reviewable. In **Cloudflare DNS for retab.com**:
add **CNAME `ui` → `cname.vercel-dns.com`** (or **A `ui` → `76.76.21.21`**), **DNS-only / grey cloud**
so Vercel can issue the TLS cert. Vercel auto-verifies and emails on completion.
