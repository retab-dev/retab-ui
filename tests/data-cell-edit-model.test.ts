import { describe, expect, it, vi } from "vitest"

import { createDataCellEditModel } from "@/registry/new-york-v4/ui/data-cell-edit-model"
import type {
  DataCellCommitValue,
  DataCellKind,
  DataCellValueMeta,
} from "@/registry/new-york-v4/ui/data-cell-types"

const shellState = {
  disabled: false,
}

function validMeta(kind: DataCellKind): DataCellValueMeta {
  return {
    kind,
    rawValue: "value",
    isEmpty: false,
    isValid: true,
  }
}

function expectCommitValueRejected(
  onCommit:
    | ((value: DataCellCommitValue, meta: DataCellValueMeta) => void)
    | undefined,
  kind: DataCellKind,
  value: DataCellCommitValue
) {
  expect(() => onCommit?.(value, validMeta(kind))).toThrow(
    /Invalid .* commit value/
  )
}

describe("createDataCellEditModel", () => {
  it("normalizes text commits and rejects non-text commit values", () => {
    const onCommit = vi.fn()
    const model = createDataCellEditModel(
      {
        kind: "text",
        value: "memo",
        onCommit,
      },
      shellState
    )

    model.onCommit?.("next", validMeta("text"))
    model.onCommit?.(null, validMeta("text"))

    expect(onCommit).toHaveBeenCalledTimes(2)
    expect(onCommit).toHaveBeenCalledWith("next", validMeta("text"))
    expect(onCommit).toHaveBeenCalledWith(null, validMeta("text"))
    expectCommitValueRejected(model.onCommit, "text", 1)
    expectCommitValueRejected(model.onCommit, "text", true)
  })

  it("normalizes number commits and rejects non-number commit values", () => {
    const onCommit = vi.fn()
    const model = createDataCellEditModel(
      {
        kind: "number",
        value: 1,
        onCommit,
      },
      shellState
    )

    model.onCommit?.(2, validMeta("number"))
    model.onCommit?.(null, validMeta("number"))

    expect(onCommit).toHaveBeenCalledTimes(2)
    expect(onCommit).toHaveBeenCalledWith(2, validMeta("number"))
    expect(onCommit).toHaveBeenCalledWith(null, validMeta("number"))
    expectCommitValueRejected(model.onCommit, "number", "2")
    expectCommitValueRejected(model.onCommit, "number", true)
  })

  it("normalizes integer commits and rejects non-number commit values", () => {
    const onCommit = vi.fn()
    const model = createDataCellEditModel(
      {
        kind: "integer",
        value: 1,
        onCommit,
      },
      shellState
    )

    model.onCommit?.(2, validMeta("integer"))
    model.onCommit?.(null, validMeta("integer"))

    expect(onCommit).toHaveBeenCalledTimes(2)
    expect(onCommit).toHaveBeenCalledWith(2, validMeta("integer"))
    expect(onCommit).toHaveBeenCalledWith(null, validMeta("integer"))
    expectCommitValueRejected(model.onCommit, "integer", "2")
    expectCommitValueRejected(model.onCommit, "integer", true)
  })

  it("normalizes boolean commits and rejects nullable or scalar commit drift", () => {
    const onCommit = vi.fn()
    const model = createDataCellEditModel(
      {
        kind: "boolean",
        value: false,
        onCommit,
      },
      shellState
    )

    model.onCommit?.(true, validMeta("boolean"))

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(true, validMeta("boolean"))
    expectCommitValueRejected(model.onCommit, "boolean", null)
    expectCommitValueRejected(model.onCommit, "boolean", "true")
    expectCommitValueRejected(model.onCommit, "boolean", 1)
  })

  it("normalizes select commits and rejects non-string commit values", () => {
    const onCommit = vi.fn()
    const model = createDataCellEditModel(
      {
        kind: "select",
        value: "draft",
        selectOptions: [{ value: "draft", label: "Draft" }],
        onCommit,
      },
      shellState
    )

    model.onCommit?.("done", validMeta("select"))
    model.onCommit?.(null, validMeta("select"))

    expect(onCommit).toHaveBeenCalledTimes(2)
    expect(onCommit).toHaveBeenCalledWith("done", validMeta("select"))
    expect(onCommit).toHaveBeenCalledWith(null, validMeta("select"))
    expectCommitValueRejected(model.onCommit, "select", 1)
    expectCommitValueRejected(model.onCommit, "select", true)
  })

  it("normalizes picker commits and rejects non-string commit values", () => {
    const dateCommit = vi.fn()
    const timeCommit = vi.fn()
    const dateTimeCommit = vi.fn()
    const dateModel = createDataCellEditModel(
      {
        kind: "date",
        value: "2026-06-14",
        onCommit: dateCommit,
      },
      shellState
    )
    const timeModel = createDataCellEditModel(
      {
        kind: "time",
        value: "12:30",
        onCommit: timeCommit,
      },
      shellState
    )
    const dateTimeModel = createDataCellEditModel(
      {
        kind: "date-time",
        value: "2026-06-14T12:30:00.000Z",
        onCommit: dateTimeCommit,
      },
      shellState
    )

    dateModel.onCommit?.("2026-06-15", validMeta("date"))
    timeModel.onCommit?.("13:30", validMeta("time"))
    dateTimeModel.onCommit?.(null, validMeta("date-time"))

    expect(dateCommit).toHaveBeenCalledWith("2026-06-15", validMeta("date"))
    expect(timeCommit).toHaveBeenCalledWith("13:30", validMeta("time"))
    expect(dateTimeCommit).toHaveBeenCalledWith(null, validMeta("date-time"))
    expectCommitValueRejected(dateModel.onCommit, "date", 1)
    expectCommitValueRejected(timeModel.onCommit, "time", true)
    expectCommitValueRejected(dateTimeModel.onCommit, "date-time", 1)
  })
})
