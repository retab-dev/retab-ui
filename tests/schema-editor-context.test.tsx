// @vitest-environment jsdom
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import type { JSONSchema7 } from "json-schema";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromJsonSchema } from "@/components/schema-editor/document/convert";
import { useDocumentDefinitionsEditorController } from "@/components/schema-editor/document-definitions-editor-controller";
import { useDocumentNodeHeaderController } from "@/components/schema-editor/document-node-header-controller";
import {
  getChildNodeId,
  getChildPropertyId,
} from "@/components/schema-editor/document/node-selectors";
import { getSchemaDocumentView } from "@/components/schema-editor/document/view-model";
import {
  addProperty,
  renameProperty,
} from "@/components/schema-editor/document/property-operations";
import { requireAllProperties } from "@/components/schema-editor/schema-required-policy";
import { useSchemaBuilderState } from "@/components/schema-editor/use-schema-builder-state";
import { useKeyedMountEffect } from "@/hooks/use-keyed-mount-effect";
import { joinEffectKey } from "@/lib/effect-key";

afterEach(cleanup);

type Ctx = ReturnType<typeof useSchemaBuilderState>;

function Capture({
  apiRef,
  schema,
  onValueChange,
  onPersist,
  readOnly,
}: {
  apiRef: { current: Ctx | null };
  schema: JSONSchema7;
  onValueChange: (schema: JSONSchema7) => void;
  onPersist?: (schema: JSONSchema7) => Promise<void>;
  readOnly?: boolean;
}) {
  const ctx = useSchemaBuilderState({
    value: schema,
    onValueChange: (next) => onValueChange(next as JSONSchema7),
    onPersist: onPersist ? (next) => onPersist(next as JSONSchema7) : undefined,
    readOnly,
  });
  apiRef.current = ctx;
  return null;
}

/** Controlled harness: a parent owns the schema, exactly like the dashboard. */
function renderProvider(
  initial: JSONSchema7,
  options: {
    onPersist?: (schema: JSONSchema7) => Promise<void>;
    readOnly?: boolean;
  } = {},
) {
  const apiRef: { current: Ctx | null } = { current: null };
  const onEmit = vi.fn<(s: JSONSchema7) => void>();
  function Harness() {
    const [schema, setSchema] = React.useState(initial);
    return (
      <Capture
        apiRef={apiRef}
        schema={schema}
        onPersist={options.onPersist}
        readOnly={options.readOnly}
        onValueChange={(next) => {
          onEmit(next);
          setSchema(next);
        }}
      />
    );
  }
  const utils = render(<Harness />);
  return { apiRef, onEmit, api: () => apiRef.current!, ...utils };
}

function HeaderControllerCapture({
  schema,
  onDefs,
}: {
  schema: JSONSchema7;
  onDefs: (defs: Record<string, unknown>) => void;
}) {
  const doc = React.useMemo(() => fromJsonSchema(schema), [schema]);
  const nodeView = React.useMemo(() => getSchemaDocumentView(doc).root, [doc]);
  const controller = useDocumentNodeHeaderController({
    dispatch: () => {},
    doc,
    nodeId: doc.root.id,
    nodeView,
    setDefsAccordionOpen: () => {},
  });
  useKeyedMountEffect(joinEffectKey([controller.defs, onDefs]), () => {
    onDefs(controller.defs);
  });
  return null;
}

function DefinitionsControllerCapture({
  schema,
  onPaths,
}: {
  schema: JSONSchema7;
  onPaths: (paths: string[]) => void;
}) {
  const doc = React.useMemo(() => fromJsonSchema(schema), [schema]);
  const controller = useDocumentDefinitionsEditorController({
    dispatch: () => {},
    doc,
    mode: "editable",
    definitionsEnabled: true,
    accordionOpen: true,
    setAccordionOpen: () => {},
  });
  useKeyedMountEffect(
    joinEffectKey([controller.definitionViews, onPaths]),
    () => {
      onPaths(controller.definitionViews.map((view) => view.path));
    },
  );
  return null;
}

const sample: JSONSchema7 = {
  type: "object",
  properties: { a: { type: "string" }, b: { type: "number" } },
  required: ["a"],
};

