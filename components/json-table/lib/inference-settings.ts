import { z } from "zod";

/**
 * Frontend inference-settings shape used by the extraction/playground forms and
 * embedded into the project/extract zod schemas (`DraftConfigSchema`,
 * `ExtractionSettingsSchema`, ...).
 *
 * NOTE: the public/internal OpenAPI contract (`@/types`) does NOT expose a
 * reusable `InferenceSettings` schema — the only contract relative is
 * `DeepResearchInferenceSettings` (`{ model, reasoning_effort,
 * image_resolution_dpi }`, no `id`/`modality`/`n_consensus`/`browser_canvas`),
 * and the generic update endpoint treats `inference_settings` as opaque
 * `Record<string, unknown> | null`. So this stays the single frontend source of
 * truth rather than being re-pointed at `@/types`. The fields below
 * (`id`/`modality`/`n_consensus`/`browser_canvas`) are frontend-form extras the
 * contract does not model.
 */
export const InferenceSettingsSchema = z
  .object({
    id: z.string().optional(),
    model: z.string(),
    modality: z.string().optional(),
    image_resolution_dpi: z.number(),
    n_consensus: z.number(),
    browser_canvas: z.string().optional(),
    reasoning_effort: z.string().optional(),
  })
  .strict();

export type InferenceSettings = z.infer<typeof InferenceSettingsSchema>;

/**
 * Form-only superset: the inference settings form additionally carries the
 * edited `json_schema` alongside the settings. The delta is intentionally
 * visible at the definition site.
 */
export type FormInferenceSettings = InferenceSettings & {
  json_schema?: Record<string, unknown>;
};

export const defaultInferenceSettings: InferenceSettings = {
  model: "retab-small",
  modality: "native",
  image_resolution_dpi: 192,
  n_consensus: 1,
  browser_canvas: "A4",
  reasoning_effort: "minimal",
};
