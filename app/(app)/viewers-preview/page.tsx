import { type Metadata } from "next";

import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import { ViewersDemo } from "@/components/viewers/viewers-demo";
import { JsonTableDemo } from "@/components/json-table/json-table-demo";

export const metadata: Metadata = {
  title: "Viewers preview",
  description:
    "Live preview of the Retab primitive viewers, ported from the dashboard.",
};

export default function ViewersPreviewPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader>
        <PageHeaderHeading className="max-w-4xl">
          Primitive viewers
        </PageHeaderHeading>
        <PageHeaderDescription>
          The Retab result viewers, ported verbatim from the dashboard
          playground.
        </PageHeaderDescription>
      </PageHeader>
      <div className="container-wrapper flex-1">
        <div className="container flex flex-col gap-10 py-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">JSON table</h2>
            <JsonTableDemo />
          </section>
          <ViewersDemo />
        </div>
      </div>
    </div>
  );
}
