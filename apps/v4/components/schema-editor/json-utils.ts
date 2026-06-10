// TypeScript translation of json_utils.py

export const Summary_prompt = `You are an expert at analyzing and summarizing documents to extract global, contextual information that can support detailed data extraction from specific sections later. Your task is to perform a comprehensive first-pass review of the entire provided document and create a thorough yet concise summary capturing all key global elements. This summary will be used as supplementary context for another model that only has access to isolated pages or sections, ensuring it can accurately extract or interpret local data without missing overarching details.

Focus on identifying and summarizing:
- **Metadata and Structural Elements**: Overall title, author/publisher, date, document type/purpose, table of contents, section headings, page numbering schemes, headers/footers, and any recurring layouts or formatting conventions (e.g., how tables, images, or product listings are structured).
- **Introductory or Explanatory Content**: Any preambles, introductions, legends, glossaries, abbreviations, definitions, disclaimers, or guidelines that apply to the whole document (e.g., measurement units, symbols, color codes, or categorization systems).
- **Global Themes and Patterns**: Common entities like brands, collections, categories, themes, or hierarchies that span multiple sections (e.g., product lines, pricing models, material types, or regional variations).
- **Cross-Referential Information**: References to appendices, indexes, external resources, or interconnections between sections that could inform local interpretations.
- **Potential Extraction Aids**: Rules, templates, or examples that guide data interpretation (e.g., reading product IDs, specifications, or variations) without repeating on every page. Include precise guidelines for standardizing extractions, such as formatting conventions, key-naming rules, preservation of original formatting, avoidance of inferences, and handling of edge cases (e.g., empty values, ranges, or negations).
- **Other Relevant Overviews**: Summaries of any charts, indexes, or summaries within the document that provide high-level insights.

Prioritize completeness over brevity, but organize the output clearly and avoid redundancy. Structure your summary using markdown headings for each category (e.g., ## Metadata and Structural Elements), with bullet points or lists for details within each section. For conventions and guidelines, use subheadings, numbered lists, or code blocks to present schemas, rules, or examples systematically. Use plain text for the entire output to ensure easy readability and parsing. Do not include page-specific details unless they represent global patterns.
`;

export function resolveRef(
  schemaRoot: Record<string, any>,
  ref: string,
): Record<string, any> {
  const parts = ref.split("/");
  if (parts[0] !== "#") {
    throw new Error(`Unsupported or invalid ref format: ${ref}`);
  }

  let current: any = schemaRoot;
  for (let idx = 0; idx < parts.length - 1; idx++) {
    const part = parts[idx + 1];
    if (typeof current !== "object" || current === null) {
      throw new Error(`Ref '${ref}' could not be resolved at part '${part}'.`);
    }
    if (part in current) {
      current = current[part];
      continue;
    }
    if (
      idx === 0 &&
      typeof schemaRoot === "object" &&
      typeof schemaRoot.schema === "object"
    ) {
      const schemaWrapper = schemaRoot.schema;
      if (part in schemaWrapper) {
        current = schemaWrapper[part];
        continue;
      }
    }
    throw new Error(`Ref '${ref}' could not be resolved at part '${part}'.`);
  }
  return current;
}

function getTypeStr(fieldSchema: Record<string, any>): string {
  if ("$ref" in fieldSchema) {
    return "reference";
  }
  if ("anyOf" in fieldSchema) {
    const types: string[] = [];
    for (const subSchema of fieldSchema.anyOf) {
      types.push(getTypeStr(subSchema));
    }
    const seen = new Set<string>();
    const uniqueTypes: string[] = [];
    for (const type of types) {
      if (!seen.has(type)) {
        seen.add(type);
        uniqueTypes.push(type);
      }
    }
    return uniqueTypes.join(" | ");
  }
  if ("enum" in fieldSchema) {
    return fieldSchema.enum
      .map((value: any) => JSON.stringify(value))
      .join(" | ");
  }
  if ("type" in fieldSchema) {
    const type = fieldSchema.type;
    if (type === "array" && "items" in fieldSchema) {
      const itemType = getTypeStr(fieldSchema.items);
      return `array of ${itemType}`;
    }
    return type;
  }
  return "unknown";
}

