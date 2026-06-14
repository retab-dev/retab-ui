import {
  JsonTableDemo,
  type JsonTableDemoProfileVariant,
} from "@/components/json-table/json-table-demo"

export default async function JsonTableProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const variant = jsonTableProfileVariant(params?.variant)
  const rowCount = jsonTableProfileInteger(params?.rows)
  const extraColumnCount = jsonTableProfileInteger(params?.extraColumns)
  const overscan = jsonTableProfileInteger(params?.overscan)
  const jumpOverscan = jsonTableProfileInteger(params?.jumpOverscan)

  return (
    <main className="flex min-h-screen flex-col bg-background p-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">JSON table</h1>
        <JsonTableDemo
          profileVariant={variant}
          profileRowCount={rowCount}
          profileExtraColumnCount={extraColumnCount}
          profileOverscan={overscan}
          profileJumpOverscan={jumpOverscan}
        />
      </section>
    </main>
  )
}

function jsonTableProfileVariant(
  value: string | string[] | undefined
): JsonTableDemoProfileVariant {
  return value === "large" ? "large" : "default"
}

function jsonTableProfileInteger(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (rawValue === undefined) return undefined
  const parsed = Number(rawValue)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.floor(parsed))
}
