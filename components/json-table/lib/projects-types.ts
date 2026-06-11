import { z } from "zod";
import {
  InferenceSettingsSchema,
  defaultInferenceSettings,
} from "@/components/json-table/lib/inference-settings";
import {
  FileRefSchema,
  MIMEDataSchema,
} from "@/components/json-table/lib/mime-types";

export const MetricTypeSchema = z.enum(["levenshtein", "jaccard", "hamming"]);

export const PredictionMetadataSchema = z
  .object({
    consensus: z
      .object({
        choices: z.array(z.record(z.any())).optional(),
        likelihoods: z.record(z.any()).optional().nullable(),
        likelihood: z.number().optional().nullable(),
      })
      .optional(),
    likelihoods: z.record(z.any()).optional(),
    field_locations: z.record(z.any()).optional().nullable(),
    consensus_details: z.array(z.record(z.any())).optional(),
    extraction_id: z.string().optional().nullable(),
  })
  .strict();

export const PredictionDataSchema = z
  .object({
    prediction: z.record(z.any()),
    metadata: PredictionMetadataSchema.optional(),
  })
  .strict();

export const SchemaOverridesSchema = z
  .object({
    descriptionsOverride: z.record(z.string()).optional(),
    reasoningPromptsOverride: z.record(z.string()).optional(),
  })
  .strict();

export type SchemaOverrides = z.infer<typeof SchemaOverridesSchema>;

// ISO date string schema for timestamps
const ISODateString = z.string().datetime({ offset: true });

/** ──────────────────────────────────────────────────────────────
 *  Project Configuration Schemas
 *  ────────────────────────────────────────────────────────────── */

export const ComputationSchema = z
  .object({
    expression: z.string(),
  })
  .strict();

export const ComputationSpecSchema = z
  .object({
    computations: z.record(ComputationSchema).default({}),
  })
  .strict();

export const DraftConfigSchema = z
  .object({
    inference_settings: InferenceSettingsSchema,
    json_schema: z.record(z.any()).default({}),
  })
  .strict();

export const PublishedConfigSchema = DraftConfigSchema.extend({
  origin: z.string().default("manual"),
}).strict();

/** ──────────────────────────────────────────────────────────────
 *  Project Schemas
 *  ────────────────────────────────────────────────────────────── */

export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    updated_at: ISODateString,
    published_config: PublishedConfigSchema,
    draft_config: DraftConfigSchema,
    is_published: z.boolean().default(false),
    is_schema_generated: z.boolean().default(true),
  })
  .strict();

export const StoredProjectSchema = ProjectSchema.extend({
  organization_id: z.string(),
}).strict();

export const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1, "Project name is required"),
  })
  .strict();

export const PatchProjectRequestSchema = z
  .object({
    name: z.string().optional(),
    published_config: PublishedConfigSchema.optional(),
    draft_config: DraftConfigSchema.optional(),
    is_published: z.boolean().optional(),
  })
  .strict();

export const DuplicateProjectRequestSchema = z
  .object({
    name: z.string().optional(),
  })
  .strict();

export const RenameProjectRequestSchema = z
  .object({
    name: z.string().min(1, "Project name is required"),
  })
  .strict();

/** ──────────────────────────────────────────────────────────────
 *  Builder Document Schemas
 *  ────────────────────────────────────────────────────────────── */

export const BuilderDocumentSchema = z
  .object({
    id: z.string(),
    project_id: z.string(),
    mime_data: FileRefSchema,
    prediction_data: PredictionDataSchema.default({ prediction: {} }),
    extraction_id: z.string().nullable(),
  })
  .strict();

export const StoredBuilderDocumentSchema = BuilderDocumentSchema.extend({
  organization_id: z.string(),
}).strict();

export const AddBuilderDocumentRequestSchema = z
  .object({
    mime_data: MIMEDataSchema,
    prediction_data: PredictionDataSchema.default({ prediction: {} }),
    project_id: z.string(),
  })
  .strict();

export const PatchBuilderDocumentRequestSchema = z
  .object({
    extraction_id: z.string().nullable().optional(),
    prediction_data: PredictionDataSchema.optional(),
  })
  .strict();

/** ──────────────────────────────────────────────────────────────
 *  Query Parameters & List Response Schemas
 *  ────────────────────────────────────────────────────────────── */

export const ListProjectsParamsSchema = z.object({
  before: z.string().nullable().optional(),
  after: z.string().nullable().optional(),
  limit: z.number().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  fields: z.string().optional(),
  published: z.boolean().optional(),
});

export const ListMetadataSchema = z.object({
  before: z.string().nullable().optional(),
  after: z.string().nullable().optional(),
  has_more: z.boolean().optional(),
  total_count: z.number().optional(),
});

