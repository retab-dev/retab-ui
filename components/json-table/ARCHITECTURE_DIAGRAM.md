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
    Cell["EditableJsonTableCell<br/>display/editor switch"]
  end

  subgraph Editors["Editor layer"]
    Dispatch["CellEditor"]
    Text["TextEditor"]
    Number["NumberEditor"]
    Boolean["BooleanEditor"]
    Enum["EnumEditor"]
    DateTime["Date / Time / DateTime editors"]
    Nested["Object / Array editors"]
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
  Cell -->|editing| Dispatch

  Dispatch --> Text
  Dispatch --> Number
  Dispatch --> Boolean
  Dispatch --> Enum
  Dispatch --> DateTime
  Dispatch --> Nested

  Display --> DataDisplay
  Text --> TextControl
  Number --> NumberControl
  Boolean --> BooleanControl
  DateTime --> PickerControl
  Enum --> Commit
  Nested --> Commit

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
  participant Editor as Kind editor
  participant Control as Native control
  participant Commit as Commit pipeline

  U->>Cell: pointerdown / keydown
  Cell->>Table: startEditSession(projectedCell, intent)
  Table->>Session: create one session
  Session->>Cell: matching cellId renders editor
  Cell->>Editor: pass session + ActivationIntent

  alt text or number
    Editor->>Control: focus, place caret, seed typed key if needed
  else boolean
    Editor->>Commit: toggle once from activation intent
    Editor->>Table: closeEditSession()
  else enum
    Editor->>Control: open select
  else object or array
    Editor->>Control: open popover for this session
  end

  Control->>Editor: draft / change / blur
  Editor->>Commit: normalize value
  Commit->>Table: document patch
  Editor->>Table: closeEditSession()
```

## DataCell Boundary

```mermaid
flowchart LR
  Table["JSON table"]
  Display["JsonTableDisplayCell<br/>display only"]
  Editor["Kind editor"]
  DataCell["DataCell primitive controls"]
  Native["Input / checkbox / picker trigger"]

  Table -->|inactive| Display
  Table -->|editing session| Editor
  Display --> DataCell
  Editor --> DataCell --> Native
```

The JSON table uses inert display cells until a table-owned edit session exists.
The active editor renders exactly one primitive control from the DataCell layer.

## Ownership Rule

```mermaid
flowchart LR
  Projection["Projection<br/>what cells exist"]
  Grid["Grid<br/>which session exists"]
  Intent["ActivationIntent<br/>why editing started"]
  Editor["Editor<br/>what intent means"]
  Commit["Commit<br/>persist normalized value"]

  Projection --> Grid --> Intent --> Editor --> Commit
```

The table owns session identity. Editors own native interaction semantics.
