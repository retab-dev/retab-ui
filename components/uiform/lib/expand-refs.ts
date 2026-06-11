// Pure JSON Schema $ref expansion utilities, lifted from the former UiForm
// component so json-form can keep using them after UiForm was removed.

export function mergeDescriptions(
  outerSchema: Record<string, any>,
  innerSchema: Record<string, any>,
): Record<string, any> {
  // Create deep copy of inner schema
  const merged = JSON.parse(JSON.stringify(innerSchema));

  // Outer description preferred if present
  if ("description" in outerSchema) {
    merged["description"] = outerSchema["description"];
  }

  // Outer reasoning preferred if present
  if ("X-ReasoningPrompt" in outerSchema) {
    merged["X-ReasoningPrompt"] = outerSchema["X-ReasoningPrompt"];
  } else if ("X-ReasoningPrompt" in innerSchema) {
    merged["X-ReasoningPrompt"] = innerSchema["X-ReasoningPrompt"];
  }

  // Outer LLM Description preferred if present

  // Add this: Merge X-EnumTranslation
  if ("X-EnumTranslation" in outerSchema) {
    merged["X-EnumTranslation"] = outerSchema["X-EnumTranslation"];
  } else if ("X-EnumTranslation" in innerSchema) {
    merged["X-EnumTranslation"] = innerSchema["X-EnumTranslation"];
  }

  // Add this: Merge X-FieldTranslation
  if ("X-FieldTranslation" in outerSchema) {
    merged["X-FieldTranslation"] = outerSchema["X-FieldTranslation"];
  } else if ("X-FieldTranslation" in innerSchema) {
    merged["X-FieldTranslation"] = innerSchema["X-FieldTranslation"];
  }

  return merged;
}

export function expandRefs(
  schema: Record<string, any>,
  definitions: Record<string, Record<string, any>> | null = null,
  visited: Set<string> = new Set(),
): Record<string, any> {
  // Return non-object schemas as-is
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  // Initialize definitions from schema if not provided
  // Support both $defs (draft 2019-09+) and definitions (draft-07)
  if (!definitions) {
    const defs = schema.$defs
      ? { ...schema.$defs }
      : schema.definitions
        ? { ...schema.definitions }
        : {};
    definitions = defs;
  }

  if (!definitions || typeof definitions !== "object") {
    throw new Error("Definitions must be an object");
  }

  // Handle allOf - merge all elements
  if (
    "allOf" in schema &&
    Array.isArray(schema.allOf) &&
    schema.allOf.length > 0
  ) {
    const allOfElements = schema.allOf;
    delete schema.allOf;
    // Merge all allOf elements into the schema
    for (const element of allOfElements) {
      if (typeof element === "object" && element !== null) {
        // Recursively expand refs in each allOf element first
        const expanded = expandRefs(element, definitions, visited);
        // Deep merge properties if both have them
        if (expanded.properties && schema.properties) {
          schema.properties = { ...schema.properties, ...expanded.properties };
          delete expanded.properties;
        }
        // Merge required arrays if both have them
        if (expanded.required && schema.required) {
          schema.required = [
            ...new Set([...schema.required, ...expanded.required]),
          ];
          delete expanded.required;
        }
        Object.assign(schema, expanded);
      }
    }
  }

  // Handle $ref - support both #/$defs/ and #/definitions/ formats
  if ("$ref" in schema) {
    const ref: string = schema.$ref;
    let defName: string | null = null;

    if (ref.startsWith("#/$defs/")) {
      defName = ref.replace("#/$defs/", "");
    } else if (ref.startsWith("#/definitions/")) {
      defName = ref.replace("#/definitions/", "");
    }

    if (defName !== null) {
      // Detect circular reference - return schema as-is to break the cycle
      if (visited.has(defName)) {
        return schema;
      }

      if (!(defName in definitions)) {
        // Return the original schema if reference is not found
        return schema;
      }

      // Mark this definition as being visited
      const newVisited = new Set(visited);
      newVisited.add(defName);

      const target = definitions[defName];
      const merged = mergeDescriptions(schema, target);
      delete merged.$ref;
      return expandRefs(merged, definitions, newVisited);
    } else {
      throw new Error(`Unsupported reference format: ${ref}`);
    }
  }

  const result: Record<string, any> = {};

  // Process each property
  for (const [key, value] of Object.entries(schema)) {
    // Handle properties, $defs, and definitions (draft-07) keys
    if (key === "properties" || key === "$defs" || key === "definitions") {
      if (typeof value === "object" && value !== null) {
        const newDict: Record<string, any> = {};
        for (const [pk, pv] of Object.entries(value)) {
          newDict[pk] = expandRefs(
            pv as Record<string, any>,
            definitions,
            visited,
          );
        }
        result[key] = newDict;
      } else {
        result[key] = value;
      }
    } else if (key === "items") {
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          expandRefs(item, definitions, visited),
        );
      } else {
        result[key] = expandRefs(value, definitions, visited);
      }
    } else {
      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value)) {
          result[key] = value.map((item) =>
            typeof item === "object" && item !== null
              ? expandRefs(item, definitions, visited)
              : item,
          );
        } else {
          result[key] = expandRefs(value, definitions, visited);
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}