describe("useSchemaBuilderState wiring", () => {
  it("exposes schema as the all-required projection of the controlled value", () => {
    const { api } = renderProvider(sample);
    // policy: every property is required
    expect(api().schema).toEqual(requireAllProperties(sample));
  });

  it("forces every property required regardless of the loaded schema (policy)", () => {
    const { api } = renderProvider({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "number" } },
      required: ["a"], // b NOT required in the input
    });
    expect(api().schema.required).toEqual(["a", "b"]);
  });

  it("dispatch emits the projected schema and updates the document", () => {
    const { api, onEmit } = renderProvider(sample);
    const aPropertyId = getChildPropertyId(api().doc, api().doc.root.id, "a")!;
    act(() => {
      api().dispatch((d) => renameProperty(d, aPropertyId, "alpha"));
    });
    expect(Object.keys(api().schema.properties!)).toEqual(["alpha", "b"]);
    expect(api().schema.required).toEqual(["alpha", "b"]); // all required
    // onEmit receives the same projected schema
    expect(onEmit).toHaveBeenCalled();
    const last = onEmit.mock.calls.at(-1)![0];
    expect(last).toEqual(api().schema);
  });

  it("keeps sibling node ids stable across an edit (echo detection — no re-import)", () => {
    const { api } = renderProvider(sample);
    const bIdBefore = getChildNodeId(api().doc, api().doc.root.id, "b");
    const aPropertyId = getChildPropertyId(api().doc, api().doc.root.id, "a")!;
    act(() => {
      api().dispatch((d) => renameProperty(d, aPropertyId, "alpha"));
    });
    // the edit round-tripped through the controlled prop; b's id must survive
    const bIdAfter = getChildNodeId(api().doc, api().doc.root.id, "b");
    expect(bIdAfter).toBe(bIdBefore);
    expect(Object.keys(api().schema.properties!)).toEqual(["alpha", "b"]);
  });

  it("dispatch is a no-op when the operation changes nothing", () => {
    const { api, onEmit } = renderProvider(sample);
    const before = api().schema;
    act(() => {
      api().dispatch((d) => d); // identity
    });
    expect(api().schema).toBe(before);
    expect(onEmit).not.toHaveBeenCalled();
  });

  it("re-imports when the controlled value changes externally", () => {
    const apiRef: { current: Ctx | null } = { current: null };
    function Harness({ schema }: { schema: JSONSchema7 }) {
      return (
        <Capture apiRef={apiRef} schema={schema} onValueChange={() => {}} />
      );
    }
    const { rerender } = render(<Harness schema={sample} />);
    expect(Object.keys(apiRef.current!.schema.properties!)).toEqual(["a", "b"]);
    const next: JSONSchema7 = {
      type: "object",
      properties: { x: { type: "boolean" } },
    };
    act(() => rerender(<Harness schema={next} />));
    expect(apiRef.current!.schema).toEqual(requireAllProperties(next));
  });

  it("supports adding a property then naming it through two ops", () => {
    const { api } = renderProvider(sample);
    act(() => {
      api().dispatch((d) => addProperty(d, d.root.id));
    });
    // the new (empty-key) node exists in the doc but isn't projected yet
    expect(api().doc.root.properties).toHaveLength(3);
    expect(Object.keys(api().schema.properties!)).toEqual(["a", "b"]);
    const newPropertyId = api().doc.root.properties!.at(-1)!.id;
    act(() => {
      api().dispatch((d) => renameProperty(d, newPropertyId, "c"));
    });
    expect(Object.keys(api().schema.properties!)).toEqual(["a", "b", "c"]);
  });

  it("builds header definition maps with prototype-key definition names", () => {
    let defs: Record<string, unknown> | null = null;
    render(
      <HeaderControllerCapture
        schema={
          JSON.parse(
            '{"type":"object","$defs":{"__proto__":{"type":"object","properties":{"value":{"type":"string"}}},"constructor":{"type":"string"}},"properties":{"a":{"type":"string"}}}',
          ) as JSONSchema7
        }
        onDefs={(nextDefs) => {
          defs = nextDefs;
        }}
      />,
    );

    expect(Object.prototype.hasOwnProperty.call(defs, "__proto__")).toBe(true);
    expect(Object.keys(defs || {})).toEqual(["__proto__", "constructor"]);
  });

  it("builds escaped definition editor paths", () => {
    let paths: string[] = [];
    render(
      <DefinitionsControllerCapture
        schema={{
          type: "object",
          $defs: {
            "A/B~C": {
              type: "object",
              properties: { value: { type: "string" } },
            },
          },
          properties: {},
        }}
        onPaths={(nextPaths) => {
          paths = nextPaths;
        }}
      />,
    );

    expect(paths).toEqual(["#/$defs/A~1B~0C"]);
  });

  it("blocks dispatch and replaceSchema when read-only", async () => {
    const onPersist = vi
      .fn<(schema: JSONSchema7) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { api, onEmit } = renderProvider(sample, {
      readOnly: true,
      onPersist,
    });
    const aPropertyId = getChildPropertyId(api().doc, api().doc.root.id, "a")!;

    act(() => {
      api().dispatch((d) => renameProperty(d, aPropertyId, "alpha"));
    });
    await act(async () => {
      await api().replaceSchema({
        type: "object",
        properties: { z: { type: "boolean" } },
      });
    });

    expect(Object.keys(api().schema.properties!)).toEqual(["a", "b"]);
    expect(onEmit).not.toHaveBeenCalled();
    expect(onPersist).not.toHaveBeenCalled();
  });

  it("replaceSchema accepts functional updates and applies the required policy", async () => {
    const { api, onEmit } = renderProvider(sample);

    await act(async () => {
      await api().replaceSchema((current) => ({
        ...current,
        properties: {
          ...current.properties,
          c: { type: "boolean" },
        },
      }));
    });

    expect(Object.keys(api().schema.properties!)).toEqual(["a", "b", "c"]);
    expect(api().schema.required).toEqual(["a", "b", "c"]);
    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onEmit.mock.calls[0][0]).toEqual(api().schema);
  });

  it("replaceSchema can skip persistence without skipping the controlled emit", async () => {
    const onPersist = vi
      .fn<(schema: JSONSchema7) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { api, onEmit } = renderProvider(sample, { onPersist });

    await act(async () => {
      await api().replaceSchema(
        {
          type: "object",
          properties: { z: { type: "boolean" } },
        },
        false,
      );
    });

    expect(Object.keys(api().schema.properties!)).toEqual(["z"]);
    expect(onEmit).toHaveBeenCalledTimes(1);
    expect(onPersist).not.toHaveBeenCalled();
  });

  it("replaceSchema persists an unchanged schema without re-emitting it", async () => {
    const onPersist = vi
      .fn<(schema: JSONSchema7) => Promise<void>>()
      .mockResolvedValue(undefined);
    const { api, onEmit } = renderProvider(sample, { onPersist });
    const projected = api().schema;

    await act(async () => {
      await api().replaceSchema(projected);
    });

    expect(onEmit).not.toHaveBeenCalled();
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onPersist.mock.calls[0][0]).toEqual(projected);
  });
});
