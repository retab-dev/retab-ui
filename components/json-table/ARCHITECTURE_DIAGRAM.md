# JSON Table and DataCell Architecture

## Implemented Layers

```mermaid
flowchart TD
  User["User pointer / keyboard input"]

  subgraph Projection["Projection layer"]
    SourceDocument["sourceDocument<br/>parent prop"]
    DocumentModel["useSingleFileTableDocumentModel"]
    ProjectionDocument["projectionDocument<br/>row source"]
    PrimitiveEditStore["JsonTablePrimitiveEditStore<br/>pending / confirmed / stale"]
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
    PropsAdapter["createJsonTableDataCellProps"]
    DataCell["DataCell"]
    Display["DataCellDisplay"]
    Input["DataCellInputControl"]
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
    PrimitiveController["useJsonTablePrimitiveCommitController"]
    StructuredController["useJsonTableStructuredCellController"]
    CellCommit["JsonTableCellCommit"]
    Patch["onUpdateDocument"]
  end

  User --> Cell
  SourceDocument --> DocumentModel --> ProjectionDocument --> ProjectRows
  DocumentModel --> PrimitiveEditStore
  ProjectRows --> ProjectedCell --> Row
  VirtualTable --> ProjectRows
  VirtualTable --> PrimitiveActive
  VirtualTable --> StructuredSession
  VirtualTable --> Row --> Cell

  Cell -->|primitive display/edit| PrimitiveAdapter --> PropsAdapter --> DataCell
  DataCell -. "active change" .-> VirtualTable
  DataCell -->|inactive| Display
  DataCell -->|text / number / integer| Input
  DataCell -->|boolean| Boolean
  DataCell -->|enum select| Select
  DataCell -->|date/time| Picker

  Cell -->|object/array editing| ActiveStructured --> StructuredCell

  Input --> Normalize
  Boolean --> Normalize
  Select --> Normalize
  Picker --> Normalize
  Normalize --> PrimitiveController --> CellCommit
  StructuredCell --> StructuredController --> CellCommit
  CellCommit --> DocumentModel --> Patch
```

## Primitive Activation

```mermaid
sequenceDiagram
  participant U as User
  participant Next as Next EditableJsonTableCell
  participant Table as SingleFileVirtualizedTable
  participant Old as Previous DataCell
  participant New as Next DataCell
  participant Commit as Commit pipeline

  U->>Next: pointerdown / keydown
  Next->>Table: replace primitive active identity
  Table->>Old: active=false
  Old->>Commit: finish through DataCell's own rules
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
