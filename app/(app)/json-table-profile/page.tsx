import { JsonTableDemo } from "@/components/json-table/json-table-demo"

export default function JsonTableProfilePage() {
  return (
    <main className="flex min-h-screen flex-col bg-background p-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">JSON table</h1>
        <JsonTableDemo />
      </section>
    </main>
  )
}
