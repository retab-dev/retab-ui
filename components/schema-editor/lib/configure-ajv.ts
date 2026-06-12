import type Ajv from "ajv"
import ajvErrors from "ajv-errors"
import addFormats from "ajv-formats"

type AjvFormatsInstance = Parameters<typeof addFormats>[0]
type AjvErrorsInstance = Parameters<typeof ajvErrors>[0]

export function addJsonSchemaFormats(ajv: Ajv) {
  addFormats(ajv as unknown as AjvFormatsInstance)
}

export function addJsonSchemaErrors(ajv: Ajv) {
  ajvErrors(ajv as unknown as AjvErrorsInstance)
}