export const ListProjectsResponseSchema = z
  .object({
    data: z.array(ProjectSchema),
    list_metadata: ListMetadataSchema,
  })
  .strict();

/** ──────────────────────────────────────────────────────────────
 *  Derived Types
 *  ────────────────────────────────────────────────────────────── */

export type PublishedConfig = z.infer<typeof PublishedConfigSchema>;
export type DraftConfig = z.infer<typeof DraftConfigSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type StoredProject = z.infer<typeof StoredProjectSchema>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type PatchProjectRequest = z.infer<typeof PatchProjectRequestSchema>;
export type DuplicateProjectRequest = z.infer<
  typeof DuplicateProjectRequestSchema
>;
export type RenameProjectRequest = z.infer<typeof RenameProjectRequestSchema>;
export type BuilderDocument = z.infer<typeof BuilderDocumentSchema>;
export type StoredBuilderDocument = z.infer<typeof StoredBuilderDocumentSchema>;
export type AddBuilderDocumentRequest = z.infer<
  typeof AddBuilderDocumentRequestSchema
>;
export type PatchBuilderDocumentRequest = z.infer<
  typeof PatchBuilderDocumentRequestSchema
>;

export type ListProjectsParams = z.infer<typeof ListProjectsParamsSchema>;
export type ListMetadata = z.infer<typeof ListMetadataSchema>;
export type ListProjectsResponse = z.infer<typeof ListProjectsResponseSchema>;

/** ──────────────────────────────────────────────────────────────
 *  Dataset Schemas
 *  ────────────────────────────────────────────────────────────── */

export const DatasetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    updated_at: ISODateString,
    base_json_schema: z.record(z.any()).default({}),
    base_inference_settings: InferenceSettingsSchema.default(
      defaultInferenceSettings,
    ),
    project_id: z.string(),
  })
  .strict();

export const StoredDatasetSchema = DatasetSchema.extend({
  organization_id: z.string(),
}).strict();

export const CreateDatasetRequestSchema = z
  .object({
    name: z.string().min(1, "Dataset name is required"),
    base_json_schema: z.record(z.any()).default({}),
    base_inference_settings: InferenceSettingsSchema.default(
      defaultInferenceSettings,
    ),
  })
  .strict();

export const PatchDatasetRequestSchema = z
  .object({
    name: z.string().optional(),
  })
  .strict();

export const ListDatasetsResponseSchema = z
  .object({
    data: z.array(DatasetSchema),
    list_metadata: ListMetadataSchema,
  })
  .strict();

export const DatasetValidationStatsSchema = z
  .object({
    total_documents: z.number(),
    total_fields: z.number(),
    verified_fields: z.number(),
    unverified_fields: z.number(),
    verification_percentage: z.number(),
    documents_fully_verified: z.number(),
    documents_partially_verified: z.number(),
    documents_unverified: z.number(),
  })
  .strict();

export const DatasetDocumentsCountSchema = z
  .object({
    count: z.number(),
  })
  .strict();

/** ──────────────────────────────────────────────────────────────
 *  Dataset Types
 *  ────────────────────────────────────────────────────────────── */

export type Dataset = z.infer<typeof DatasetSchema>;
export type StoredDataset = z.infer<typeof StoredDatasetSchema>;
export type CreateDatasetRequest = z.infer<typeof CreateDatasetRequestSchema>;
export type PatchDatasetRequest = z.infer<typeof PatchDatasetRequestSchema>;
export type ListDatasetsResponse = z.infer<typeof ListDatasetsResponseSchema>;
export type DatasetValidationStats = z.infer<
  typeof DatasetValidationStatsSchema
>;
export type DatasetDocumentsCount = z.infer<typeof DatasetDocumentsCountSchema>;

/** ──────────────────────────────────────────────────────────────
 *  Dataset Document Schemas
 *  ────────────────────────────────────────────────────────────── */

export const DatasetDocumentSchema = BuilderDocumentSchema.extend({
  dataset_id: z.string(),
  validation_flags: z.record(z.any()).default({}),
}).strict();

export const StoredDatasetDocumentSchema = DatasetDocumentSchema.extend({
  organization_id: z.string(),
}).strict();

export const AddDatasetDocumentRequestSchema = z
  .object({
    mime_data: MIMEDataSchema,
    prediction_data: PredictionDataSchema.default({ prediction: {} }),
    project_id: z.string(),
    dataset_id: z.string(),
  })
  .strict();

export const PatchDatasetDocumentRequestSchema = z
  .object({
    extraction_id: z.string().nullable().optional(),
    prediction_data: PredictionDataSchema.optional(),
    validation_flags: z.record(z.any()).nullable().optional(),
  })
  .strict();

