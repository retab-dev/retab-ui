import { performance } from "node:perf_hooks"
import type { JSONSchema7 } from "json-schema"

import sampleData from "../components/json-table/sample/data.json"
import sampleSchema from "../components/json-table/sample/schema.json"
import { setValueAtMaterializedPath } from "../components/json-table/lib/document-patches"
import { projectDocumentRows } from "../components/json-table/lib/document-projection"
import { flattenHeaderNodes } from "../components/json-table/lib/header-nodes"
import { getFieldMetadata } from "../components/json-table/lib/schema-field-metadata"
import { buildHeaderNodesFromSchema } from "../components/json-table/lib/schema-header-nodes"

const schema = {
  ...sampleSchema,
  properties: {
    ...sampleSchema.properties,
    transactions: {
      ...sampleSchema.properties?.transactions,
      items: {
        ...sampleSchema.properties?.transactions?.items,
        properties: {
          ...sampleSchema.properties?.transactions?.items?.properties,
          is_reconciled: { type: "boolean", title: "Reconciled" },
        },
      },
    },
  },
} as JSONSchema7

const transactions = Array.isArray(sampleData.transactions)
  ? sampleData.transactions.map((transaction, index) =>
      transaction && typeof transaction === "object"
        ? { ...transaction, is_reconciled: index % 3 === 0 }
        : transaction
    )
  : sampleData.transactions

const document = {
  id: "doc_1",
  data: {
    ...sampleData,
    transactions,
  },
}

const [headerNodes] = buildHeaderNodesFromSchema(schema, [])
const visibleKeys = flattenHeaderNodes(headerNodes).map((node) => node.key)

let metadataResult: unknown[] = []
const metadataStarted = performance.now()
for (let index = 0; index < 1_000; index++) {
  metadataResult = visibleKeys.map((key) => getFieldMetadata(schema, key))
}
const metadataElapsed = performance.now() - metadataStarted

let rows: unknown[] = []
const projectStarted = performance.now()
for (let index = 0; index < 200; index++) {
  rows = projectDocumentRows({
    document,
    visiblePaths: visibleKeys,
    includeArrayAddRows: true,
  })
}
const projectElapsed = performance.now() - projectStarted

let data: unknown = document.data
const patchStarted = performance.now()
for (let index = 0; index < 2_000; index++) {
  data = setValueAtMaterializedPath(
    data,
    `transactions.${index % 1_500}.is_reconciled`,
    index % 2 === 0
  )
}
const patchElapsed = performance.now() - patchStarted

console.log(
  JSON.stringify(
    {
      visibleKeys: visibleKeys.length,
      rows: rows.length,
      metadataResultCount: metadataResult.length,
      metadataPerRunMs: metadataElapsed / 1_000,
      projectPerRunMs: projectElapsed / 200,
      patchPerRunMs: patchElapsed / 2_000,
    },
    null,
    2
  )
)
