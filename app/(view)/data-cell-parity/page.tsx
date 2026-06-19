import { DataCellDemo } from "@/components/data-cell-demo";

export default function DataCellParityPage() {
  return (
    <main className="bg-background text-foreground min-h-screen overflow-auto p-8">
      <div className="mx-auto w-[720px] max-w-full">
        <DataCellDemo />
      </div>
    </main>
  );
}
