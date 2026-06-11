// Minimal stand-in for the dashboard MIME types (purify later).
import { z } from "zod"

export const FileRefSchema = z
  .object({
    id: z.string(),
    filename: z.string().optional(),
    mime_type: z.string().optional(),
  })
  .passthrough()
