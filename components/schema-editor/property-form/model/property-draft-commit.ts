import { formatTitle } from "@/components/schema-editor/schema-title";
import type { PropertyDraft } from "@/components/schema-editor/property-form/types";

export function buildCommittedDraft(
  propertyDraft: PropertyDraft,
): PropertyDraft {
  return {
    ...propertyDraft,
    schemaNode: {
      ...propertyDraft.schemaNode,
      title: formatTitle(propertyDraft.name),
    },
  };
}