/** ──────────────────────────────────────────────────────────────
 *  Dataset Document Types
 *  ────────────────────────────────────────────────────────────── */

export type DatasetDocument = z.infer<typeof DatasetDocumentSchema>;
export type StoredDatasetDocument = z.infer<typeof StoredDatasetDocumentSchema>;
export type AddDatasetDocumentRequest = z.infer<
  typeof AddDatasetDocumentRequestSchema
>;
export type PatchDatasetDocumentRequest = z.infer<
  typeof PatchDatasetDocumentRequestSchema
>;

/** ──────────────────────────────────────────────────────────────
 *  Iteration Schemas
 *  ────────────────────────────────────────────────────────────── */

const IterationStatusSchema = z.preprocess(
  (value) => (value === "completed" ? "finalized" : value),
  z.enum(["draft", "finalizing", "finalized"]),
);

export const DraftIterationSchema = z
  .object({
    schema_overrides: SchemaOverridesSchema.default({}),
    updated_at: ISODateString,
    inference_settings: InferenceSettingsSchema,
  })
  .strict();

const PatchDraftIterationSchema = DraftIterationSchema.omit({
  updated_at: true,
}).extend({
  updated_at: ISODateString.optional(),
});

export const IterationSchema = z
  .object({
    id: z.string(),
    updated_at: ISODateString,
    inference_settings: InferenceSettingsSchema,
    schema_overrides: SchemaOverridesSchema.default({}),
    parent_id: z.string().nullable().optional(),
    project_id: z.string(),
    dataset_id: z.string(),
    draft: DraftIterationSchema.default({
      inference_settings: defaultInferenceSettings,
      schema_overrides: {},
      updated_at: new Date().toISOString(),
    }),
    status: IterationStatusSchema.default("draft"),
    finalized_at: ISODateString.nullish(),
    finalize_started_at: ISODateString.nullish(),
    last_finalize_error: z.string().nullish(),
  })
  .strict();

export const StoredIterationSchema = IterationSchema.extend({
  organization_id: z.string(),
}).strict();

export const CreateIterationRequestSchema = z
  .object({
    inference_settings: InferenceSettingsSchema,
    schema_overrides: SchemaOverridesSchema.default({}),
    project_id: z.string(),
    dataset_id: z.string(),
    parent_id: z.string().optional(),
  })
  .strict();

export const PatchIterationRequestSchema = z
  .object({
    draft: PatchDraftIterationSchema.optional(),
    inference_settings: InferenceSettingsSchema.optional(),
    schema_overrides: SchemaOverridesSchema.optional(),
  })
  .strict();

export const ListIterationsResponseSchema = z
  .object({
    data: z.array(IterationSchema),
    list_metadata: ListMetadataSchema,
  })
  .strict();

/** ──────────────────────────────────────────────────────────────
 *  Iteration Types
 *  ────────────────────────────────────────────────────────────── */

export type DraftIteration = z.infer<typeof DraftIterationSchema>;
export type Iteration = z.infer<typeof IterationSchema>;
export type StoredIteration = z.infer<typeof StoredIterationSchema>;
export type CreateIterationRequest = z.infer<
  typeof CreateIterationRequestSchema
>;
export type PatchIterationRequest = z.infer<typeof PatchIterationRequestSchema>;
export type ListIterationsResponse = z.infer<
  typeof ListIterationsResponseSchema
>;

/** ──────────────────────────────────────────────────────────────
 *  Iteration Document Schemas
 *  ────────────────────────────────────────────────────────────── */

export const IterationDocumentSchema = BuilderDocumentSchema.extend({
  iteration_id: z.string(),
  dataset_id: z.string(),
  dataset_document_id: z.string(),
}).strict();

export const StoredIterationDocumentSchema = IterationDocumentSchema.extend({
  organization_id: z.string(),
}).strict();

export const PatchIterationDocumentRequestSchema = z
  .object({
    extraction_id: z.string().nullable().optional(),
    prediction_data: PredictionDataSchema.optional(),
  })
  .strict();

/** ──────────────────────────────────────────────────────────────
 *  Iteration Document Types
 *  ────────────────────────────────────────────────────────────── */

export type IterationDocument = z.infer<typeof IterationDocumentSchema>;
export type StoredIterationDocument = z.infer<
  typeof StoredIterationDocumentSchema
>;
export type PatchIterationDocumentRequest = z.infer<
  typeof PatchIterationDocumentRequestSchema
>;

export type TableDocument =
  | BuilderDocument
  | DatasetDocument
  | IterationDocument;
