"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { CodeViewer } from "@/components/ui/code-viewer"
import type { CodeLineRange } from "@/components/ui/code-viewer"

type Sample = {
  id: string
  label: string
  fileName: string
  highlight: TextLineRange
  code: string
}

// One sample per language. Each is short and uses single-line comments and
// inline strings so it reads cleanly under the viewer's per-line tokenizer.
const SAMPLES: Sample[] = [
  {
    id: "typescript",
    label: "TypeScript",
    fileName: "extraction.ts",
    highlight: { start: 4, end: 8 },
    code: `import { z } from "zod"

// Schema for one parsed invoice line item.
export const LineItem = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number(),
})

export type LineItem = z.infer<typeof LineItem>

export function subtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}`,
  },
  {
    id: "python",
    label: "Python",
    fileName: "extract.py",
    highlight: { start: 9, end: 11 },
    code: `from dataclasses import dataclass

@dataclass
class Invoice:
    number: str
    total: float
    paid: bool = False

def is_overdue(invoice: Invoice, days: int) -> bool:
    """Return True when an unpaid invoice is past due."""
    return not invoice.paid and days > 30

print(is_overdue(Invoice("INV-1042", 980.50), days=45))`,
  },
  {
    id: "json",
    label: "JSON",
    fileName: "result.json",
    highlight: { start: 8, end: 11 },
    code: `{
  "document": "invoice-1042.pdf",
  "fields": {
    "invoice_number": "INV-1042",
    "total": 980.5,
    "currency": "USD",
    "paid": false,
    "line_items": [
      { "sku": "A-12", "quantity": 3, "unit_price": 120 },
      { "sku": "B-09", "quantity": 1, "unit_price": 620.5 }
    ]
  }
}`,
  },
  {
    id: "yaml",
    label: "YAML",
    fileName: "pipeline.yaml",
    highlight: { start: 4, end: 7 },
    code: `# Retab extraction pipeline
model: claude-opus-4-8
temperature: 0.0
schema:
  invoice_number: string
  total: number
  paid: boolean
retries: 3
fallbacks:
  - model: claude-sonnet-4-6
    temperature: 0.2`,
  },
  {
    id: "sql",
    label: "SQL",
    fileName: "revenue.sql",
    highlight: { start: 2, end: 5 },
    code: `-- Top customers by invoice total this quarter
SELECT c.name, SUM(i.total) AS revenue
FROM invoices AS i
JOIN customers AS c ON c.id = i.customer_id
WHERE i.paid = TRUE
  AND i.issued_at >= '2026-04-01'
GROUP BY c.name
ORDER BY revenue DESC
LIMIT 10;`,
  },
  {
    id: "bash",
    label: "Bash",
    fileName: "publish.sh",
    highlight: { start: 5, end: 6 },
    code: `#!/usr/bin/env bash
set -euo pipefail

# Build the registry, then publish the package.
pnpm registry:build
version=$(node -p "require('./package.json').version")

echo "Publishing retab-ui@\${version}"
npm publish --access public --tag latest`,
  },
]

export function CodeViewerSyntaxDemo() {
  const [activeId, setActiveId] = React.useState(SAMPLES[0].id)
  const active = SAMPLES.find((sample) => sample.id === activeId) ?? SAMPLES[0]

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Language"
        className="flex flex-wrap gap-1"
      >
        {SAMPLES.map((sample) => {
          const selected = sample.id === active.id
          return (
            <button
              key={sample.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(sample.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                selected
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {sample.label}
            </button>
          )
        })}
      </div>
      <div className="h-[360px]">
        <CodeViewer
          key={active.id}
          source={{
            kind: "text",
            text: active.code,
            fileName: active.fileName,
          }}
          highlight={active.highlight}
          className="h-full"
        />
      </div>
    </div>
  )
}
