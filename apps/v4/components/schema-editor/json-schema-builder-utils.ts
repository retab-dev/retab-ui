"use client";

import { JSONSchema7Definition } from "json-schema";

import { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";
import { getEffectiveNode } from "@/components/schema-editor/lib/json-schema-utils";
import { templateObjects } from "./template-objects";

export function formatTitle(rawName: string): string {
  return rawName
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase(),
    )
    .join("");
}

export function getEffectiveType(node: ExtendedJSONSchema7): {
  type: string;
  isNullable: boolean;
} {
  if (node.anyOf && Array.isArray(node.anyOf)) {
    const nonNull = node.anyOf.find(
      (branch: JSONSchema7Definition) =>
        typeof branch === "object" &&
        (branch.type !== "null" || branch.$ref || branch.enum),
    );
    const isNullable = node.anyOf.some(
      (branch: JSONSchema7Definition) =>
        typeof branch === "object" && branch.type === "null",
    );
    if (nonNull && typeof nonNull === "object") {
      if (nonNull.$ref) return { type: "$ref", isNullable };
      if (nonNull.enum) return { type: "enum", isNullable };
      if (nonNull.type === "string" && nonNull.format === "date") {
        return { type: "date", isNullable };
      }
      if (nonNull.type === "string" && nonNull.format === "iso-time") {
        return { type: "time", isNullable };
      }
      if (nonNull.type === "string" && nonNull.format === "date-time") {
        return { type: "datetime", isNullable };
      }
      return { type: nonNull.type?.toString() || "string", isNullable };
    }
    return { type: "string", isNullable };
  }
  if (node.enum) {
    return { type: "enum", isNullable: false };
  }
  if (node.$ref) {
    return { type: "$ref", isNullable: false };
  }
  if (node.type === "string" && node.format === "date") {
    return { type: "date", isNullable: false };
  }
  if (node.type === "string" && node.format === "iso-time") {
    return { type: "time", isNullable: false };
  }
  if (node.type === "string" && node.format === "date-time") {
    return { type: "datetime", isNullable: false };
  }
  return { type: node.type?.toString() || "string", isNullable: false };
}

export function defaultSchemaForType(type: string): ExtendedJSONSchema7 {
  switch (type) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "integer":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    case "object":
      return { type: "object", properties: {}, required: [] };
    case "array":
      return { type: "array", items: { type: "string" } };
    case "$ref":
      return {} as ExtendedJSONSchema7;
    case "enum":
      return { enum: [], type: "string" };
    case "date":
      return { type: "string", format: "date" };
    case "time":
      return { type: "string", format: "iso-time" };
    case "datetime":
      return { type: "string", format: "date-time" };
    default:
      return { type: "string" };
  }
}

export function updateType(
  newType: string,
  nullable: boolean,
  oldNode: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  const meta: Partial<ExtendedJSONSchema7> = {};
  if (oldNode.title) meta.title = oldNode.title;
  if (oldNode.description) meta.description = oldNode.description;

  let baseSchema = defaultSchemaForType(newType);

  if (newType === "array") {
    baseSchema = {
      type: "array",
      items: oldNode.type === "object" ? oldNode : { type: "string" },
    };
  } else if (newType === "enum") {
    baseSchema = {
      type: "string",
      enum: oldNode.enum || [],
    };
  }

  if (nullable) {
    const nullSchema: ExtendedJSONSchema7 = { type: "null" };
    return {
      anyOf: [baseSchema, nullSchema],
      ...meta,
    } as ExtendedJSONSchema7;
  }
  return { ...baseSchema, ...meta };
}

