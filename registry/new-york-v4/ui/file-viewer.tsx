"use client";

export {
  detectCategory,
  type FileCategory,
  type ViewerSource as FileViewerSource,
  type ViewerSource,
} from "./file-viewer-core";
export {
  FileViewerContent,
  FileViewerFieldSource,
  FileViewerFieldSourceLabel,
  FileViewerFieldSourceStatus,
  FileViewerFieldSourceValue,
  FileViewerInset,
  FileViewerLegend,
  FileViewerSidebar,
  FileViewerSidebarContent,
  FileViewerSidebarFooter,
  FileViewerSidebarHeader,
  FileViewerSidebarRail,
  FileViewerSidebarSection,
  FileViewerSidebarSectionAction,
  FileViewerSidebarSectionContent,
  FileViewerSidebarSectionHeader,
  FileViewerSidebarSectionTitle,
  FileViewerSidebarSeparator,
  FileViewerSourceAction,
  FileViewerSourceBadge,
  FileViewerSourceItem,
  FileViewerSourceList,
  FileViewerSourceTrigger,
  FileViewerViewport,
  type FileViewerContentProps,
  type FileViewerFieldSourceLabelProps,
  type FileViewerFieldSourceProps,
  type FileViewerFieldSourceStatusProps,
  type FileViewerFieldSourceValueProps,
  type FileViewerInsetProps,
  type FileViewerLegendProps,
  type FileViewerSidebarProps,
  type FileViewerSidebarContentProps,
  type FileViewerSidebarFooterProps,
  type FileViewerSidebarHeaderProps,
  type FileViewerSidebarRailProps,
  type FileViewerSidebarSectionActionProps,
  type FileViewerSidebarSectionContentProps,
  type FileViewerSidebarSectionHeaderProps,
  type FileViewerSidebarSectionProps,
  type FileViewerSidebarSectionTitleProps,
  type FileViewerSidebarSeparatorProps,
  type FileViewerSourceActionProps,
  type FileViewerSourceBadgeProps,
  type FileViewerSourceItemProps,
  type FileViewerSourceListProps,
  type FileViewerSourceTriggerProps,
  type FileViewerViewportProps,
} from "./file-viewer-content";
export {
  FileViewerDocument,
  type FileViewerDocumentProps,
} from "./file-viewer-document";
export {
  FileViewerControls,
  FileViewerHeader,
  FileViewerMeta,
  FileViewerSidebarTrigger,
  FileViewerTitle,
  type FileViewerControlsProps,
  type FileViewerHeaderProps,
  type FileViewerMetaProps,
  type FileViewerSidebarTriggerProps,
  type FileViewerTitleProps,
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
