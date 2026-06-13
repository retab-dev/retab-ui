import type { Metadata } from "next"

import { JsonFormLargeArraySample } from "./json-form-large-array-sample"

export const metadata: Metadata = {
  title: "JSON Form large array sample",
  description: "Stress sample for JsonForm array-table rendering.",
}

export default function JsonFormLargeArrayPage() {
  return <JsonFormLargeArraySample />
}