export function setNullable(
  node: ExtendedJSONSchema7,
  nullable: boolean,
): ExtendedJSONSchema7 {
  const {
    title,
    description,
    "X-ReasoningPrompt": reasoningPrompt,
    "X-Reasoning": reasoningEnabled,
    ...rest
  } = node;

  if (nullable) {
    if (node.anyOf && Array.isArray(node.anyOf)) {
      const nonNullBranch = node.anyOf.find(
        (branch: JSONSchema7Definition) =>
          typeof branch === "object" && (branch.type !== "null" || branch.$ref),
      );
      const nonNullObj = typeof nonNullBranch === "object" ? nonNullBranch : {};

      return {
        anyOf: [{ ...nonNullObj }, { type: "null" }],
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(reasoningPrompt !== undefined
          ? { "X-ReasoningPrompt": reasoningPrompt }
          : {}),
        ...(reasoningEnabled ? { "X-Reasoning": true } : {}),
      };
    }

    return {
      anyOf: [{ ...rest }, { type: "null" }],
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(reasoningPrompt !== undefined
        ? { "X-ReasoningPrompt": reasoningPrompt }
        : {}),
      ...(reasoningEnabled ? { "X-Reasoning": true } : {}),
    };
  }

  if (node.anyOf && Array.isArray(node.anyOf)) {
    const nonNullBranch = node.anyOf.find(
      (branch: JSONSchema7Definition) =>
        typeof branch === "object" && (branch.type !== "null" || branch.$ref),
    );
    const nonNullObj = typeof nonNullBranch === "object" ? nonNullBranch : {};

    return {
      ...nonNullObj,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(reasoningPrompt !== undefined
        ? { "X-ReasoningPrompt": reasoningPrompt }
        : {}),
      ...(reasoningEnabled ? { "X-Reasoning": true } : {}),
    };
  }

  return node;
}

export function updateEffectiveNode(
  node: ExtendedJSONSchema7,
  updatedEffective: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  if (node.anyOf && Array.isArray(node.anyOf)) {
    const newAnyOf = node.anyOf.map((branch: JSONSchema7Definition) =>
      typeof branch === "object" && branch.type === "null"
        ? branch
        : updatedEffective,
    );
    return { ...node, anyOf: newAnyOf };
  }
  return updatedEffective;
}

export function updateNodeWithMetadata(
  node: ExtendedJSONSchema7,
  metadata: Partial<ExtendedJSONSchema7>,
): ExtendedJSONSchema7 {
  if (node.anyOf && Array.isArray(node.anyOf)) {
    const nonNullIndex = node.anyOf.findIndex(
      (branch: JSONSchema7Definition) =>
        typeof branch === "object" && (branch.type !== "null" || branch.$ref),
    );
    if (nonNullIndex !== -1) {
      const currentBranch = node.anyOf[nonNullIndex];
      if (typeof currentBranch === "object") {
        const pureBranch = defaultSchemaForType(
          typeof currentBranch.type === "string"
            ? currentBranch.type
            : "string",
        );
        const nullBranch = node.anyOf.find(
          (branch: JSONSchema7Definition) =>
            typeof branch === "object" && branch.type === "null",
        ) || { type: "null" };

        const result = {
          ...node,
          anyOf: [pureBranch, nullBranch],
          ...metadata,
        };
        if (!result["X-Reasoning"]) delete result["X-Reasoning"];
        if (!result["X-ReasoningPrompt"]) delete result["X-ReasoningPrompt"];
        return result;
      }
    }
  }
  const result = { ...node, ...metadata };
  if (!result["X-Reasoning"]) delete result["X-Reasoning"];
  if (!result["X-ReasoningPrompt"]) delete result["X-ReasoningPrompt"];
  return result;
}

export function updateSchemaProperty(
  schema: ExtendedJSONSchema7,
  propertyKey: string,
  newPropertyName: string,
  updatedProperty: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  const effective = getEffectiveNode(updatedProperty);
  const cleanProperty = {
    ...effective,
    title: formatTitle(newPropertyName),
    ...(Array.isArray(effective.enum) && { type: "string" }),
  } as ExtendedJSONSchema7;
  const finalProperty = updateEffectiveNode(updatedProperty, cleanProperty);

  const oldProperties = schema.properties || {};
  const newProperties: Record<string, ExtendedJSONSchema7> = {};
  let found = false;

  Object.keys(oldProperties).forEach((key) => {
    if (key === propertyKey && newPropertyName !== propertyKey) {
      newProperties[newPropertyName] = finalProperty;
      found = true;
    } else if (isJSONSchema(oldProperties[key])) {
      newProperties[key] = oldProperties[key] as ExtendedJSONSchema7;
    }
  });

  if (!found && newPropertyName !== propertyKey) {
    newProperties[newPropertyName] = finalProperty;
    delete newProperties[propertyKey];
  }

  if (newPropertyName !== propertyKey) {
    const newRequired = Array.isArray(schema.required)
      ? schema.required.map((req: string) =>
          req === propertyKey ? newPropertyName : req,
        )
      : [];

    return {
      ...schema,
      properties: newProperties,
      required: newRequired,
    };
  }

  return {
    ...schema,
    properties: {
      ...newProperties,
      [propertyKey]: finalProperty,
    },
  };
}

