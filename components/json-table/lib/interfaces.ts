import { FileData } from "@/components/json-table/lib/file-context";
import { Extraction } from "@/components/json-table/lib/extract-types";

// ============================================
// Shared Types
// ============================================

/** Available view modes for extraction display */
export type ViewMode = "table" | "form" | "code";

/** Filter field options */
export type FilterField =
  | "created_date"
  | "metadata"
  | "model"
  | "document_type"
  | "filename_regex";

/** Filter operator options */
export type FilterOperator =
  | "after"
  | "before"
  | "within"
  | "is"
  | "is_not"
  | "contains";

/** Filter type for filtering extractions */
export interface FilterType {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | Date;
  /** For date range filters (within), the end date */
  endValue?: Date;
  /** For metadata filters, the key to filter on */
  metadataKey?: string;
  /** For grouped document type filters, the flattened list of values */
  documentTypeValues?: string[];
  /** Display label used by grouped document type filters */
  documentTypeLabel?: string;
}

// ============================================
// Reusable Option Groups
// ============================================

/** Options for controlling extraction display behavior */
export interface ExtractionDisplayOptions {
  /** View mode for the extraction data */
  view?: ViewMode;
  /** Controls whether reasoning is displayed */
  showReasoning?: boolean;
  /** If true, shows tabs to switch between views */
  showTabs?: boolean;
  /** If true, shows the display tabs (Table/Form/Code). Defaults to showTabs value. */
  showDisplayTabs?: boolean;
}

/** Editable display options used by review editor flows */
export interface EditableExtractionDisplayOptions
  extends ExtractionDisplayOptions {
  /** Controls whether prediction data values can be edited */
  allowEditing?: boolean;
}

/** Options for continue/review action */
export interface ContinueButtonOptions {
  /** Callback when the continue/review action is clicked */
  onClick?: () => void;
  /** Label for the continue button (default: "Continue") */
  label?: string;
}

/** Options for streaming state */
export interface ExtractionStreamingOptions<T = unknown> {
  /** Whether we're in streaming mode */
  isActive?: boolean;
  /** Streaming data */
  data?: T;
  /** Optional consensus likelihoods for streamed predictions */
  likelihoods?: Record<string, unknown>;
  /** Optional consensus details for streamed predictions */
  consensusDetails?: Array<Record<string, unknown>>;
  /** Optional consensus sample size used for streamed predictions */
  nConsensus?: number;
  /** Filename being streamed */
  filename?: string;
}

/** Visibility options for list columns/features */
export interface VisibilityOptions {
  /** Whether to show the search input */
  search?: boolean;
  /** Whether to show the display popover */
  displayPopover?: boolean;
  /** Whether to show the status column */
  statusColumn?: boolean;
  /** Whether to show the date column */
  dateColumn?: boolean;
  /** Whether to show the filters */
  filters?: boolean;
  /** Whether to show the metadata filter option */
  metadataFilter?: boolean;
  /** Whether to show the model filter option */
  modelFilter?: boolean;
}

/** Pagination metadata for list navigation */
export interface PaginationMetadata {
  before?: string | null;
  after?: string | null;
}

// ============================================
// Component Interfaces
// ============================================

export interface ExtractionComponentProps {
  extractionId?: string;
  /** Whether this is a new extraction that requires file upload (default: false) */
  isNewExtraction?: boolean;
  /** Optional externally-driven streaming state (for playground-style streaming). */
  externalStreamingOptions?: {
    isActive: boolean;
    predictions?: Record<string, unknown> | null;
    likelihoods?: Record<string, unknown> | null;
    consensusDetails?: Array<Record<string, unknown>> | null;
    nConsensus?: number;
    fileData?: FileData | null;
    filename?: string | null;
  };
  /** Display options for the extraction viewer */
  extractionDisplayOptions?: ExtractionDisplayOptions;
  /** Continue button configuration */
  continueButtonOptions?: ContinueButtonOptions;
}

export interface ExtractionReviewerVisibilityOptions {
  extractionDisplayOptions?: ExtractionDisplayOptions;
  metadataFilter?: boolean;
  modelFilter?: boolean;
  filterMenu?: boolean;
  exportMenu?: boolean;
  uploadButton?: boolean;
}

export interface ExtractionReviewerProps {
  /** The project ID to filter extractions */
  projectId: string;
  /** The currently selected extraction ID */
  extractionId?: string;
  /** Callback when navigation is needed */
  onNavigate: (params: { extractionId?: string }) => void;
  /** Initial/default filters to apply */
  initialFilters?: FilterType[];
  /** Visibility options for the extraction reviewer */
  visibility?: ExtractionReviewerVisibilityOptions;
  /** Default view mode when component mounts */
  defaultView?: ViewMode;
}

