import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";

export const templateObjects: Record<
  string,
  ExtendedJSONSchema7 & { deps?: string[] }
> = {
  Address: {
    description:
      "A normalized postal address (Schema.org / UBL / FHIR compatible).",
    properties: {
      street_address: {
        description:
          "Full address line: house number, street name, apt/suite, building, floor, company, ...",
        examples: ["221B Baker Street, Flat B, 10th Floor, Acme Inc."],
        title: "Street Address",
        type: "string",
      },
      city: {
        examples: ["London"],
        title: "City",
        type: "string",
      },
      region: {
        anyOf: [
          {
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        description: "State / province / region.",
        examples: ["Greater London"],
        title: "Region",
      },
      postal_code: {
        anyOf: [
          {
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        description: "ZIP / postal code.",
        examples: ["NW1 6XE"],
        title: "Postal Code",
      },
      country: {
        examples: ["GB"],
        maxLength: 2,
        minLength: 2,
        pattern: "^[A-Z]{2}$",
        title: "Country",
        type: "string",
      },
    },
    required: ["street_address", "city", "country"],
    title: "Address",
    type: "object",
  },
  Price: {
    description:
      "Monetary value tied to a specific ISO-4217 currency.\n\n`amount` is stored in the major unit of the currency (e.g. dollars, euros).",
    properties: {
      amount: {
        anyOf: [
          {
            type: "number",
          },
          {
            type: "string",
          },
        ],
        examples: ["19.99"],
        title: "Amount",
      },
      currency: {
        examples: ["USD"],
        maxLength: 3,
        minLength: 3,
        pattern: "^[A-Z]{3}$",
        title: "Currency",
        type: "string",
      },
    },
    required: ["amount", "currency"],
    title: "Price",
    type: "object",
  },
  Person: {
    description: "A natural person with contact information.",
    properties: {
      first_name: {
        examples: ["Ada"],
        title: "First Name",
        type: "string",
      },
      last_name: {
        examples: ["Lovelace"],
        title: "Last Name",
        type: "string",
      },
      middle_name: {
        anyOf: [
          {
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        examples: ["King"],
        title: "Middle Name",
      },
      email: {
        anyOf: [
          {
            pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        examples: ["ada@example.com"],
        title: "Email",
      },
      phone: {
        anyOf: [
          {
            pattern: "^\\+?[0-9 .\\-()]{7,25}$",
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        examples: ["+1-555-0100"],
        title: "Phone",
      },
    },
    required: ["first_name", "last_name"],
    title: "Person",
    type: "object",
  },
  Company: {
    $defs: {
      Address: {
        description:
          "A normalized postal address (Schema.org / UBL / FHIR compatible).",
        properties: {
          street_address: {
            description:
              "Full address line: house number, street name, apt/suite, building, floor, company, ...",
            examples: ["221B Baker Street, Flat B, 10th Floor, Acme Inc."],
            title: "Street Address",
            type: "string",
          },
          city: {
            examples: ["London"],
            title: "City",
            type: "string",
          },
          region: {
            anyOf: [
              {
                type: "string",
              },
              {
                type: "null",
              },
            ],
            default: null,
            description: "State / province / region.",
            examples: ["Greater London"],
            title: "Region",
          },
          postal_code: {
            anyOf: [
              {
                type: "string",
              },
              {
                type: "null",
              },
            ],
            default: null,
            description: "ZIP / postal code.",
            examples: ["NW1 6XE"],
            title: "Postal Code",
          },
          country: {
            examples: ["GB"],
            maxLength: 2,
            minLength: 2,
            pattern: "^[A-Z]{2}$",
            title: "Country",
            type: "string",
          },
        },
        required: ["street_address", "city", "country"],
        title: "Address",
        type: "object",
      },
    },
    description: "A legal entity or organization.",
    properties: {
      name: {
        description: "Registered legal name.",
        examples: ["Example Corp."],
        title: "Name",
        type: "string",
      },
      address: {
        $ref: "#/$defs/Address",
      },
      phone: {
        anyOf: [
          {
            pattern: "^\\+?[0-9 .\\-()]{7,25}$",
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        examples: ["+1 415 555 0199"],
        title: "Phone",
      },
      email: {
        anyOf: [
          {
            pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$",
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        examples: ["info@example.com"],
        title: "Email",
      },
      website: {
        anyOf: [
          {
            type: "string",
          },
          {
            type: "null",
          },
        ],
        default: null,
        description: "Company website URL.",
        examples: ["https://example.com"],
        title: "Website",
      },
    },
    required: ["name", "address"],
    title: "Company",
    type: "object",
    deps: ["Address"],
  },
  Event: {
    description:
      "An occurrence at a certain date and place, lasting from a start time to an end time.",
    properties: {
      title: {
        examples: ["Board Meeting"],
        title: "Title",
        type: "string",
      },
      date: {
        examples: ["2025-08-15"],
        format: "date",
        title: "Date",
        type: "string",
      },
      start_time: {
        examples: ["09:00"],
        format: "iso-time",
        title: "Start Time",
        type: "string",
      },
      end_time: {
        examples: ["11:30"],
        format: "iso-time",
        title: "End Time",
        type: "string",
      },
      description: {
        examples: ["Quarterly results call for the company"],
        title: "Description",
        type: "string",
      },
    },
    required: ["title", "date", "start_time", "end_time", "description"],
    title: "Event",
    type: "object",
  },
};
