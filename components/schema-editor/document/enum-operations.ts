import { mapPreserve } from "@/components/schema-editor/document/array";
import { getEffectiveDocNode } from "@/components/schema-editor/document/node-selectors";
import { updateNode } from "@/components/schema-editor/document/node-update";
import { getNode } from "@/components/schema-editor/document/traversal";
import {
  createNode,
  createEnumValue,
  stripSchemaTypeSpecificRest,
  updateEffectiveNodeShape,
} from "@/components/schema-editor/document/type-operations";
import type {
  DocumentNode,
  EnumValue,
  JsonValue,
  SchemaDocument,
} from "@/components/schema-editor/document/types";

const ENUM_DESCRIPTIONS_KEY = "x-enumDescriptions";

export function addEnumValue(
  doc: SchemaDocument,
  id: string,
  value: JsonValue = "",
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    if (isTypeArrayNullable(node) && node.enum) {
      const nextEnum = [...node.enum, { ...createEnumValue(), value }];
      return createNullableEnumWrapper(
        node,
        nextEnum,
        remapEnumDescriptions(node.rest, node.enum, nextEnum),
      );
    }

    return updateEffectiveNodeShape(node, (effective) => {
      const previousEnum = effective.enum ?? [];
      const nextEnum = [...previousEnum, { ...createEnumValue(), value }];

      return {
        ...effective,
        enum: nextEnum,
        rest: remapEnumDescriptions(effective.rest, previousEnum, nextEnum),
      };
    });
  });
}

export function updateEnumValue(
  doc: SchemaDocument,
  id: string,
  enumId: string,
  patch: Partial<Omit<EnumValue, "id">>,
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    if (isTypeArrayNullable(node) && node.enum) {
      const nextEnum = mapPreserve(node.enum, (value) =>
        value.id === enumId ? { ...value, ...patch } : value,
      );
      return createNullableEnumWrapper(
        node,
        nextEnum,
        remapEnumDescriptions(node.rest, node.enum, nextEnum),
      );
    }

    return updateEffectiveNodeShape(node, (effective) => {
      const previousEnum = effective.enum ?? [];
      const nextEnum = mapPreserve(previousEnum, (value) =>
        value.id === enumId ? { ...value, ...patch } : value,
      );

      return {
        ...effective,
        enum: nextEnum,
        rest: remapEnumDescriptions(effective.rest, previousEnum, nextEnum),
      };
    });
  });
}

export function removeEnumValue(
  doc: SchemaDocument,
  id: string,
  enumId: string,
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    if (isTypeArrayNullable(node) && node.enum) {
      const nextEnum = node.enum.filter((value) => value.id !== enumId);
      return createNullableEnumWrapper(
        node,
        nextEnum,
        remapEnumDescriptions(node.rest, node.enum, nextEnum),
      );
    }

    return updateEffectiveNodeShape(node, (effective) => {
      const previousEnum = effective.enum ?? [];
      const nextEnum = previousEnum.filter((value) => value.id !== enumId);

      return {
        ...effective,
        enum: nextEnum,
        rest: remapEnumDescriptions(effective.rest, previousEnum, nextEnum),
      };
    });
  });
}

export function setEnumValues(
  doc: SchemaDocument,
  id: string,
  values: JsonValue[],
): SchemaDocument {
  return updateNode(doc, id, (node) => {
    if (isTypeArrayNullable(node)) {
      const nextEnum = buildEnumValues(values, node.enum);
      return createNullableEnumWrapper(
        node,
        nextEnum,
        remapEnumDescriptions(node.rest, node.enum, nextEnum),
      );
    }

    return updateEffectiveNodeShape(node, (effective) => {
      const nextEnum = buildEnumValues(values, effective.enum);
      const rest = stripSchemaRestForEnum(
        remapEnumDescriptions(effective.rest, effective.enum, nextEnum),
      );
      return {
        ...effective,
        type: "string",
        enum: nextEnum,
        rest,
        booleanSchema: undefined,
      };
    });
  });
}

export function updateEnumValueAtIndex(
  doc: SchemaDocument,
  id: string,
  index: number,
  value: JsonValue,
): SchemaDocument {
  const node = getNode(doc, id);
  if (!node) return doc;

  const enumId = getEffectiveDocNode(node).enum?.[index]?.id;
  return enumId ? updateEnumValue(doc, id, enumId, { value }) : doc;
}

export function removeEnumValueAtIndex(
  doc: SchemaDocument,
  id: string,
  index: number,
): SchemaDocument {
  const node = getNode(doc, id);
  if (!node) return doc;

  const enumId = getEffectiveDocNode(node).enum?.[index]?.id;
  return enumId ? removeEnumValue(doc, id, enumId) : doc;
}

function buildEnumValues(
  values: JsonValue[],
  existing?: EnumValue[],
): EnumValue[] {
  return values.map((value, index) => ({
    ...(existing?.[index] ?? createEnumValue()),
    value,
  }));
}

function isTypeArrayNullable(node: DocumentNode): boolean {
  return Array.isArray(node.type) && node.type.includes("null");
}

function createEnumNode(
  values: JsonValue[],
  existing?: EnumValue[],
): DocumentNode {
  return createEnumNodeFromEntries(buildEnumValues(values, existing));
}

function createEnumNodeFromEntries(enumEntries: EnumValue[]): DocumentNode {
  const node = createNode("string");
  return {
    ...node,
    type: "string",
    enum: enumEntries,
  };
}

function createNullableEnumWrapper(
  node: DocumentNode,
  enumEntries: EnumValue[],
  rest: Record<string, unknown> = node.rest,
): DocumentNode {
  return {
    ...node,
    type: undefined,
    properties: undefined,
    items: undefined,
    enum: undefined,
    ref: undefined,
    rest: stripSchemaRestForEnum(rest),
    order: undefined,
    booleanSchema: undefined,
    anyOf: [createEnumNodeFromEntries(enumEntries), { ...createNode("null") }],
  };
}

function stripSchemaRestForEnum(
  rest: Record<string, unknown>,
): Record<string, unknown> {
  const descriptions = rest[ENUM_DESCRIPTIONS_KEY];
  const next = { ...stripSchemaTypeSpecificRest(rest) };
  if (isPlainRecord(descriptions)) {
    next[ENUM_DESCRIPTIONS_KEY] = descriptions;
  }
  return next;
}

function remapEnumDescriptions(
  rest: Record<string, unknown>,
  previousEntries: EnumValue[] | undefined,
  nextEntries: EnumValue[],
): Record<string, unknown> {
  const descriptions = rest[ENUM_DESCRIPTIONS_KEY];
  if (!isPlainRecord(descriptions)) return rest;

  const previousById = new Map(
    previousEntries?.map((entry) => [entry.id, entry]) ?? [],
  );
  const nextDescriptions: Record<string, unknown> = {};
  for (let index = 0; index < nextEntries.length; index += 1) {
    const nextEntry = nextEntries[index];
    const previous = previousById.get(nextEntry.id) ?? previousEntries?.[index];
    if (!previous) continue;
    const previousKey = enumDescriptionKey(previous.value);
    if (!hasOwn(descriptions, previousKey)) continue;
    nextDescriptions[enumDescriptionKey(nextEntry.value)] =
      descriptions[previousKey];
  }

  const next = { ...rest };
  if (Object.keys(nextDescriptions).length > 0) {
    next[ENUM_DESCRIPTIONS_KEY] = nextDescriptions;
  } else {
    delete next[ENUM_DESCRIPTIONS_KEY];
  }
  return next;
}

function enumDescriptionKey(value: JsonValue): string {
  return String(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}