function traverseSchemaProperty(
  schema: ExtendedJSONSchema7,
  seg: string,
): ExtendedJSONSchema7 {
  if (
    (schema as ExtendedJSONSchema7).anyOf &&
    Array.isArray((schema as ExtendedJSONSchema7).anyOf)
  ) {
    return traverseSchemaProperty(getEffectiveNode(schema), seg);
  }
  if (schema.type === "object" && schema.properties) {
    return schema.properties[seg] as ExtendedJSONSchema7;
  }
  if (schema.type === "array" && schema.items) {
    if (Array.isArray(schema.items)) {
      return schema.items[parseInt(seg)] as ExtendedJSONSchema7;
    }
    if (seg === "*") {
      return schema.items as ExtendedJSONSchema7;
    }
  }
  throw new Error(`Invalid path segment "${seg}"`);
}

function assignSchemaProperty(
  schema: ExtendedJSONSchema7,
  seg: string,
  value: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  if (
    (schema as ExtendedJSONSchema7).anyOf &&
    Array.isArray((schema as ExtendedJSONSchema7).anyOf)
  ) {
    const updatedEffective = assignSchemaProperty(
      getEffectiveNode(schema),
      seg,
      value,
    );
    return updateEffectiveNode(schema, updatedEffective);
  }
  if (schema.type === "object" && schema.properties) {
    return {
      ...schema,
      properties: {
        ...schema.properties,
        [seg]: value,
      },
    };
  }
  if (schema.type === "array" && schema.items) {
    if (Array.isArray(schema.items)) {
      return {
        ...schema,
        items: schema.items.map((item, index) =>
          index === parseInt(seg) ? value : item,
        ),
      };
    }
    if (seg === "*") {
      return {
        ...schema,
        items: value,
      };
    }
  }
  throw new Error(`Invalid path segment "${seg}"`);
}

function resolvePropertyPath(
  schema: ExtendedJSONSchema7,
  path: string,
): [string[], string[]] {
  let basePath: string[] = [];
  let propPath: string[] = [];
  let curNode = schema;

  for (const seg of path.split(".")) {
    while (curNode.$ref) {
      const refPath = curNode.$ref.split("/");
      if (refPath.shift() !== "#") {
        throw new Error(`Invalid $ref "${curNode.$ref}"`);
      }
      basePath = refPath;
      propPath = [];
      curNode = refPath.reduce(
        (acc, refSeg) => (acc as Record<string, any>)[refSeg],
        schema as Record<string, any>,
      );
    }

    if (
      (curNode as ExtendedJSONSchema7).anyOf &&
      Array.isArray((curNode as ExtendedJSONSchema7).anyOf)
    ) {
      curNode = getEffectiveNode(curNode);
    }

    if (curNode.type === "object" && curNode.properties) {
      propPath.push(seg);
      curNode = curNode.properties[seg] as ExtendedJSONSchema7;
    } else if (curNode.type === "array" && curNode.items) {
      if (Array.isArray(curNode.items)) {
        propPath.push(seg);
        curNode = curNode.items[parseInt(seg)] as ExtendedJSONSchema7;
      } else if (seg === "*" || seg === parseInt(seg).toString()) {
        propPath.push("*");
        curNode = curNode.items as ExtendedJSONSchema7;
      } else {
        throw new Error(`Invalid path segment "${seg}" for array type`);
      }
    }
  }

  return [basePath, propPath];
}

