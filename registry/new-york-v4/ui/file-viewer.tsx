"use client";

export {
  detectCategory,
  type FileCategory,
  type FileViewerControlsPlacement,
  type ViewerSource as FileViewerSource,
  type ViewerSource,
} from "./file-viewer-core";
export {
  FileViewerBody,
  FileViewerFieldSource,
  FileViewerFieldSourceLabel,
  FileViewerFieldSourceStatus,
  FileViewerFieldSourceValue,
  FileViewerLegend,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarSection,
  FileViewerSidebarSectionAction,
  FileViewerSidebarSectionContent,
  FileViewerSidebarSectionHeader,
  FileViewerSidebarSectionTitle,
  FileViewerSidebarSeparator,
  FileViewerSurface,
  FileViewerSourceAction,
  FileViewerSourceBadge,
  FileViewerSourceItem,
  FileViewerSourceList,
  FileViewerSourceTrigger,
  FileViewerViewport,
  useFileViewerViewportSize,
  useOptionalFileViewerViewportSize,
  type FileViewerBodyProps,
  type FileViewerFieldSourceLabelProps,
  type FileViewerFieldSourceProps,
  type FileViewerFieldSourceStatusProps,
  type FileViewerFieldSourceValueProps,
  type FileViewerLegendProps,
  type FileViewerSidebarProps,
  type FileViewerSidebarContentProps,
  type FileViewerSidebarSectionActionProps,
  type FileViewerSidebarSectionContentProps,
  type FileViewerSidebarSectionHeaderProps,
  type FileViewerSidebarSectionProps,
  type FileViewerSidebarSectionTitleProps,
  type FileViewerSidebarSeparatorProps,
  type FileViewerSurfaceProps,
  type FileViewerSourceActionProps,
  type FileViewerSourceBadgeProps,
  type FileViewerSourceItemProps,
  type FileViewerSourceListProps,
  type FileViewerSourceTriggerProps,
  type FileViewerViewportSize,
  type FileViewerViewportProps,
} from "./file-viewer-body";
export {
  FileViewerDocument,
  type FileViewerDocumentProps,
} from "./file-viewer-document";
export {
  FileViewerHeader,
  FileViewerHeaderEnd,
  FileViewerHeaderStart,
  FileViewerIdentity,
  FileViewerSidebarTrigger,
  FileViewerToolbar,
  type FileViewerHeaderEndProps,
  type FileViewerHeaderProps,
  type FileViewerHeaderStartProps,
  type FileViewerIdentityProps,
  type FileViewerSidebarTriggerProps,
  type FileViewerToolbarProps,
} from "./file-viewer-header";
export {
  FileViewerEmptyState,
  FileViewerErrorState,
  FileViewerLoadingState,
  FileViewerUnavailableState,
  FileViewerUnsupportedState,
  type FileViewerErrorStateProps,
  type FileViewerStateProps,
  type FileViewerUnsupportedStateProps,
} from "./file-viewer-state";
export { useFileViewerResource } from "./file-viewer-resource-state";
export {
  FileViewerPreview,
  type FileViewerPreviewProps,
} from "./file-viewer-preview";
export {
  useFileViewerSidebar,
  type FileViewerHeaderMode,
  type FileViewerSidebarStateValue,
} from "./file-viewer-context";
export {
  FileViewer,
  type FileViewerLayout,
  type FileViewerProps,
} from "./file-viewer-frame";
export {
  FileViewerProvider,
  type FileViewerProviderProps,
} from "./file-viewer-provider";
