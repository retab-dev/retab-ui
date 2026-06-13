# JSON Table and DataCell Architecture

## Implemented Layers

```mermaid
flowchart TD
  User["User pointer / keyboard input"]

  subgraph Projection["Projection layer"]
    ProjectRows["projectDocumentRows"]
    ProjectedCell["ProjectedCell<br/>docId + fieldPath + value"]
  end

  subgraph Grid["Grid layer"]
    VirtualTable["SingleFileVirtualizedTable"]
    PrimitiveActive["JsonTablePrimitiveActiveCell<br/>identity only"]
    StructuredSession["JsonTableStructuredEditSession<br/>object/array popover"]
    Row["SingleFileFormRow"]
    Cell["EditableJsonTableCell"]
  end

  subgraph Primitive["Primitive DataCell path"]
    PrimitiveAdapter["JsonTablePrimitiveCell"]
    JsonDataCell["JsonTableDataCell"]
    EditorHandle["DataCellEditorHandle"]
    DataCell["DataCell"]
    Display["DataCellDisplay"]
    Text["DataCellTextControl"]
    Number["DataCellNumberControl"]
    Boolean["DataCellBooleanControl"]
    Select["DataCellSelectControl"]
    Picker["DataCellPickerControl"]
  end

  subgraph Structured["Structured path"]
    ActiveStructured["JsonTableStructuredActiveCell"]
    StructuredCell["JsonTableStructuredCell"]
  end

  subgraph Commit["Commit pipeline"]
    Normalize["formatValueForCommit"]
    Controller["useCellController"]
    Patch["onDocumentDataChange"]
  end

  User --> Cell
  ProjectRows --> ProjectedCell --> Row
  VirtualTable --> ProjectRows
  VirtualTable --> PrimitiveActive
  VirtualTable --> StructuredSession
  VirtualTable --> Row --> Cell

  Cell -->|primitive display/edit| PrimitiveAdapter --> JsonDataCell --> DataCell
  DataCell -. "finish / cancel handle" .-> EditorHandle
  EditorHandle -. "cross-cell handoff" .-> VirtualTable
  DataCell -->|inactive| Display
  DataCell -->|text| Text
  DataCell -->|number/integer| Number
  DataCell -->|boolean| Boolean
  DataCell -->|enum select| Select
  DataCell -->|date/time| Picker

  Cell -->|object/array editing| ActiveStructured --> StructuredCell

  Text --> Normalize
  Number --> Normalize
  Boolean --> Normalize
  Select --> Normalize
  Picker --> Normalize
  StructuredCell --> Normalize
  Normalize --> Controller --> Patch
```

## Primitive Handoff

```mermaid
sequenceDiagram
  participant U as User
  participant Next as Next EditableJsonTableCell
  participant Table as SingleFileVirtualizedTable
  participant Old as Previous DataCell
  participant New as Next DataCell
  participant Commit as Commit pipeline

  U->>Next: pointerdown / keydown
  Next->>Old: DataCellEditorHandle.finish()
  Old->>Commit: commit through DataCell's own rules
  Next->>Table: set primitive active identity
  Table->>New: active=true
  New->>New: focus, place caret, own draft/overlay
```

## Structured Session

```mermaid
sequenceDiagram
  participant U as User
  participant Cell as EditableJsonTableCell
  participant Table as SingleFileVirtualizedTable
  participant Session as JsonTableStructuredEditSession
  participant Structured as JsonTableStructuredCell
  participant Commit as Commit pipeline

  U->>Cell: pointerdown / Enter / F2
  Cell->>Table: startStructuredEditSession(projectedCell, intent)
  Table->>Session: create session with id + field identity + overlay state
  Session->>Structured: render object/array editor
  Structured->>Commit: commit normalized JSON value
  Structured->>Table: closeStructuredEditSession()
```

## Ownership Rule

```mermaid
flowchart LR
  Projection["Projection<br/>what cells exist"]
  Grid["Grid<br/>which cell is active"]
  Primitive["DataCell<br/>primitive draft + overlay"]
  Structured["JsonTableStructuredCell<br/>object/array popover"]
  Commit["Commit<br/>persist normalized value"]

  Projection --> Grid
  Grid --> Primitive --> Commit
  Grid --> Structured --> Commit
```

The table owns identity and document commits. DataCell owns primitive editing
mechanics. Structured cells keep the richer table-owned popover state because
they are not primitive controls.
