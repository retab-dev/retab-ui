import { z } from "zod"

import { FileRefSchema } from "@/components/json-table/lib/mime-types"

export const PredictionMetadataSchema = z
  .object({
    field_locations: z.record(z.unknown()).optional().nullable(),
    extraction_id: z.string().optional().nullable(),
  })
  .strict()

export const PredictionDataSchema = z
  .object({
    prediction: z.record(z.unknown()),
    metadata: PredictionMetadataSchema.optional(),
  })
  .strict()

export const BuilderDocumentSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    mime_data: FileRefSchema,
    prediction_data: PredictionDataSchema.default({ prediction: {} }),
    extraction_id: z.string().nullable(),
  })
  .strict()

export type BuilderDocument = z.infer<typeof BuilderDocumentSchema>

export type TableDocument = BuilderDocument
