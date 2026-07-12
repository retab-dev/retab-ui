import { ViewerBlockTabs } from "@/components/viewer-blocks";

// Shared body for the /examples pages and the homepage: the sectioned
// viewer-block tab navigation above the active example content. Keeping it in
// one component means the homepage and the examples route stay identical in
// layout and max-width without duplicating the container markup.
export function ExamplesShowcase({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container-wrapper flex-1">
      <div className="container max-w-5xl space-y-8 py-8">
        <ViewerBlockTabs />
        {children}
      </div>
    </div>
  );
}
