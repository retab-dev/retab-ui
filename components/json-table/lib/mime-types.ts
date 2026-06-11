// Minimal stand-in for the dashboard MIME types (purify later).
import { z } from "zod"

export const MIMEDataSchema = z
  .object({
    filename: z.string().optional(),
    url: z.string().optional(),
    mime_type: z.string().optional(),
  })
  .passthrough()

export const FileRefSchema = z
  .object({
    id: z.string(),
    filename: z.string().optional(),
    mime_type: z.string().optional(),
  })
  .passthrough()

export type MIMEData = z.infer<typeof MIMEDataSchema>
export type FileRef = z.infer<typeof FileRefSchema>
