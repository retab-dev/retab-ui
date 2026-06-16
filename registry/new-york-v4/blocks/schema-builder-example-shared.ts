import type { ExtendedJSONSchema7 } from "@/components/ui/schema-builder"

/**
 * Sample schemas shared across the Schema Builder docs examples. Each is a plain
 * JSON Schema the editor can drive an extraction against.
 */

export const invoiceSchema: ExtendedJSONSchema7 = {
  type: "object",
  title: "Invoice",
  properties: {
    invoice_number: { type: "string", description: "The invoice identifier" },
    issue_date: { type: "string", description: "Date the invoice was issued" },
    total: { type: "number", description: "Total amount due" },
    currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
    paid: { type: "boolean" },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "integer" },
          unit_price: { type: "number" },
        },
        required: ["description"],
      },
    },
  },
  required: ["invoice_number", "total"],
}

export const receiptSchema: ExtendedJSONSchema7 = {
  type: "object",
  title: "Receipt",
  properties: {
    merchant: { type: "string", description: "Store or vendor name" },
    purchased_at: { type: "string", description: "Transaction timestamp" },
    subtotal: { type: "number" },
    tax: { type: "number" },
    total: { type: "number" },
    payment_method: {
      type: "string",
      enum: ["cash", "card", "transfer"],
    },
  },
  required: ["merchant", "total"],
}

export const contactSchema: ExtendedJSONSchema7 = {
  type: "object",
  title: "Contact",
  properties: {
    full_name: { type: "string" },
    email: { type: "string", description: "Primary email address" },
    phone: { type: "string" },
    company: { type: "string" },
    role: { type: "string" },
  },
  required: ["full_name"],
}

/**
 * A schema that reuses a shared `address` definition through `$ref` — exercises
 * the `definitions` feature surface.
 */
export const schemaWithDefs: ExtendedJSONSchema7 = {
  type: "object",
  title: "Order",
  $defs: {
    address: {
      type: "object",
      properties: {
        street: { type: "string" },
        city: { type: "string" },
        postal_code: { type: "string" },
        country: { type: "string" },
      },
      required: ["street", "city"],
    },
  },
  properties: {
    order_id: { type: "string" },
    billing_address: { $ref: "#/$defs/address" },
    shipping_address: { $ref: "#/$defs/address" },
    total: { type: "number" },
  },
  required: ["order_id"],
}
