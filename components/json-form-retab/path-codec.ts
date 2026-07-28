import {
  arrayItemSchemaAt,
  dynamicPropertySchemaFor,
  emptyValueFor,
  fieldKind,
  isRecordValue,
  schemaPatternProperties,
  schemaProperties,
  unwrapNullable,
  type Schema,
} from "@/components/json-form-retab/schema-model";

export function encodeJsonFormKey(segment: string): string {
  return encodeURIComponent(segment)
    .replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(
      /[.[\]'"]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

export function decodeJsonFormKey(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function joinJsonFormPath(parent: string, key: string | number): string {
  const segment =
    typeof key === "number" ? String(key) : encodeJsonFormKey(key);
  return parent ? `${parent}.${segment}` : segment;
}

export function joinJsonSourcePath(
  parent: string,
  key: string | number,
): string {
  const segment = String(key);
  return parent ? `${parent}.${segment}` : segment;
}

export function staticPropertyKeys(schema: Schema): Set<string> {
  return new Set(
    Object.keys(schemaProperties(schema)).flatMap((key) => [
      key,
      encodeJsonFormKey(key),
    ]),
  );
}

export function dynamicPropertyEntries(
  schema: Schema,
  currentValue: unknown,
  staticKeys: Set<string>,
): Array<{ key: string; schema: Schema }> {
  if (!isRecordValue(currentValue)) return [];
  return Object.keys(currentValue).flatMap((key) => {
    if (staticKeys.has(key)) return [];
    const decodedKey = decodeJsonFormKey(key);
    if (staticKeys.has(decodedKey)) return [];
    const childSchema = dynamicPropertySchemaFor(schema, decodedKey);
    return childSchema ? [{ key: decodedKey, schema: childSchema }] : [];
  });
}

export function schemaNeedsJsonFormPathEncoding(schema: Schema): boolean {
  const { schema: inner } = unwrapNullable(schema);
  const kind = fieldKind(inner);
  if (kind === "object") {
    const properties = schemaProperties(inner);
    const patternProperties = schemaPatternProperties(inner);
    return (
      isRecordValue(inner.additionalProperties) ||
      Object.values(patternProperties).some(isRecordValue) ||
      Object.entries(properties).some(([key, child]) => {
        return (
          encodeJsonFormKey(key) !== key ||
          (typeof child === "object" &&
            child !== null &&
            schemaNeedsJsonFormPathEncoding(child))
        );
      })
    );
  }
  if (kind === "array" && typeof inner.items === "object" && inner.items) {
    if (Array.isArray(inner.items)) {
      return inner.items.some((item) =>
        isRecordValue(item)
          ? schemaNeedsJsonFormPathEncoding(item as Schema)
          : false,
      );
    }
    return schemaNeedsJsonFormPathEncoding(inner.items as Schema);
  }
  return false;
}

export function encodeJsonFormValue(schema: Schema, value: unknown): unknown {
  const { schema: inner } = unwrapNullable(schema);
  const kind = fieldKind(inner);

  if (kind === "array") {
    if (!Array.isArray(value)) return value;
    return value.map((item, index) =>
      encodeJsonFormValue(arrayItemSchemaAt(inner, index), item),
    );
  }

  if (kind !== "object" || !isRecordValue(value)) return value;

  const properties = schemaProperties(inner);
  const encoded: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(properties)) {
    if (typeof child !== "object" || child === null) continue;
    const encodedKey = encodeJsonFormKey(key);
    const rawValue = Object.prototype.hasOwnProperty.call(value, key)
      ? value[key]
      : value[encodedKey];
    if (
      rawValue !== undefined ||
      Object.prototype.hasOwnProperty.call(value, key)
    ) {
      encoded[encodedKey] = encodeJsonFormValue(child, rawValue);
    }
  }
  const propertyKeys = new Set(Object.keys(properties));
  for (const [key, rawValue] of Object.entries(value)) {
    const decodedKey = decodeJsonFormKey(key);
    if (propertyKeys.has(key) || propertyKeys.has(decodedKey)) continue;
    const childSchema = dynamicPropertySchemaFor(inner, decodedKey);
    if (!childSchema) continue;
    encoded[encodeJsonFormKey(decodedKey)] = encodeJsonFormValue(
      childSchema,
      rawValue,
    );
  }
  return encoded;
}

export function decodeJsonFormValue(schema: Schema, value: unknown): unknown {
  const { schema: inner } = unwrapNullable(schema);
  const kind = fieldKind(inner);

  if (kind === "array") {
    if (!Array.isArray(value)) return value;
    return value.map((item, index) =>
      decodeJsonFormValue(arrayItemSchemaAt(inner, index), item),
    );
  }

  if (kind !== "object" || !isRecordValue(value)) return value;

  const properties = schemaProperties(inner);
  const decoded: Record<string, unknown> = {};
  const handledKeys = new Set<string>();
  for (const [key, child] of Object.entries(properties)) {
    if (typeof child !== "object" || child === null) continue;
    const encodedKey = encodeJsonFormKey(key);
    const hasEncoded = Object.prototype.hasOwnProperty.call(value, encodedKey);
    const rawValue = hasEncoded ? value[encodedKey] : value[key];
    handledKeys.add(encodedKey);
    handledKeys.add(key);
    if (
      rawValue !== undefined ||
      hasEncoded ||
      Object.prototype.hasOwnProperty.call(value, key)
    ) {
      decoded[key] = decodeJsonFormValue(child, rawValue);
    }
  }
  for (const [key, rawValue] of Object.entries(value)) {
    const decodedKey = decodeJsonFormKey(key);
    if (handledKeys.has(key) || handledKeys.has(decodedKey)) continue;
    const childSchema = dynamicPropertySchemaFor(inner, decodedKey);
    if (!childSchema) continue;
    decoded[decodedKey] = decodeJsonFormValue(childSchema, rawValue);
  }
  return decoded;
}

export function emptyArrayItemFormValue(schema: Schema): unknown {
  const { schema: inner, nullable } = unwrapNullable(schema);
  if (nullable) return null;
  if (fieldKind(inner) !== "object") return emptyValueFor(inner);

  const value: Record<string, unknown> = {};
  const shouldEncodeKeys = schemaNeedsJsonFormPathEncoding(inner);
  for (const [key, child] of Object.entries(schemaProperties(inner))) {
    if (typeof child === "object" && child !== null) {
      value[shouldEncodeKeys ? encodeJsonFormKey(key) : key] =
        emptyValueFor(child);
    }
  }
  return value;
}
