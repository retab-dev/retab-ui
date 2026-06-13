# JSON Table and DataCell Architecture

## Implemented Editing Architecture

```mermaid
flowchart TD
  User["User pointer / keyboard input"]

  subgraph Projection["Projection layer"]
    ProjectRows["projectDocumentRows"]
    ProjectedCell["ProjectedCell<br/>docId + fieldPath + value"]
  end

  subgraph Grid["Grid layer"]
    TableView["SingleFileTableView"]
    VirtualTable["SingleFileVirtualizedTable"]
    EditSession["JsonTableEditSession<br/>one edited cell"]
    Row["SingleFileFormRow"]
    Cell["EditableJsonTableCell<br/>display/active switch"]
  end

  subgraph Active["Active control layer"]
    ActiveCell["JsonTableActiveCell"]
    DataCellControl["JsonTableDataCell"]
    StructuredCell["JsonTableStructuredCell"]
  end

  subgraph DataCell["DataCell primitive layer"]
    Display["JsonTableDisplayCell<br/>inert display"]
    DataDisplay["DataCellDisplay"]
    TextControl["DataCellTextControl"]
    NumberControl["DataCellNumberControl"]
    BooleanControl["DataCellBooleanControl"]
    PickerControl["DataCellPickerControl"]
  end

  subgraph Commit["Commit pipeline"]
    Normalize["formatValueForCommit"]
    Controller["useCellController"]
    Patch["onDocumentDataChange"]
  end

  User --> Cell
  TableView --> ProjectRows --> ProjectedCell
  TableView --> VirtualTable
  VirtualTable --> EditSession
  VirtualTable --> Row --> Cell
  ProjectedCell --> Row

  Cell -->|not editing| Display
  Cell -->|startEditSession with ActivationIntent| EditSession
  EditSession -->|matching cellId| Cell
  Cell -->|editing| ActiveCell

  ActiveCell --> DataCellControl
  ActiveCell --> StructuredCell

  Display --> DataDisplay
  DataCellControl --> TextControl
  DataCellControl --> NumberControl
  DataCellControl --> BooleanControl
  DataCellControl --> PickerControl
  StructuredCell --> Commit

  TextControl --> Normalize
  NumberControl --> Normalize
  BooleanControl --> Normalize
  PickerControl --> Normalize
  Normalize --> Controller --> Patch
```

## Session Interaction Flow

```mermaid
sequenceDiagram
  participant U as User
  participant Cell as EditableJsonTableCell
  participant Table as SingleFileVirtualizedTable
  participant Session as JsonTableEditSession
  participant Active as JsonTableActiveCell
  participant Control as Native control
  participant Commit as Commit pipeline

  U->>Cell: pointerdown / keydown
  Cell->>Table: startEditSession(projectedCell, intent)
  Table->>Session: create one session
  Session->>Cell: matching cellId renders active control
  Cell->>Active: pass session + ActivationIntent

  alt text or number
    Active->>Control: focus, place caret, seed typed key if needed
  else boolean
    Active->>Commit: toggle once from activation intent
    Active->>Table: closeEditSession()
  else enum
    Active->>Control: open select
  else object or array
    Active->>Control: open popover for this session
  end

  Control->>Active: draft / change / blur
  Active->>Commit: normalize value
  Commit->>Table: document patch
  Active->>Table: closeEditSession()
```

## DataCell Boundary

```mermaid
flowchart LR
  Table["JSON table"]
  Display["JsonTableDisplayCell<br/>display only"]
  Active["JsonTableActiveCell"]
  DataCell["DataCell primitive controls"]
  Native["Input / checkbox / picker trigger"]

  Table -->|inactive| Display
  Table -->|editing session| Active
  Display --> DataCell
  Active --> DataCell --> Native
```

The JSON table uses inert display cells until a table-owned edit session exists.
The active control renders exactly one primitive control from the DataCell layer.

## Ownership Rule

```mermaid
flowchart LR
  Projection["Projection<br/>what cells exist"]
  Grid["Grid<br/>which session exists"]
  Intent["ActivationIntent<br/>why editing started"]
  Active["Active control<br/>what intent means"]
  Commit["Commit<br/>persist normalized value"]

  Projection --> Grid --> Intent --> Active --> Commit
```

The table owns session identity. Active controls own native interaction
semantics.
