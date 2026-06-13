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

  return (
    <main className="flex min-h-screen flex-col bg-background p-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">JSON table</h1>
        <JsonTableDemo profileVariant={variant} />
      </section>
    </main>
  )
}

function jsonTableProfileVariant(
  value: string | string[] | undefined
): JsonTableDemoProfileVariant {
  return value === "large" ? "large" : "default"
}
