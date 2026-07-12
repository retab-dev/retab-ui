import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { ExamplesShowcase } from "@/components/examples-showcase";

export default function ExamplesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <PageHeaderHeading className="max-w-4xl">
          Examples
        </PageHeaderHeading>
        <PageHeaderDescription>
          Document viewers composed from shared file, source, sidebar, and
          legend primitives. Toggle Preview / Code, resize the viewport, or copy
          the install command.
        </PageHeaderDescription>
      </PageHeader>
      <ExamplesShowcase>{children}</ExamplesShowcase>
    </div>
  );
}
