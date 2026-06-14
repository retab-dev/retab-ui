import { DataCellDemo } from "@/components/data-cell-demo"

export default function DataCellParityPage() {
  return (
    <main className="min-h-screen overflow-auto bg-background p-8 text-foreground">
      <div className="mx-auto w-[720px] max-w-full">
        <DataCellDemo />
      </div>
    </main>
  )
}