function processSchemaField(
  fieldName: string,
  fieldSchema: Record<string, any>,
  level: number,
  newLineSep: string = "\n",
  fieldNamePrefix: string = "",
): string {
  let markdown = "";
  const fieldNameComplete = fieldNamePrefix + fieldName;

  if ("$ref" in fieldSchema) {
    const refValue = fieldSchema.$ref;
    const header =
      "#".repeat(level) + ` ${fieldNameComplete} (reference to ${refValue})`;
    markdown += header + newLineSep;

    const description = fieldSchema.description;
    if (description !== undefined) {
      markdown += `<Description>\n${description}\n</Description>`;
    } else {
      markdown += `<Description>Reference to ${refValue}</Description>`;
    }

    markdown += newLineSep.repeat(2);
    return markdown;
  }

  const typeStr = getTypeStr(fieldSchema);
  const header = "#".repeat(level) + ` ${fieldNameComplete} (${typeStr})`;
  markdown += header + newLineSep;

  const description = fieldSchema.description;
  if (description !== undefined) {
    markdown += `<Description>\n${description}\n</Description>`;
  } else {
    markdown += "<Description></Description>";
  }

  markdown += newLineSep.repeat(2);

  if (fieldSchema.type === "object" && "properties" in fieldSchema) {
    for (const [subFieldName, subFieldSchema] of Object.entries(
      fieldSchema.properties,
    )) {
      markdown += processSchemaField(
        subFieldName,
        subFieldSchema as Record<string, any>,
        level + 1,
        newLineSep,
        fieldNameComplete + ".",
      );
    }
  } else if (fieldSchema.type === "array" && "items" in fieldSchema) {
    const itemsSchema = fieldSchema.items;
    if ("$ref" in itemsSchema) {
      const refValue = itemsSchema.$ref;
      markdown +=
        "#".repeat(level + 1) +
        ` ${fieldNameComplete}.* (reference to ${refValue})` +
        newLineSep;
      markdown +=
        `<Description>Array items reference ${refValue}</Description>` +
        newLineSep.repeat(2);
    } else if (itemsSchema.type === "object" && "properties" in itemsSchema) {
      markdown += processSchemaField(
        "*",
        itemsSchema,
        level + 1,
        newLineSep,
        fieldNameComplete + ".",
      );
    }
  }

  return markdown;
}

export function jsonSchemaToNlpDataStructure(
  schema: Record<string, any>,
): string {
  const schemaTitle = schema.title ?? schema.name ?? "Schema";
  let markdown = `## ${schemaTitle} -- NLP Data Structure\n\n`;

  const description = schema.description;
  if (description !== undefined) {
    markdown += `<User Prompt>\n${description}\n</User Prompt>`;
  }

  if (schema.type === "object" && "properties" in schema) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      markdown += processSchemaField(
        fieldName,
        fieldSchema as Record<string, any>,
        3,
      );
    }
  } else {
    markdown += processSchemaField("root", schema, 3);
  }

  const defs = schema.$defs ?? {};
  if (Object.keys(defs).length > 0) {
    markdown += "\n## Definitions\n\n";
    for (const [defName, defSchema] of Object.entries(defs)) {
      markdown += `### ${defName}\n\n`;

      const defDescription = (defSchema as Record<string, any>).description;
      if (defDescription !== undefined) {
        markdown += `<Description>\n${defDescription}\n</Description>\n\n`;
      } else {
        markdown += `<Description>Definition for ${defName}</Description>\n\n`;
      }

      const defSchemaObj = defSchema as Record<string, any>;
      if (defSchemaObj.type === "object" && "properties" in defSchemaObj) {
        for (const [propName, propSchema] of Object.entries(
          defSchemaObj.properties,
        )) {
          markdown += processSchemaField(
            propName,
            propSchema as Record<string, any>,
            4,
            "\n",
            `${defName}.`,
          );
        }
      } else {
        const typeStr = getTypeStr(defSchemaObj);
        markdown += `**Type**: ${typeStr}\n\n`;
      }
    }
  }

  return markdown;
}

export function getKeySchemaFromObjectSchemaAndKeyPath(
  objectSchema: Record<string, any>,
  keyPath: string,
) {
  const keyPathParts = keyPath.split(".");
  let currentSchema = objectSchema;

  for (const key of keyPathParts) {
    if (currentSchema.type === "object" && currentSchema.properties?.[key]) {
      currentSchema = currentSchema.properties[key];
    } else if (currentSchema.type === "array" && currentSchema.items) {
      currentSchema = currentSchema.items;
      if (currentSchema.type === "object" && currentSchema.properties?.[key]) {
        currentSchema = currentSchema.properties[key];
      } else {
        throw new Error(`Key path not found in object schema: ${keyPath}`);
      }
    } else {
      throw new Error(`Key path not found in object schema: ${keyPath}`);
    }
  }

  return currentSchema;
}

export function separateSchema(schema: any): any {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  if (schema.$ref) {
    return schema;
  }

  const result = { ...schema };

  if (schema.properties && typeof schema.properties === "object") {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        separateSchema(value),
      ]),
    );
  }

  if (schema.items) {
    result.items = separateSchema(schema.items);
  }

  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    result.anyOf = schema.anyOf.map((subschema: any) =>
      separateSchema(subschema),
    );
  }

  if (schema.$defs && typeof schema.$defs === "object") {
    result.$defs = Object.fromEntries(
      Object.entries(schema.$defs).map(([key, value]) => [
        key,
        separateSchema(value),
      ]),
    );
  }

  return result;
}