export interface ExtractionsListProps {
  /** Callback when an extraction is selected */
  onSelectExtraction?: (extraction: Extraction) => void;
  /** Callback when "new extraction" is clicked */
  onNewExtractionClick?: () => void;
  /** Title displayed in the list header */
  title?: string;
  /** Visibility options for list features */
  visibility?: VisibilityOptions;
  /** Initial/default filters to apply */
  initialFilters?: FilterType[];
}

export interface SmallExtractionsListProps {
  extractions: Extraction[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onExtractionClick: (extraction: Extraction) => void;
  onDeleteClick: (e: React.MouseEvent, id: string) => void;
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  deletingId: string | null;
  onNewExtraction?: () => string;
  showUploadButton?: boolean;
}

export interface DataComponentProps {
  extraction: Extraction | null;
  /** Callback for field path changes */
  onFieldPathChange?: (fieldPath: string) => void;
  /** Display options for the data viewer */
  extractionDisplayOptions?: ExtractionDisplayOptions;
  /** Continue button configuration */
  continueButtonOptions?: ContinueButtonOptions;
  /** Streaming state options */
  extractionStreamingOptions?: ExtractionStreamingOptions;
}

/** Available view modes for file component */
export type FileViewMode = "preview" | "sources";

export interface FileComponentProps {
  extraction: Extraction | null;
  fieldPath?: string | null;
  /** Streaming state options */
  extractionStreamingOptions?: ExtractionStreamingOptions<FileData | null>;
  /** Default view mode for the file viewer. If 'preview', stays on preview even if extraction exists. */
  defaultView?: FileViewMode;
}

export interface UploadJobsListProps {
  /** Optional metadata to associate uploads with */
  metadata?: Record<string, string>;
  endpoint?: string;
}

/**
 * A highlighted field that requires attention during review.
 */
export type HighlightedFieldRef = {
  input: "default" | "conditional" | "data";
  path: string;
};

export type HighlightedFieldInfo = {
  /** The field reference to highlight */
  field_ref: HighlightedFieldRef;
  /** Indication text explaining why this field requires attention */
  indication_text?: string | null;
  /** Field reference whose value was used as indication */
  indication_ref?: HighlightedFieldRef | null;
  /** Reasoning text for the indication ref (resolved from conditional data by backend) */
  indication_reasoning?: string | null;
};

export interface ReviewEditorProps {
  /** Stable identity for the review session when reviewing standalone data */
  reviewSessionId?: string;
  /** The extraction ID to load and review */
  extractionId?: string;
  /**
   * Initial data to display directly (without fetching from an extraction).
   * When provided without extractionId, renders a standalone data editor without document viewer.
   * Useful for reviewing JSON data from non-extraction sources like merge-dicts nodes.
   */
  initialData?: Record<string, unknown>;
  /** JSON schema for form/table views. If not provided, will use the extraction's embedded json_schema */
  jsonSchema?: Record<string, unknown>;
  /** Display options for the data viewer */
  extractionDisplayOptions?: EditableExtractionDisplayOptions;
  /** Callback fired when the currently focused/hovered field path changes */
  onFieldPathChange?: (fieldPath: string | null) => void;
  /** Callback when user approves with the (possibly edited) JSON data */
  onApprove?: (jsonData: Record<string, unknown>) => void;
  /** Callback when user rejects */
  onReject?: () => void;
  /** Callback when user saves the current edits as a version without deciding */
  onSaveVersion?: (jsonData: Record<string, unknown>) => void;
  /** Label for the approve button (default: "Approve") */
  approveButtonLabel?: string;
  /** Label for the reject button (default: "Reject") */
  rejectButtonLabel?: string;
  /** Label for the save-version button (default: "Save edits") */
  saveVersionButtonLabel?: string;
  /** Label for the clear-edits button (default: "Clear edits") */
  clearEditsButtonLabel?: string;
  /** Whether the approve/reject actions are in progress */
  isSubmitting?: boolean;
  /** Whether the save-version action is in progress */
  isSavingVersion?: boolean;
  /**
   * Disables the approve/reject buttons without showing the in-progress
   * spinner. Use it when a prerequisite for submitting a decision is not
   * ready yet — e.g. the review overlay version id is still loading. Distinct
   * from `isSubmitting`, which means a decision is mid-flight.
   */
  decisionsDisabled?: boolean;
  /**
   * Fields to highlight during review with optional indication texts.
   * These fields will be visually emphasized to draw the reviewer's attention.
   * Uses dot notation for nested paths (e.g., "packing_list.order_number_valid")
   */
  highlightedFields?: HighlightedFieldInfo[];
}
