import {
  addDefinition,
  nodeFromJson,
  setRef,
  type SchemaDocument,
} from "@/components/schema-editor/document";
import type { ExtendedJSONSchema7 } from "@/components/schema-editor/lib/json-schema-types";

import {
  updateEffectiveNode,
} from "../../draft/draft-node-edits";
import { templateObjects } from "./template-objects";

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
      const result = replaceSchemaNodeByReference(item, targetNode, updatedNode);
      if (result.didReplace) didReplace = true;
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
      if (result.didReplace) didReplace = true;
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

export function applyObjectTemplateReferenceToDocument(
  doc: SchemaDocument,
  nodeId: string,
  templateName: string,
): SchemaDocument {
  const next = addObjectTemplateDefinitionsToDocument(doc, templateName);
  const targetDefinition = next.defs.find(
    (definition) => definition.name === templateName,
  );
  return targetDefinition ? setRef(next, nodeId, targetDefinition.id) : next;
}

export function addObjectTemplateDefinitionsToDocument(
  doc: SchemaDocument,
  templateName: string,
): SchemaDocument {
  const template = templateObjects[templateName];
  if (!template) return doc;

  const defsToAdd = [templateName];
  if (template.deps) {
    defsToAdd.push(...template.deps);
  }

  let next = doc;
  for (const defName of defsToAdd) {
    if (next.defs.some((definition) => definition.name === defName)) continue;

    const templateNode = templateObjects[defName];
    if (!templateNode) continue;

    next = addDefinition(next, {
      name: defName,
      node: nodeFromJson(templateNode, next),
    }).doc;
  }

  return next;
}