export function renamePropertyAtPath(
  schema: ExtendedJSONSchema7,
  propertyPath: string,
  newPropertyName: string,
  updatedProperty?: ExtendedJSONSchema7,
): ExtendedJSONSchema7 {
  const [basePath, propPath] = resolvePropertyPath(schema, propertyPath);

  function helper(
    node: ExtendedJSONSchema7,
    segs: string[],
  ): ExtendedJSONSchema7 {
    if (segs.length === 0) return node;
    const [seg, ...rest] = segs;
    if (rest.length === 0) {
      const current = (node.properties || {})[seg] as ExtendedJSONSchema7;
      const nextProperty = updatedProperty ?? current;
      return updateSchemaProperty(node, seg, newPropertyName, nextProperty);
    }
    return assignSchemaProperty(
      node,
      seg,
      helper(traverseSchemaProperty(node, seg), rest),
    );
  }

  function baseHelper(
    node: ExtendedJSONSchema7,
    segs: string[],
  ): ExtendedJSONSchema7 {
    if (segs.length === 0) {
      const baseNode = basePath.reduce(
        (acc: Record<string, any>, seg) => acc[seg],
        schema as Record<string, any>,
      );
      return helper(baseNode as ExtendedJSONSchema7, propPath);
    }
    const [seg, ...rest] = segs;
    return {
      ...node,
      [seg]: baseHelper(
        (node as Record<string, any>)[seg] as ExtendedJSONSchema7,
        rest,
      ),
    };
  }

  return baseHelper(schema, basePath);
}

function replaceSchemaNodeByReference(
  value: unknown,
  targetNode: ExtendedJSONSchema7,
  updatedNode: ExtendedJSONSchema7,
): {
  nextValue: unknown;
  didReplace: boolean;
} {
  if (value === targetNode) {
    return {
      nextValue: updatedNode,
      didReplace: true,
    };
  }

  if (Array.isArray(value)) {
    let didReplace = false;
    const nextValue = value.map((item) => {
      const result = replaceSchemaNodeByReference(
        item,
        targetNode,
        updatedNode,
      );
      if (result.didReplace) {
        didReplace = true;
      }
      return result.nextValue;
    });

    return {
      nextValue: didReplace ? nextValue : value,
      didReplace,
    };
  }

  if (value && typeof value === "object") {
    let didReplace = false;
    const nextEntries = Object.entries(value).map(([key, childValue]) => {
      const result = replaceSchemaNodeByReference(
        childValue,
        targetNode,
        updatedNode,
      );
      if (result.didReplace) {
        didReplace = true;
      }
      return [key, result.nextValue] as const;
    });

    return {
      nextValue: didReplace ? Object.fromEntries(nextEntries) : value,
      didReplace,
    };
  }

  return {
    nextValue: value,
    didReplace: false,
  };
}

export function applyObjectTemplateReference(
  schema: ExtendedJSONSchema7,
  targetNode: ExtendedJSONSchema7,
  templateName: string,
): {
  schema: ExtendedJSONSchema7;
  didUpdateTarget: boolean;
} {
  const template = templateObjects[templateName];
  if (!template) {
    return {
      schema,
      didUpdateTarget: false,
    };
  }

  const defsToAdd = [templateName];
  if (template.deps) {
    defsToAdd.push(...template.deps);
  }

  const nextDefs = { ...(schema.$defs || {}) };
  for (const defName of defsToAdd) {
    if (!nextDefs[defName]) {
      nextDefs[defName] = templateObjects[defName];
    }
  }

  const schemaWithDefs = {
    ...schema,
    $defs: nextDefs,
  };
  const updatedNode = updateEffectiveNode(targetNode, {
    $ref: `#/$defs/${templateName}`,
  });
  const result = replaceSchemaNodeByReference(
    schemaWithDefs,
    targetNode,
    updatedNode,
  );

  return {
    schema: result.nextValue as ExtendedJSONSchema7,
    didUpdateTarget: result.didReplace,
  };
}

function isJSONSchema(
  value: JSONSchema7Definition,
): value is ExtendedJSONSchema7 {
  return typeof value === "object" && value !== null;
}
